/**
 * 批量抓取菜品真实图片并落库（幂等，可重跑）
 * 数据来源：必应图片搜索（cn.bing.com/images/search）聚合的公开网络图片。
 * 流程：菜名关键词 -> 必应搜索 -> 提取原图直链(murl) -> 下载(校验图片魔数) ->
 *       按 dish_<foods_id>.<ext> 命名保存到 upload/foods/ -> 写 food.foods_logo + food.pics
 * 运行：node server/fetch_images.js
 *
 * 说明：图片为公开网络图片，仅用于本项目本地展示；若用于正式商业发布，请替换为授权图源。
 */
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })
const { pool } = require('./config')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const q = (sql, arr) => new Promise((resolve, reject) => {
  pool.query(sql, arr || [], (err, rows) => (err ? reject(err) : resolve(rows)))
})

// 剩余 35 道无图菜品：foods_id + 搜索关键词
const MAP = [
  { id: 9, kw: '蛋炒饭' },
  { id: 11, kw: '黑糖波霸鲜奶' },
  { id: 12, kw: '柠檬水' },
  { id: 19, kw: '番茄炒蛋' },
  { id: 20, kw: '青椒肉丝' },
  { id: 22, kw: '手撕包菜' },
  { id: 23, kw: '蒜蓉西兰花' },
  { id: 24, kw: '酸辣土豆丝' },
  { id: 25, kw: '农家小炒肉' },
  { id: 26, kw: '可乐鸡翅' },
  { id: 27, kw: '扬州炒饭' },
  { id: 29, kw: '宫保鸡丁盖饭' },
  { id: 30, kw: '番茄鸡蛋盖饭' },
  { id: 31, kw: '咖喱鸡肉饭' },
  { id: 33, kw: '番茄鸡蛋面' },
  { id: 34, kw: '酸辣粉' },
  { id: 35, kw: '重庆小面' },
  { id: 36, kw: '三鲜馄饨' },
  { id: 37, kw: '原味奶茶' },
  { id: 38, kw: '芋泥波波奶茶' },
  { id: 39, kw: '抹茶奶绿' },
  { id: 41, kw: '杨枝甘露' },
  { id: 42, kw: '多肉葡萄 奶茶' },
  { id: 43, kw: '柠檬蜜茶' },
  { id: 44, kw: '鲜榨橙汁' },
  { id: 45, kw: '西瓜汁' },
  { id: 46, kw: '芒果汁' },
  { id: 47, kw: '拍黄瓜' },
  { id: 48, kw: '凉拌木耳' },
  { id: 49, kw: '卤味拼盘' },
  { id: 50, kw: '口水鸡' },
  { id: 51, kw: '鸡米花' },
  { id: 52, kw: '薯条' },
  { id: 54, kw: '春卷' },
  { id: 55, kw: '红糖糍粑' }
]

const htmlDecode = s => s
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')

const sleep = ms => new Promise(r => setTimeout(r, ms))

// 从必应图片搜索页提取候选图（原图 murl + 缩略图 turl 配对）
async function bingSearch (kw) {
  const url = 'https://cn.bing.com/images/search?q=' + encodeURIComponent(kw) + '&form=HDRSC2'
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' } })
  const html = await res.text()
  const murls = [...html.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)].map(x => htmlDecode(x[1]))
  const turls = [...html.matchAll(/turl&quot;:&quot;(.*?)&quot;/g)].map(x => htmlDecode(x[1]))
  return murls.map((murl, i) => ({ murl, turl: turls[i] || '' }))
}

// 判断图片魔数 -> 扩展名
function sniffExt (buf) {
  if (!buf || buf.length < 12) return null
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'png'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif'
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'webp'
  return null
}

async function download (url, referer) {
  const headers = { 'User-Agent': UA }
  if (referer) headers.Referer = referer
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, redirect: 'follow' })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 5000) return null // 过滤占位/错误页
    const ext = sniffExt(buf)
    if (!ext) return null
    return { buf, ext }
  } catch (e) {
    return null
  } finally {
    clearTimeout(t)
  }
}

async function fetchOne (kw) {
  const items = await bingSearch(kw)
  // 1) 优先原图 murl（前 5 个候选，依次尝试不同 referer）
  for (const it of items.slice(0, 5)) {
    if (!it.murl || !/^https?:/.test(it.murl)) continue
    let host = ''
    try { host = new URL(it.murl).origin } catch (e) {}
    let r = await download(it.murl, host)
    if (!r) r = await download(it.murl, 'https://cn.bing.com/')
    if (!r) r = await download(it.murl, null)
    if (r) return r
  }
  // 2) 回退必应缩略图 turl（稳定，约数百 px，够卡片用）
  for (const it of items.slice(0, 5)) {
    if (!it.turl) continue
    const turl = it.turl.replace(/&amp;/g, '&')
    const r = await download(turl, null)
    if (r) return r
  }
  return null
}

async function main () {
  const dir = path.join(__dirname, '..', 'upload', 'foods')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const files = fs.readdirSync(dir)
  const ok = []
  const fail = []

  for (const { id, kw } of MAP) {
    const existing = files.find(f => f.startsWith('dish_' + id + '.'))
    if (existing) {
      // 已下载过：补写库保证一致（幂等自愈）
      const rel = 'upload/foods/' + existing
      const pics = JSON.stringify([{ pic: rel }])
      await q('update food set foods_logo=?, pics=? where foods_id=?', [rel, pics, id])
      console.log('· ' + id + ' ' + kw + ' 已存在，补写库 -> ' + existing)
      ok.push({ id, kw, src: existing })
      continue
    }

    let saved = null
    try {
      saved = await fetchOne(kw)
    } catch (e) {
      fail.push({ id, kw, why: '搜索/下载异常: ' + e.message })
      console.log('✗ ' + id + ' ' + kw + ' 异常: ' + e.message)
    }

    if (!saved) {
      fail.push({ id, kw, why: '无可用图片' })
      console.log('✗ ' + id + ' ' + kw + ' 全部候选失败')
    } else {
      const fname = 'dish_' + id + '.' + saved.ext
      fs.writeFileSync(path.join(dir, fname), saved.buf)
      const rel = 'upload/foods/' + fname
      const pics = JSON.stringify([{ pic: rel }])
      await q('update food set foods_logo=?, pics=? where foods_id=?', [rel, pics, id])
      console.log('✓ ' + id + ' ' + kw + ' -> ' + fname + ' (' + saved.buf.length + 'B)')
      ok.push({ id, kw, src: fname })
    }
    await sleep(500)
  }

  console.log('\n=== 完成：成功 ' + ok.length + '/' + MAP.length + '，失败 ' + fail.length + ' ===')
  if (fail.length) {
    console.log('失败清单：')
    fail.forEach(f => console.log('  ' + f.id + ' ' + f.kw + ' — ' + f.why))
  }
  pool.end()
}

main().catch(e => {
  console.error('脚本失败：', e)
  pool.end()
  process.exitCode = 1
})
