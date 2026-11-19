const winston = require('winston')
const path = require('path')
const fs = require('fs')

// 确保日志目录存在
const logDir = path.join(__dirname, '../logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}] ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' })
  ]
})

module.exports = logger
