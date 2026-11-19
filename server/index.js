require('dotenv').config({ quiet: true })
const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const router = require('./router')
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

app.use('/api', router)
app.use(express.static('upload'))

module.exports = app

if (require.main === module) {
  app.listen(3000, () => {
    logger.info('服务已启动，监听端口 3000')
  })
}
