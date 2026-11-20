/**
 * 招牌菜图片落库脚本（幂等）
 * 把 upload/foods/ 下已生成的菜品图重命名为 dish_<foods_id>.png，
 * 并写入 food.foods_logo 与 food.pics（与后台上传格式 { pic } 保持一致）。
 * 运行：node server/seed_images.js
 */
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })
const { pool } = require('./config')

const q = (sql, arr) => new Promise((resolve, reject) => {
  pool.query(sql, arr || [], (err, rows) => (err ? reject(err) : resolve(rows)))
})

// 菜名关键词 -> foods_id（与生成的图片文件名关键词一致）
const MAP = [
  { id: 1, name: '红烧肉' },
  { id: 6, name: '麻婆豆腐' },
  { id: 7, name: '宫保鸡丁' },
  { id: 8, name: '水煮鱼' },
  { id: 10, name: '珍珠奶茶' },
  { id: 13, name: '回锅肉' },
  { id: 14, name: '鱼香肉丝' },
  { id: 15, name: '辣子鸡' },
  { id: 16, name: '毛血旺' },
  { id: 17, name: '干煸四季豆' },
  { id: 18, name: '水煮牛肉' },
  { id: 21, name: '糖醋里脊' },
  { id: 28, name: '牛肉盖饭' },
  { id: 32, name: '红烧牛肉面' },
  { id: 40, name: '满杯百香果' },
  { id: 53, name: '炸鸡翅' }
]

async function main () {
  const dir = path.join(__dirname, '..', 'upload', 'foods')
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'))
  let ok = 0

  for (const { id, name } of MAP) {
    // 已重命名过的直接跳过文件查找，但也要保证 DB 已写
    const target = 'dish_' + id + '.png'
    const targetPath = path.join(dir, target)

    if (!fs.existsSync(targetPath)) {
      const src = files.find(f => f.includes(name) && !f.startsWith('dish_'))
      if (!src) { console.log('✗ 未找到图片：' + name); continue }
      fs.renameSync(path.join(dir, src), targetPath)
    }

    const rel = 'upload/foods/' + target
    const pics = JSON.stringify([{ pic: rel }])
    await q('update food set foods_logo=?, pics=? where foods_id=?', [rel, pics, id])
    console.log('✓ ' + name + ' -> ' + target)
    ok++
  }

  console.log('\n完成：' + ok + '/' + MAP.length + ' 道菜已配置图片')
  pool.end()
}

main().catch(e => {
  console.error('失败：', e.message)
  pool.end()
  process.exitCode = 1
})
