/* 吃啥呢 · 在线点餐（顾客端）*/
(function () {
  // ---- 安全存储：预览面板 iframe 可能禁用 localStorage，禁用时退化为内存存储 ----
  const store = (function () {
    try {
      const probe = '__csn_probe__'
      window.localStorage.setItem(probe, '1')
      window.localStorage.removeItem(probe)
      return window.localStorage
    } catch (e) {
      const mem = {}
      return {
        getItem: k => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
        setItem: (k, v) => { mem[k] = String(v) },
        removeItem: k => { delete mem[k] }
      }
    }
  })()

  const readJSON = (key, fallback) => {
    try {
      const v = store.getItem(key)
      return v ? JSON.parse(v) : fallback
    } catch (e) {
      return fallback
    }
  }

  const TOKEN_KEY = 'csn_shop_token'
  const USER_KEY = 'csn_shop_user'
  const CART_KEY = 'csn_shop_cart'

  const api = axios.create({ baseURL: '/api/shop', timeout: 15000 })

  // vm 的模块级引用：拦截器在 Vue 实例创建前注册，运行时回调里再取实例
  let app = null

  // 统一处理 token 失效：任何需要登录的接口返回 HTTP 401 时自动登出，
  // 避免「下单/支付/取消」等接口 token 过期后只提示不登出、用户需手动退出再登录。
  // 登录接口的 401 是业务错误（body.status=401、HTTP 200），不会走到这里。
  api.interceptors.response.use(
    res => res,
    err => {
      if (err && err.response && err.response.status === 401 && app) {
        const url = (err.config && err.config.url) || ''
        if (url.indexOf('/login') === -1 && url.indexOf('/register') === -1) {
          app.logout(true)
        }
      }
      return Promise.reject(err)
    }
  )

  // 按菜名 / 分类匹配 emoji 菜品图
  // 规则顺序很重要：先判主食（饭/面），再判具体食材，
  // 否则「牛肉盖饭」会先命中「牛」被误判成肉，「宫保鸡丁盖饭」会命中「鸡」。
  function emojiFor (food) {
    const n = String((food && food.foods_name) || '')
    const rules = [
      // 饮品（先细分茶饮，再笼统果汁）
      [/奶茶|波霸|波波|芋泥|奶绿/, '🧋'],
      [/果茶|百香果|杨枝甘露|葡萄|蜜茶/, '🍹'],
      [/柠檬|橙汁|西瓜|芒果汁|果汁|饮料/, '🥤'],
      [/咖啡/, '☕'],
      // 主食（必须早于肉类 / 禽类判断）
      [/饭/, '🍚'],
      [/面|粉|馄饨|小面/, '🍜'],
      // 菜品
      [/鱼香/, '🥩'],
      [/鱼/, '🐟'],
      [/虾/, '🦐'],
      [/豆腐|毛血旺/, '🍲'],
      [/汤/, '🍲'],
      [/薯条/, '🍟'],
      [/春卷/, '🥟'],
      [/糍粑/, '🍡'],
      [/卤味|卤/, '🍖'],
      [/鸡米花|鸡翅|辣子鸡|口水鸡|鸡/, '🍗'],
      [/牛|猪|肉|里脊|排|骨/, '🥩'],
      [/蛋/, '🍳'],
      [/黄瓜|木耳|西兰花|包菜|土豆|四季豆|豆角|蔬菜/, '🥬']
    ]
    for (let i = 0; i < rules.length; i++) if (rules[i][0].test(n)) return rules[i][1]
    const c = String((food && food.cat_id) || '')
    if (c.indexOf('2') === 0) return '🧋'
    if (c.indexOf('3') === 0) return '🍟'
    if (c.indexOf('1') === 0) return '🍲'
    return '🍽️'
  }

  const PALETTES = [
    'linear-gradient(135deg,#ffb199,#ff6b35)',
    'linear-gradient(135deg,#ffd89b,#f6a94c)',
    'linear-gradient(135deg,#a8c0ff,#3f6df0)',
    'linear-gradient(135deg,#b9f3d3,#3bb273)',
    'linear-gradient(135deg,#ffc3d8,#ff6f91)',
    'linear-gradient(135deg,#c2f0ef,#2bb3b1)'
  ]
  function imgStyle (food) {
    const id = Number((food && food.foods_id) || 0)
    return { background: PALETTES[id % PALETTES.length] }
  }

  // 解析菜品真实图片（优先 foods_logo，其次 pics[0]），返回 { src, bg } 或 null
  function photoOf (food) {
    if (!food) return null
    let url = food.foods_logo ? String(food.foods_logo) : ''
    if (!url && food.pics) {
      try {
        const arr = typeof food.pics === 'string' ? JSON.parse(food.pics) : food.pics
        if (arr && arr.length) {
          const first = arr[0]
          // 后台存的是 { pic: 'upload/xxx' }，兼容 { url } 与纯字符串
          url = typeof first === 'string' ? first : String(first.pic || first.url || '')
        }
      } catch (e) { url = '' }
    }
    url = String(url).trim()
    if (!url || url === 'null' || url === 'undefined') return null
    const clean = url.replace(/\\/g, '/').replace(/^upload\//, '').replace(/^\//, '')
    return { src: '/' + clean, bg: "url('/" + clean + "')" }
  }

  function fmtTime (unix) {
    if (!unix) return ''
    const d = new Date(Number(unix) * 1000)
    const p = n => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
  }

  // 统一的错误文案提取
  function errMsg (err, fallback) {
    if (err && err.response) {
      const d = err.response.data
      if (d && d.msg) return d.msg
      if (err.response.status === 401) return '登录已过期，请重新登录'
      return '请求失败（' + err.response.status + '）'
    }
    if (err && err.message) return '网络异常：' + err.message
    return fallback || '操作失败'
  }

  function bootFail (msg) {
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    const box = document.getElementById('app')
    if (box) {
      box.innerHTML = '<div style="max-width:520px;margin:60px auto;padding:24px;background:#fff;border-radius:12px;font-family:sans-serif;color:#333;box-shadow:0 4px 20px rgba(0,0,0,.08)">' +
        '<h3 style="margin-bottom:8px;color:#ff6b35">点餐端加载失败</h3>' +
        '<p style="line-height:1.7;color:#666;font-size:13px">' + esc(msg) + '</p>' +
        '<p style="margin-top:12px;color:#999;font-size:12px">请按 F12 打开控制台查看详细报错。</p></div>'
    }
  }

  try {
    const vm = new Vue({
      el: '#app',
      data: {
        view: 'menu',
        loading: false,
        keyword: '',
        categories: [],
        flatCats: [],
        catNameMap: {},
        activeCat: '',
        foods: [],
        cart: readJSON(CART_KEY, []),
        cartVisible: false,
        checkoutVisible: false,
        // 规格选择
        specVisible: false,
        specFood: null,
        specChoice: {},
        checkout: { name: '', phone: '', address: '', remark: '' },
        submitting: false,
        authVisible: false,
        authMode: 'login',
        auth: { username: '', password: '', mobile: '', email: '' },
        authing: false,
        user: readJSON(USER_KEY, null),
        orders: [],
        ordersLoading: false,
        orderTimer: null,
        toast: { show: false, msg: '', type: '' },
        toastTimer: null,
        // 支付
        payVisible: false,
        payOrder: null,
        payMethod: 'wechat',
        paying: false,
        payMethods: [
          { key: 'wechat', name: '微信支付', ico: '💚', bg: '#e8f7ee' },
          { key: 'alipay', name: '支付宝', ico: '💙', bg: '#e8f1fb' },
          { key: 'balance', name: '余额支付', ico: '💰', bg: '#fff6e8' }
        ]
      },
      computed: {
        cartCount () {
          return this.cart.reduce((s, c) => s + Number(c.count || 0), 0)
        },
        cartTotal () {
          return this.cart.reduce((s, c) => s + Number(c.price) * Number(c.count), 0).toFixed(2)
        },
        activeCatName () {
          const f = this.flatCats.find(c => c.path === this.activeCat)
          return f ? f.name : '全部菜品'
        }
      },
      created () {
        const token = store.getItem(TOKEN_KEY)
        if (token) api.defaults.headers.common['Authorization'] = token
        this.normalizeCart()
        this.loadCategories()
        this.loadFoods()
      },
      methods: {
        emojiFor, imgStyle, fmtTime,
        catLabel (catId) {
          return this.catNameMap[String(catId || '')] || ''
        },

        // 轻提示（方法名不能与 data 中的 toast 重名，否则会被 data 覆盖导致调用报错）
        notify (msg, type) {
          this.toast = { show: true, msg: msg, type: type || '' }
          clearTimeout(this.toastTimer)
          this.toastTimer = setTimeout(() => { this.toast.show = false }, 2200)
        },

        go (view) {
          this.view = view
          this.stopOrderPolling()
          if (view === 'orders') {
            this.loadOrders()
            this.orderTimer = setInterval(() => {
              if (this.view === 'orders' && this.user) this.loadOrders(true)
            }, 10000)
          }
        },

        // ---- 分类 / 菜品 ----
        loadCategories () {
          api.get('/categories').then(res => {
            if (res.data.status === 200) {
              this.categories = res.data.result || []
              this.buildFlatCats()
            }
          }).catch(err => {
            this.notify(errMsg(err, '分类加载失败'), 'err')
          })
        },
        buildFlatCats () {
          const flat = []
          const map = {}
          const walk = (nodes, level, parentPath) => {
            ;(nodes || []).forEach(n => {
              if (n.cat_deleted) return
              const path = (parentPath ? parentPath + ',' : '') + n.cat_id
              flat.push({ name: n.cat_name, level, path })
              map[path] = n.cat_name
              if (n.children && n.children.length) walk(n.children, level + 1, path)
            })
          }
          walk(this.categories, 0, '')
          this.flatCats = flat
          this.catNameMap = map
        },
        selectCat (path) {
          this.activeCat = path
          this.loadFoods()
        },
        loadFoods () {
          this.loading = true
          const params = {}
          const kw = this.keyword.trim()
          if (kw) params.search = kw
          if (this.activeCat) params.cat_id = this.activeCat
          api.get('/foods', { params }).then(res => {
            const list = res.data.status === 200 ? (res.data.result || []) : []
            this.foods = list.map(f => {
              f.photo = photoOf(f)
              return f
            })
            this.syncCartStock()
          }).catch(err => {
            this.foods = []
            this.notify(errMsg(err, '菜品加载失败'), 'err')
          }).finally(() => { this.loading = false })
        },
        // 用最新菜品数据同步购物车里的价格/库存/名称，防止后台改价改库存后本地数据过期
        syncCartStock () {
          const idx = {}
          this.foods.forEach(f => { idx[f.foods_id] = f })
          this.cart.forEach(c => {
            const f = idx[c.foods_id]
            if (!f) return
            c.name = f.foods_name
            c.price = f.foods_price
            c.stock = Number(f.foods_number)
          })
          this.persistCart()
        },

        // ---- 购物车 ----
        // 条目以「菜品 + 规格组合」为唯一键，同一道菜不同辣度算两条
        cartKeyOf (foodsId, attrs) {
          if (!attrs) return String(foodsId) + '|'
          const k = Object.keys(attrs).sort().map(n => n + ':' + attrs[n]).join(',')
          return String(foodsId) + '|' + k
        },
        // 兼容旧版购物车（无 key 字段），并合并重复项
        normalizeCart () {
          const list = []
          ;(this.cart || []).forEach(c => {
            if (!c || !c.foods_id) return
            const attrs = c.attrs && Object.keys(c.attrs).length ? c.attrs : null
            const key = c.key || this.cartKeyOf(c.foods_id, attrs)
            const hit = list.find(x => x.key === key)
            if (hit) { hit.count += Number(c.count || 1); return }
            list.push({
              key: key,
              foods_id: c.foods_id,
              name: c.name,
              price: c.price,
              count: Number(c.count || 1),
              stock: Number(c.stock || 99),
              attrs: attrs,
              attrText: c.attrText || ''
            })
          })
          this.cart = list
        },
        // 同一菜品在购物车中的总数量（跨规格汇总）
        cartQty (foodsId) {
          return this.cart
            .filter(c => c.foods_id === foodsId)
            .reduce((s, c) => s + Number(c.count || 0), 0)
        },
        hasSpecs (food) {
          return !!(food && food.specs && food.specs.length)
        },
        pushCart (food, attrs, attrText) {
          const key = this.cartKeyOf(food.foods_id, attrs)
          const item = this.cart.find(c => c.key === key)
          const stock = Number(food.foods_number)
          // 跨规格汇总校验：同一菜品所有规格的总数不能超过库存
          const curTotal = this.cartQty(food.foods_id)
          if (curTotal >= stock) return this.notify('「' + food.foods_name + '」库存不足', 'err')
          if (item) {
            item.count++
          } else {
            this.cart.push({
              key: key,
              foods_id: food.foods_id,
              name: food.foods_name,
              price: food.foods_price,
              count: 1,
              stock: stock,
              attrs: attrs || null,
              attrText: attrText || ''
            })
          }
          this.persistCart()
        },
        addToCart (food) {
          this.pushCart(food, null, '')
        },
        // 打开规格选择，默认选中每项第一档
        openSpec (food) {
          const choice = {}
          ;(food.specs || []).forEach(s => { choice[s.name] = s.vals[0] })
          this.specChoice = choice
          this.specFood = food
          this.specVisible = true
        },
        confirmSpec () {
          const f = this.specFood
          if (!f) return
          const attrs = {}
          const parts = []
          ;(f.specs || []).forEach(s => {
            const v = this.specChoice[s.name]
            if (!v) return
            attrs[s.name] = v
            parts.push(v)
          })
          this.specVisible = false
          this.specFood = null
          this.pushCart(f, attrs, parts.join(' / '))
          this.notify('已加入购物车')
        },
        changeCount (key, delta) {
          const item = this.cart.find(c => c.key === key)
          if (!item) return
          if (delta > 0) {
            const curTotal = this.cartQty(item.foods_id)
            if (curTotal >= Number(item.stock)) return this.notify('「' + item.name + '」库存不足', 'err')
          }
          item.count += delta
          if (item.count <= 0) {
            this.cart = this.cart.filter(c => c.key !== key)
          }
          this.persistCart()
        },
        clearCart () {
          this.cart = []
          this.persistCart()
        },
        persistCart () {
          store.setItem(CART_KEY, JSON.stringify(this.cart))
        },
        openCart () { this.cartVisible = true },

        // ---- 下单 ----
        openCheckout () {
          if (!this.user) {
            this.cartVisible = false
            this.openAuth('login')
            this.notify('请先登录后再下单')
            return
          }
          if (!this.cart.length) return this.notify('购物车是空的')
          this.cartVisible = false
          this.checkoutVisible = true
        },
        submitOrder () {
          const { name, phone, address, remark } = this.checkout
          if (!name.trim()) return this.notify('请填写收货人', 'err')
          if (!/^1\d{10}$/.test(phone)) return this.notify('请填写正确的手机号', 'err')
          if (address.trim().length < 5) return this.notify('请填写完整收货地址', 'err')
          if (!this.cart.length) return this.notify('购物车是空的', 'err')

          // 提交前用最新菜品数据做二次库存校验，避免本地购物车数据过期导致下单失败
          const stockMap = {}
          this.foods.forEach(f => { stockMap[f.foods_id] = Number(f.foods_number) })
          const sum = {}
          this.cart.forEach(c => { sum[c.foods_id] = (sum[c.foods_id] || 0) + Number(c.count) })
          for (const id in sum) {
            const f = this.foods.find(x => String(x.foods_id) === String(id))
            if (!f) return this.notify('部分菜品已下架，请刷新菜单后重试', 'err')
            if (stockMap[id] <= 0) return this.notify('「' + f.foods_name + '」已售罄', 'err')
            if (sum[id] > stockMap[id]) return this.notify('「' + f.foods_name + '」库存不足，仅剩 ' + stockMap[id] + ' 份', 'err')
          }

          const items = this.cart.map(c => {
            const o = { foods_id: c.foods_id, count: c.count }
            if (c.attrs && Object.keys(c.attrs).length) o.attrs = c.attrs
            return o
          })
          const fullAddress = name.trim() + ' ' + phone.trim() + ' ' + address.trim()
          this.submitting = true
          api.post('/orders', { address: fullAddress, remark: remark.trim(), items }).then(res => {
            if (res.data.status === 200) {
              this.notify('下单成功！')
              this.clearCart()
              this.checkoutVisible = false
              this.checkout = { name: '', phone: '', address: '', remark: '' }
              this.loadFoods()
            } else {
              this.notify(res.data.msg || '下单失败', 'err')
            }
          }).catch(err => {
            this.notify(errMsg(err, '下单失败'), 'err')
          }).finally(() => { this.submitting = false })
        },

        // ---- 我的订单 ----
        loadOrders (silent) {
          if (!this.user) return
          if (!silent) this.ordersLoading = true
          api.get('/orders').then(res => {
            if (res.data.status === 200) this.orders = res.data.result || []
          }).catch(err => {
            // 401 已由全局拦截器统一登出，这里仅负责清空与提示
            this.orders = []
            if (!silent) this.notify(errMsg(err, '订单加载失败'), 'err')
          }).finally(() => { this.ordersLoading = false })
        },
        cancelOrder (o) {
          if (o.order_status === 1) return
          if (o.pay_status === 1) return this.notify('已付款订单无法自行取消，请联系商家', 'err')
          if (o.is_send === 1) return this.notify('已发货订单无法取消', 'err')
          if (!window.confirm('确定取消该订单吗？取消后将回补库存。')) return
          api.post('/orders/' + o.order_id + '/cancel').then(res => {
            if (res.data.status === 200) {
              this.notify('订单已取消，库存已回补')
              this.loadOrders(true)
              this.loadFoods()
            } else {
              this.notify(res.data.msg || '取消失败', 'err')
            }
          }).catch(err => {
            this.notify(errMsg(err, '取消失败'), 'err')
          })
        },
        stopOrderPolling () {
          if (this.orderTimer) {
            clearInterval(this.orderTimer)
            this.orderTimer = null
          }
        },

        // ---- 支付 ----
        openPay (o) {
          if (o.order_status === 1) return this.notify('订单已取消，无法支付', 'err')
          if (o.pay_status === 1) return this.notify('订单已支付，请勿重复支付', 'err')
          this.payOrder = o
          this.payMethod = 'wechat'
          this.paying = false
          this.payVisible = true
        },
        closePay () {
          if (this.paying) return
          this.payVisible = false
          this.payOrder = null
        },
        doPay () {
          if (!this.payOrder || this.paying) return
          this.paying = true
          const orderId = this.payOrder.order_id
          // 模拟真实支付的处理延迟，让「支付处理中」可感知
          setTimeout(() => {
            api.post('/orders/' + orderId + '/pay', { method: this.payMethod }).then(res => {
              if (res.data.status === 200) {
                this.notify('支付成功！')
                this.payVisible = false
                this.payOrder = null
                this.loadOrders(true)
              } else {
                this.notify(res.data.msg || '支付失败', 'err')
              }
            }).catch(err => {
              this.notify(errMsg(err, '支付失败'), 'err')
            }).finally(() => { this.paying = false })
          }, 1500)
        },

        // ---- 认证 ----
        openAuth (mode) {
          this.authMode = mode
          this.authVisible = true
        },
        submitAuth () {
          const a = this.auth
          const isLogin = this.authMode === 'login'
          if (!a.username || !a.password) return this.notify('请输入用户名和密码', 'err')
          if (!isLogin) {
            if (!/^1\d{10}$/.test(a.mobile)) return this.notify('请填写正确的手机号', 'err')
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email)) return this.notify('请填写正确的邮箱', 'err')
          }
          this.authing = true
          const url = isLogin ? '/login' : '/register'
          // 登录只提交用户名+密码；多余字段会被后端 joi 判定为非法参数
          const payload = isLogin
            ? { username: a.username, password: a.password }
            : { username: a.username, password: a.password, mobile: a.mobile, email: a.email }
          api.post(url, payload).then(res => {
            if (res.data.status === 200) {
              this.setAuth(res.data.token, res.data.username)
              this.authVisible = false
              this.auth = { username: '', password: '', mobile: '', email: '' }
              this.notify(isLogin ? '登录成功' : '注册成功')
              if (this.view === 'orders') this.loadOrders()
            } else {
              this.notify(res.data.msg || '操作失败', 'err')
            }
          }).catch(err => {
            this.notify(errMsg(err, '操作失败'), 'err')
          }).finally(() => { this.authing = false })
        },
        setAuth (token, username) {
          store.setItem(TOKEN_KEY, token)
          store.setItem(USER_KEY, JSON.stringify({ username }))
          api.defaults.headers.common['Authorization'] = token
          this.user = { username }
        },
        logout (silent) {
          store.removeItem(TOKEN_KEY)
          store.removeItem(USER_KEY)
          delete api.defaults.headers.common['Authorization']
          this.stopOrderPolling()
          this.user = null
          this.orders = []
          if (!silent) this.notify('已退出登录')
        }
      }
    })

    // 便于控制台排查的调试句柄
    window.__csnShop = vm
    app = vm

    // 把未被捕获的错误显式暴露出来，避免再次出现「点了没反应」
    Vue.config.errorHandler = function (err) {
      console.error('[csn-shop]', err)
      try { vm.notify('页面异常：' + (err && err.message ? err.message : err), 'err') } catch (e) {}
    }
  } catch (e) {
    console.error('[csn-shop] mount failed:', e)
    bootFail((e && e.message) || String(e))
  }
})()
