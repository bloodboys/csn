/**
 * csn 顾客点餐端 API（挂在 /api/shop，独立顾客 JWT，不经过后台管理员鉴权）
 * 与后台「菜品管理 / 订单管理」共享同一数据库，实现点餐-接单闭环：
 *   顾客浏览上架菜品 -> 下单（事务：写订单 + 明细 + 扣库存）
 *   -> 后台订单管理可见并改状态/加物流 -> 顾客「我的订单」回显
 */
const express = require('express')
const shop = express.Router()
const pool = require('./config').pool
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const Joi = require('joi')
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = '24h'

// promisified 查询（出错 reject）
const pq = (sql, arr) => new Promise((resolve, reject) => {
  pool.query(sql, arr || [], (err, result) => {
    if (err) return reject(err)
    resolve(result)
  })
})

const nowSec = () => Math.floor(Date.now() / 1000)
const p2 = n => String(n).padStart(2, '0')
const fmtStamp = (sec) => {
  const d = new Date(Number(sec) * 1000)
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) +
    ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds())
}
const nowStr = () => fmtStamp(nowSec())

// 模拟物流：按「下单时间 + 固定偏移」动态推算节点（抽到 server/logistics.js，与后台共用）
const { computeLogistics } = require('./logistics')

const sign = (user) => jwt.sign(
  { id: user.id, username: user.username, rid: user.rid, customer: true },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES_IN }
)

const validateBody = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body)
  if (error) {
    return res.status(400).send({ status: 400, msg: '参数错误：' + error.details[0].message })
  }
  next()
}
const num = () => Joi.alternatives().try(Joi.number(), Joi.string().pattern(/^\d+$/))

// ---- 可选规格（辣度 / 糖度 / 冰量）----
// cateparams.cat_id 存 "[1,1,1]"，菜品 cat_id 存 "1,1,1"，这里统一成路径字符串
const catPath = (v) => String(v || '').replace(/[\[\]\s]/g, '')

// 点餐端不展示的规格：份量当前没有加价规则，避免顾客以为选大份会加价
const HIDDEN_SPECS = ['份量']

let specCache = null
let specCacheAt = 0

// 读取规格字典 -> { "1,1,1": [{ name, vals }] }，30 秒缓存避免每单都查库
async function loadSpecs (force) {
  const now = Date.now()
  if (!force && specCache && now - specCacheAt < 30000) return specCache
  const rows = await pq('select attr_name, cat_id, attr_write, attr_vals from cateparams')
  const map = {}
  rows.forEach(r => {
    if (r.attr_write !== 'list') return                       // 手填类规格不入点餐端
    if (HIDDEN_SPECS.indexOf(r.attr_name) !== -1) return
    const vals = String(r.attr_vals || '').split(',').map(s => s.trim()).filter(Boolean)
    if (!vals.length) return
    const p = catPath(r.cat_id)
    if (!p) return
    ;(map[p] = map[p] || []).push({ name: r.attr_name, vals })
  })
  specCache = map
  specCacheAt = now
  return map
}

// 取某菜品可用规格：从最具体的分类向父级回溯，同名规格以更具体的为准
function specsFor (map, catId) {
  const parts = String(catId || '').split(',')
  const out = []
  const seen = {}
  for (let i = parts.length; i > 0; i--) {
    const list = map[parts.slice(0, i).join(',')] || []
    list.forEach(s => {
      if (seen[s.name]) return
      seen[s.name] = 1
      out.push(s)
    })
  }
  return out
}

// 校验顾客提交的规格，返回展示文案（如「中辣 / 少冰」）；非法取值直接抛错
function normalizeAttrs (map, catId, attrs) {
  if (!attrs || typeof attrs !== 'object') return null
  const allowed = specsFor(map, catId)
  if (!allowed.length) return null
  const picked = []
  for (const s of allowed) {
    const v = attrs[s.name]
    if (v === undefined || v === null || v === '') continue
    if (s.vals.indexOf(String(v)) === -1) throw new Error('「' + s.name + '」不支持选项：' + v)
    picked.push(String(v))
  }
  return picked.length ? picked.join(' / ') : null
}

// 顾客登录态校验（仅接受 customer token）
const auth = (req, res, next) => {
  const token = req.headers.authorization
  if (!token) return res.status(401).send({ status: 401, msg: '请先登录' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (!payload.customer) throw new Error('not customer')
    req.customer = payload
    next()
  } catch (e) {
    return res.status(401).send({ status: 401, msg: '登录已过期，请重新登录' })
  }
}

// ---- 公开浏览（无需登录）----

// 菜品分类树
shop.get('/categories', async (req, res) => {
  try {
    const rows = await pq('select children from foodscate where id=1')
    let tree = []
    if (rows[0] && rows[0].children) {
      try { tree = JSON.parse(rows[0].children) } catch (e) { tree = [] }
    }
    res.send({ status: 200, result: tree })
  } catch (e) {
    res.status(500).send({ status: 500, msg: '获取分类失败' })
  }
})

// 上架菜品列表（可按分类 / 关键字过滤）
shop.get('/foods', async (req, res) => {
  const cat = (req.query.cat_id || '').trim()
  const kw = (req.query.search || '').trim()
  let sql = 'select * from food where (goods_state is null or goods_state=1)'
  const arr = []
  if (kw) { sql += ' and foods_name like ?'; arr.push('%' + kw + '%') }
  if (cat) { sql += ' and (cat_id=? or cat_id like ?)'; arr.push(cat, cat + ',%') }
  sql += ' order by foods_id asc'
  try {
    const rows = await pq(sql, arr)
    const map = await loadSpecs()
    rows.forEach(f => { f.specs = specsFor(map, f.cat_id) })
    res.send({ status: 200, result: rows })
  } catch (e) {
    res.status(500).send({ status: 500, msg: '获取菜品失败' })
  }
})

// 菜品详情
shop.get('/foods/:id', async (req, res) => {
  try {
    const rows = await pq('select * from food where foods_id=? and (goods_state is null or goods_state=1)', [req.params.id])
    if (!rows.length) return res.status(404).send({ status: 404, msg: '菜品不存在' })
    const map = await loadSpecs()
    const f = rows[0]
    f.specs = specsFor(map, f.cat_id)
    res.send({ status: 200, result: f })
  } catch (e) {
    res.status(500).send({ status: 500, msg: '获取菜品失败' })
  }
})

// ---- 顾客账号 ----

// 注册
shop.post('/register', validateBody(Joi.object({
  username: Joi.string().trim().min(3).max(10).pattern(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/).required(),
  password: Joi.string().min(6).max(15).required(),
  mobile: Joi.string().pattern(/^1[0-9]{10}$/).required(),
  email: Joi.string().email().required()
})), async (req, res) => {
  const { password, mobile, email } = req.body
  const username = (req.body.username || '').trim()
  try {
    const exists = await pq('select id from user where username=?', [username])
    if (exists.length) return res.send({ status: 400, msg: '用户名已存在' })
    const hash = bcrypt.hashSync(password, 10)
    await pq("insert into user (rid,username,password,mobile,email,mg_state,role_name) values (3,?,?,?,?,1,'顾客')", [username, hash, mobile, email])
    const rows = await pq('select id,username,rid from user where username=?', [username])
    res.send({ status: 200, msg: '注册成功', token: sign(rows[0]), username })
  } catch (e) {
    res.status(500).send({ status: 500, msg: '注册失败' })
  }
})

// 登录（仅限顾客账号 rid=3）
shop.post('/login', validateBody(Joi.object({
  username: Joi.string().trim().required(),
  password: Joi.string().required()
})), async (req, res) => {
  const { password } = req.body
  const username = (req.body.username || '').trim()
  try {
    const rows = await pq('select id,username,password,rid from user where username=?', [username])
    if (!rows.length) return res.send({ status: 401, msg: '账号或密码错误' })
    const u = rows[0]
    if (u.rid !== 3) return res.send({ status: 403, msg: '该账号不是顾客账号，请使用点餐端注册的账号' })
    const stored = u.password || ''
    const valid = stored.indexOf('$2') === 0 ? bcrypt.compareSync(password, stored) : stored === password
    if (!valid) return res.send({ status: 401, msg: '账号或密码错误' })
    res.send({ status: 200, token: sign(u), username: u.username })
  } catch (e) {
    res.status(500).send({ status: 500, msg: '登录失败' })
  }
})

// 当前顾客信息
shop.get('/me', auth, async (req, res) => {
  try {
    const rows = await pq('select id,username,mobile,email,role_name from user where id=?', [req.customer.id])
    res.send({ status: 200, result: rows[0] || {} })
  } catch (e) {
    res.status(500).send({ status: 500, msg: '获取用户信息失败' })
  }
})

// ---- 下单 ----

// 提交订单（事务：加锁校验库存 -> 写订单 -> 写明细 -> 扣库存）
shop.post('/orders', auth, validateBody(Joi.object({
  address: Joi.string().min(2).max(255).required(),
  remark: Joi.string().allow('').max(100).optional(),
  items: Joi.array().min(1).max(50).items(Joi.object({
    foods_id: num().required(),
    count: Joi.number().integer().min(1).max(99).required(),
    attrs: Joi.object().pattern(Joi.string().max(20), Joi.string().max(30)).optional()
  })).required()
})), async (req, res) => {
  const { address, remark, items } = req.body
  const conn = await new Promise((resolve, reject) => {
    pool.getConnection((e, c) => (e ? reject(e) : resolve(c)))
  })
  const cq = (sql, arr) => new Promise((resolve, reject) => {
    conn.query(sql, arr || [], (e, r) => (e ? reject(e) : resolve(r)))
  })
  try {
    const specMap = await loadSpecs()
    // 合并相同「菜品 + 规格」的条目，避免重复明细 / 重复扣库存
    const mergedMap = new Map()
    for (const it of items) {
      const sig = String(it.foods_id) + '|' + JSON.stringify(it.attrs || {})
      const cur = mergedMap.get(sig)
      if (cur) cur.count += Number(it.count)
      else mergedMap.set(sig, { foods_id: Number(it.foods_id), count: Number(it.count), attrs: it.attrs || {} })
    }
    const mergedItems = Array.from(mergedMap.values())
    // 同一菜品不同规格会拆成多条明细，但库存必须按「菜品总量」校验，
    // 否则可绕过前端、直接调 API 用多个规格合计超卖（此前已踩坑：库存 35 被 60 超卖到 -25）
    const demandByFood = {}
    for (const it of mergedItems) {
      demandByFood[it.foods_id] = (demandByFood[it.foods_id] || 0) + Number(it.count)
    }
    await cq('START TRANSACTION')
    let total = 0
    const snapshots = []
    const stockChecked = {} // 已锁行并校验过库存的菜品，避免同菜多规格重复读行
    for (const it of mergedItems) {
      const fid = Number(it.foods_id)
      let f = stockChecked[fid]
      if (!f) {
        const rows = await cq('select * from food where foods_id=? for update', [fid])
        if (!rows.length) throw new Error('菜品不存在（id=' + fid + '）')
        f = rows[0]
        if (f.goods_state === 0) throw new Error('「' + f.foods_name + '」已下架')
        if (Number(f.foods_number) < demandByFood[fid]) throw new Error('「' + f.foods_name + '」库存不足')
        stockChecked[fid] = f
      }
      const attrText = normalizeAttrs(specMap, f.cat_id, it.attrs)
      total += Number(f.foods_price) * Number(it.count)
      snapshots.push({ id: fid, name: f.foods_name, price: f.foods_price, count: Number(it.count), attr: attrText })
    }
    const orderNumber = 'D' + nowSec() + String(Math.floor(Math.random() * 1000)).padStart(3, '0')
    const createTime = nowSec()
    const logistics = JSON.stringify([{ time: nowStr(), context: '订单已提交' }])
    const ins = await cq(
      'insert into orders (order_number,order_price,pay_status,is_send,order_status,create_time,logistics,address,user_id) values (?,?,0,0,0,?,?,?,?)',
      [orderNumber, total.toFixed(2), createTime, logistics, address, req.customer.id]
    )
    const orderId = ins.insertId
    for (const s of snapshots) {
      await cq('insert into order_items (order_id,foods_id,foods_name,foods_price,count,attr_text) values (?,?,?,?,?,?)',
        [orderId, s.id, s.name, s.price, s.count, s.attr])
      await cq('update food set foods_number = foods_number - ? where foods_id=?', [s.count, s.id])
    }
    await cq('COMMIT')
    res.send({ status: 200, msg: '下单成功', order_id: orderId, order_number: orderNumber })
  } catch (e) {
    await cq('ROLLBACK').catch(() => {})
    res.send({ status: 400, msg: e.message || '下单失败' })
  } finally {
    conn.release()
  }
})

// 我的订单（含明细与物流）
shop.get('/orders', auth, async (req, res) => {
  try {
    const orders = await pq('select * from orders where user_id=? order by create_time desc', [req.customer.id])
    for (const o of orders) {
      const items = await pq('select * from order_items where order_id=?', [o.order_id])
      o.items = items
      o.logistics = computeLogistics(o.create_time, Number(o.pay_status) === 1, o.pay_time)
      // 有效发货状态：手动发货 OR 物流已自动发货（骑手取餐）；已取消订单视为未发货
      o.is_send = (o.order_status !== 1 && (o.is_send === 1 || o.logistics.autoSend)) ? 1 : 0
    }
    res.send({ status: 200, result: orders })
  } catch (e) {
    res.status(500).send({ status: 500, msg: '获取订单失败' })
  }
})

// 取消订单：仅「未付款 + 未发货 + 未取消」可取消，事务内回补库存并标记已取消
shop.post('/orders/:id/cancel', auth, async (req, res) => {
  const orderId = Number(req.params.id)
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.send({ status: 400, msg: '订单参数错误' })
  }
  const conn = await new Promise((resolve, reject) => {
    pool.getConnection((e, c) => (e ? reject(e) : resolve(c)))
  })
  const cq = (sql, arr) => new Promise((resolve, reject) => {
    conn.query(sql, arr || [], (e, r) => (e ? reject(e) : resolve(r)))
  })
  try {
    await cq('START TRANSACTION')
    const rows = await cq('select * from orders where order_id=? and user_id=? for update', [orderId, req.customer.id])
    if (!rows.length) throw new Error('订单不存在')
    const o = rows[0]
    if (o.order_status === 1) throw new Error('订单已取消，请勿重复操作')
    if (o.pay_status === 1) throw new Error('已付款订单无法自行取消，请联系商家处理')
    const logi = computeLogistics(o.create_time, Number(o.pay_status) === 1, o.pay_time)
    if (o.is_send === 1 || logi.autoSend) throw new Error('已发货订单无法取消')
    const items = await cq('select foods_id, count from order_items where order_id=?', [orderId])
    for (const it of items) {
      await cq('update food set foods_number = foods_number + ? where foods_id=?', [it.count, it.foods_id])
    }
    await cq('update orders set order_status=1 where order_id=?', [orderId])
    await cq('COMMIT')
    res.send({ status: 200, msg: '订单已取消，库存已回补' })
  } catch (e) {
    await cq('ROLLBACK').catch(() => {})
    res.send({ status: 400, msg: e.message || '取消失败' })
  } finally {
    conn.release()
  }
})

// 模拟支付：仅「未取消 + 未付款」可支付，事务内锁定订单防并发重复支付，记录支付时间与支付单号
shop.post('/orders/:id/pay', auth, validateBody(Joi.object({
  method: Joi.string().valid('wechat', 'alipay', 'balance').optional()
})), async (req, res) => {
  const orderId = Number(req.params.id)
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.send({ status: 400, msg: '订单参数错误' })
  }
  const conn = await new Promise((resolve, reject) => {
    pool.getConnection((e, c) => (e ? reject(e) : resolve(c)))
  })
  const cq = (sql, arr) => new Promise((resolve, reject) => {
    conn.query(sql, arr || [], (e, r) => (e ? reject(e) : resolve(r)))
  })
  try {
    await cq('START TRANSACTION')
    const rows = await cq('select * from orders where order_id=? and user_id=? for update', [orderId, req.customer.id])
    if (!rows.length) throw new Error('订单不存在')
    const o = rows[0]
    if (o.order_status === 1) throw new Error('订单已取消，无法支付')
    if (o.pay_status === 1) throw new Error('订单已支付，请勿重复支付')
    const payNumber = 'PAY' + nowSec() + String(Math.floor(Math.random() * 1000)).padStart(3, '0')
    const payTime = nowSec()
    await cq('update orders set pay_status=1, pay_time=? where order_id=?', [payTime, orderId])
    await cq('COMMIT')
    res.send({ status: 200, msg: '支付成功', pay_number: payNumber, pay_time: fmtStamp(payTime) })
  } catch (e) {
    await cq('ROLLBACK').catch(() => {})
    res.send({ status: 400, msg: e.message || '支付失败' })
  } finally {
    conn.release()
  }
})

module.exports = shop
