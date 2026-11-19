import router from './index'
// import store from '../store'

router.beforeEach((to, from, next) => {
  // to 将要访问的路径
  // from 代表从哪个路径跳转而来
  // next 是一个函数，代表放行
  // next() 放行 next(/login) 强制跳转
  if (to.path === '/login') return next()
  // 获取token
  const tokenStr = localStorage.getItem('csn')
  if (!tokenStr) return next('/login')
  // 管理员专属页面（写操作页面），普通用户直接访问时重定向回列表
  const adminOnlyPaths = ['/foodlist/add']
  if (adminOnlyPaths.indexOf(to.path) !== -1) {
    try {
      const user = JSON.parse(tokenStr)
      if (user.rid !== 1) {
        return next('/foodlist')
      }
    } catch (e) {
      return next('/login')
    }
  }
  next()
})
