/**
 * 菜单数据重置脚本（幂等，可反复执行）
 * 作用：按 server/menu_data.js 全量覆盖分类树、修正/补齐菜品、配置可选规格
 * 运行：node server/seed_menu.js
 * 注意：本脚本会覆盖后台对菜名/价格/描述/分类的改动，仅用于重置菜单
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })

const { pool } = require('./config')
const { tree, dishes, specs } = require('./menu_data')

const q = (sql, arr) =>
  new Promise((resolve, reject) => {
    pool.query(sql, arr || [], (err, rows) => (err ? reject(err) : resolve(rows)))
  })

async function main () {
  const now = Math.floor(Date.now() / 1000)

  // 1) 重建分类树
  await q('update foodscate set children=? where id=1', [JSON.stringify(tree)])
  const countNodes = (nodes, level, acc) => {
    nodes.forEach(n => {
      acc[level] = (acc[level] || 0) + 1
      if (n.children) countNodes(n.children, level + 1, acc)
    })
    return acc
  }
  const lv = countNodes(tree, 1, {})
  console.log('[1/5] 分类树已重建：' + Object.keys(lv).map(k => lv[k] + ' 个' + k + '级分类').join(' / '))

  // 2) 清理脏数据
  const junk = await q("delete from food where foods_name in ('hh','11','123') or foods_price is null")
  console.log('[2/5] 清理脏数据 ' + (junk.affectedRows || 0) + ' 条')

  // 3) 写入规格字典（按 attr_name + cat_id 覆盖）
  let specAdded = 0
  for (const s of specs) {
    const exists = await q('select attr_id from cateparams where attr_name=? and cat_id=?', [s.name, s.cat])
    if (exists.length) {
      await q('update cateparams set attr_vals=?, attr_write=? where attr_id=?', [s.vals, 'list', exists[0].attr_id])
    } else {
      await q('insert into cateparams (attr_name,cat_id,attr_sel,attr_write,attr_vals) values (?,?,?,?,?)',
        [s.name, s.cat, 'many', 'list', s.vals])
      specAdded++
    }
  }
  console.log('[3/5] 规格字典：新增 ' + specAdded + ' 项，更新 ' + (specs.length - specAdded) + ' 项')

  // 4) 修正 / 新增菜品
  let updated = 0
  let inserted = 0
  for (const d of dishes) {
    if (d.id) {
      await q(
        'update food set foods_name=?, cat_id=?, foods_price=?, foods_number=?, foods_weight=?, foods_introduce=?, goods_state=1, is_promote=?, upd_time=? where foods_id=?',
        [d.name, d.cat, d.price, d.num, d.weight, d.desc, d.hot, now, d.id]
      )
      updated++
    } else {
      const exist = await q('select foods_id from food where foods_name=?', [d.name])
      if (exist.length) {
        await q(
          'update food set cat_id=?, foods_price=?, foods_number=?, foods_weight=?, foods_introduce=?, goods_state=1, is_promote=?, upd_time=? where foods_id=?',
          [d.cat, d.price, d.num, d.weight, d.desc, d.hot, now, exist[0].foods_id]
        )
        updated++
      } else {
        await q(
          'insert into food (foods_name,foods_price,cat_id,foods_number,foods_weight,foods_introduce,foods_logo,add_time,upd_time,goods_state,is_promote,pics,attrs) values (?,?,?,?,?,?,null,?,?,1,?,null,null)',
          [d.name, d.price, d.cat, d.num, d.weight, d.desc, now, now, d.hot]
        )
        inserted++
      }
    }
  }
  console.log('[4/5] 菜品写入：修正 ' + updated + ' 条，新增 ' + inserted + ' 条')

  // 5) 统计
  const stat = await q(
    'select count(*) as total, sum(is_promote=1) as hot from food where (goods_state is null or goods_state=1)'
  )
  console.log('[5/5] 当前在售菜品：' + stat[0].total + ' 条，其中热销 ' + stat[0].hot + ' 条')

  const byCat = await q('select cat_id, count(*) as c from food group by cat_id order by cat_id')
  console.log('分类分布：')
  byCat.forEach(r => console.log('  ' + r.cat_id + ' → ' + r.c + ' 条'))

  pool.end()
}

main().catch(e => {
  console.error('种子脚本失败：', e.message)
  pool.end()
  process.exitCode = 1
})
