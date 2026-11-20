import axios from 'axios'
import store from '../store'
import { Message } from 'element-ui'

/**
 * 处理失败的方法
 * status:状态码
 * info:信息
 */
const errorHandle = (status, info) => {
  switch (status) {
    case 400:
      console.log('语义有误，当前请求无法被服务器理解。除非进行修改，否则客户端不应该重复提交这个请求。')
      break
    case 401:
      // token:令牌
      console.log('服务器认证失败')
      break
    case 403:
      console.log('服务器已经理解请求，但是拒绝执行它')
      break
    case 404:
      console.log('请检查网络请求地址')
      break
    case 500:
      console.log('服务器遇到了一个未曾预料的状况，导致了它无法完成对请求的处理。一般来说，这个问题都会在服务器的程序码出错时出现。')
      break
    case 502:
      console.log('作为网关或者代理工作的服务器尝试执行请求时，从上游服务器接收到无效的响应。')
      break
    default:
      console.log(info)
      break
  }
}

/**
 * 创建axios实例对象
 */

const instance = axios.create({
  // 公共配置
  timeout: 5000
})

/**
 * 处理拦截器
 */

/**
 * 请求拦截
 */
instance.interceptors.request.use(
  config => {
    // 为请求头对象添加token验证的authorization
    // 优先取 store，页面刷新后 store 重置则回退到 localStorage，避免请求 401
    let token = store.state.login.user.token
    if (!token) {
      try {
        token = JSON.parse(localStorage.getItem('csn') || '{}').token || ''
      } catch (e) {
        token = ''
      }
    }
    if (token) {
      config.headers.authorization = token
    }
    return config
  },
  error => Promise.reject(error)
)

/**
 * 响应拦截
 */
instance.interceptors.response.use(
  // 完成了
  response => response.status === 200 ? Promise.resolve(response) : Promise.reject(response),
  error => {
    const {
      response
    } = error
    if (!response) {
      console.log('网络错误或服务器无响应')
      return Promise.reject(error)
    }
    errorHandle(response.status, response.statusText)
    // 401 未登录/token 失效时清理本地登录态并跳转登录页
    if (response.status === 401) {
      localStorage.removeItem('csn')
      store.commit('login/setUser', { username: '', token: '', rid: null, rights: [] })
      if (window.location.hash.indexOf('/login') === -1) {
        window.location.hash = '#/login'
      }
    }
    // 403 无权限提示
    if (response.status === 403) {
      Message.error(response.data && response.data.msg ? response.data.msg : '无权限操作')
    }
    // 400 参数错误提示
    if (response.status === 400) {
      Message.error(response.data && response.data.msg ? response.data.msg : '请求参数错误')
    }
    return Promise.reject(error)
  }
)

export default instance
