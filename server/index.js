require('dotenv').config({ quiet: true })
const express = require('express')
const app = express()
const path = require('path')
const cors = require('cors')
const bodyParser = require('body-parser')
const router = require('./router')
const shopRouter = require('./shop')
const migrate = require('./migrate')
const logger = require('./logger')

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    const user = req.user ? req.user.username : '-'
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms ${user}`)
  })
  next()
})

app.use('/api/shop', shopRouter)
app.use('/api', router)
app.use(express.static('upload'))
// 顾客点餐端静态站点（与后台同源，免跨域）
// no-cache：每次走协商缓存，避免改了前端脚本后浏览器仍用旧副本
app.use('/shop', express.static(path.join(__dirname, '..', 'public-shop'), {
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache')
}))

module.exports = app

if (require.main === module) {
  migrate().finally(() => {
    app.listen(3000, () => {
      logger.info('服务已启动，监听端口 3000')
    })
  })
}
