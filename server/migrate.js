/**
 * csn 顾客点餐端数据库迁移（幂等，可重复执行）
 * 1. 确保 roles 存在 id=3 的「顾客」角色
 * 2. 确保 orders 表存在 user_id 列（用于关联下单顾客）
 * 3. 确保演示顾客账号 xiaomei 存在
 * 4. 补一批演示菜品（按名称去重，不覆盖已有数据）
 */
const pool = require('./config').pool
const bcrypt = require('bcryptjs')
const logger = require('./logger')
const menu = require('./menu_data')

// promisified 查询（出错直接 reject，避免 config.sqlClient 吞错导致的挂起）
const pq = (sql, arr) => new Promise((resolve, reject) => {
  pool.query(sql, arr || [], (err, result) => {
    if (err) return reject(err)
    resolve(result)
  })
})

async function ensureRole () {
  const rows = await pq('select id from roles where id=3')
  if (!rows.length) {
    await pq("insert into roles (id,roleName,roleDesc,children) values (3,'顾客','外卖点餐端顾客','[]')")
    logger.info('[migrate] 已创建顾客角色 rid=3')
  }
}

async function ensureOrderUserId () {
  const cols = await pq("select column_name from information_schema.columns where table_schema='csn' and table_name='orders' and column_name='user_id'")
  if (!cols.length) {
    await pq('alter table orders add column user_id int default null')
    logger.info('[migrate] 已为 orders 表添加 user_id 列')
  }
}

// 订单状态：0=正常/进行中，1=已取消（取消未付款订单时回补库存）
async function ensureOrderStatus () {
  const cols = await pq("select column_name from information_schema.columns where table_schema='csn' and table_name='orders' and column_name='order_status'")
  if (!cols.length) {
    await pq('alter table orders add column order_status tinyint default 0')
    logger.info('[migrate] 已为 orders 表添加 order_status 列')
  }
}

// 支付时间：模拟真实付款时记录支付时间戳（NULL 表示未付款）
async function ensureOrderPayTime () {
  const cols = await pq("select column_name from information_schema.columns where table_schema='csn' and table_name='orders' and column_name='pay_time'")
  if (!cols.length) {
    await pq('alter table orders add column pay_time bigint default null')
    logger.info('[migrate] 已为 orders 表添加 pay_time 列')
  }
}

// 订单明细记录顾客所选规格（如「中辣 / 少冰」），历史订单该列为 NULL
async function ensureOrderItemAttr () {
  const cols = await pq("select column_name from information_schema.columns where table_schema='csn' and table_name='order_items' and column_name='attr_text'")
  if (!cols.length) {
    await pq('alter table order_items add column attr_text varchar(100) default null')
    logger.info('[migrate] 已为 order_items 表添加 attr_text 列')
  }
}

async function ensureDemoCustomer () {
  const rows = await pq("select id from user where username='xiaomei'")
  if (!rows.length) {
    const hash = bcrypt.hashSync('123456', 10)
    await pq(
      "insert into user (rid,username,password,mobile,email,mg_state,role_name) values (3,?,?,?,?,1,'顾客')",
      ['xiaomei', hash, '13800000001', 'xiaomei@example.com']
    )
    logger.info('[migrate] 已创建演示顾客账号 xiaomei')
  }
}

async function ensureDemoFoods () {
  const now = Math.floor(Date.now() / 1000)
  let added = 0
  for (const f of menu.dishes) {
    const rows = await pq('select foods_id from food where foods_name=?', [f.name])
    if (!rows.length) {
      await pq(
        "insert into food (foods_name,foods_price,cat_id,foods_number,foods_weight,foods_introduce,add_time,upd_time,goods_state,is_promote,pics,attrs) values (?,?,?,?,?,?,?,?,1,0,'[]','[]')",
        [f.name, f.price, f.cat, f.num, f.weight, f.desc, now, now]
      )
      added++
    }
  }
  if (added > 0) logger.info('[migrate] 已补充缺失菜品 ' + added + ' 道')
}

// 规格字典：只补缺失项，不覆盖后台已调整的取值
async function ensureSpecs () {
  let added = 0
  for (const s of menu.specs) {
    const rows = await pq('select attr_id from cateparams where attr_name=? and cat_id=?', [s.name, s.cat])
    if (!rows.length) {
      await pq('insert into cateparams (attr_name,cat_id,attr_sel,attr_write,attr_vals) values (?,?,?,?,?)',
        [s.name, s.cat, 'many', 'list', s.vals])
      added++
    }
  }
  if (added > 0) logger.info('[migrate] 已补充可选项 ' + added + ' 组')
}

// 唯一索引：user.username 与 orders.order_number，防止并发注册 / 并发下单产生重复数据
async function ensureUniqueIndexes () {
  const uname = await pq("select index_name from information_schema.statistics where table_schema='csn' and table_name='user' and column_name='username' and non_unique=0")
  if (!uname.length) {
    const dup = await pq('select username from user group by username having count(*) > 1')
    if (dup.length) throw new Error('[migrate] user.username 存在重复数据，无法加唯一索引：' + dup.map(x => x.username).join(','))
    await pq('alter table user add unique index uk_username (username)')
    logger.info('[migrate] 已为 user.username 添加唯一索引')
  }
  const onum = await pq("select index_name from information_schema.statistics where table_schema='csn' and table_name='orders' and column_name='order_number' and non_unique=0")
  if (!onum.length) {
    const dup = await pq('select order_number from orders group by order_number having count(*) > 1')
    if (dup.length) throw new Error('[migrate] orders.order_number 存在重复数据，无法加唯一索引')
    await pq('alter table orders add unique index uk_order_number (order_number)')
    logger.info('[migrate] 已为 orders.order_number 添加唯一索引')
  }
}

async function migrate () {
  await ensureRole()
  await ensureOrderUserId()
  await ensureOrderItemAttr()
  await ensureOrderStatus()
  await ensureOrderPayTime()
  await ensureDemoCustomer()
  await ensureDemoFoods()
  await ensureSpecs()
  await ensureUniqueIndexes()
  logger.info('[migrate] 数据库迁移完成')
}

module.exports = migrate
