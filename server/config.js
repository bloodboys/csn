const mysql = require('mysql')
const logger = require('./logger')

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'csn',
  typeCast: function (field, next) {
    // TINYINT(1) 默认会被 mysql 包转成 Boolean，这里统一返回数字 0/1，
    // 避免前端 switch / 标签判断因类型不一致而显示错误
    if (field.type === 'TINY' && field.length === 1) {
      return field.string() === '1' ? 1 : 0
    }
    return next()
  }
})

const sqlClient = (sql, arr, callback) => {
  pool.query(sql, arr, (error, result) => {
    if (error) {
      logger.error('数据库查询失败：' + error.message)
      return
    }
    callback(result)
  })
}

sqlClient.close = () => pool.end()

module.exports = sqlClient
