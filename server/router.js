const express = require('express')
const router = express.Router()
const sqlClient = require('./config')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const bcrypt = require('bcryptjs')
const Joi = require('joi')
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 未配置：请在 server 目录的 .env 中设置（参考 .env.example）')
}
// token 有效期：24 小时
const JWT_EXPIRES_IN = '24h'

// 登录防爆破：连续失败 5 次锁定 10 分钟（内存级，进程重启后自动清零）
const loginAttempts = new Map() // username -> { count, lockedUntil }
const MAX_LOGIN_FAIL = 5
const LOGIN_LOCK_MS = 10 * 60 * 1000
const logger = require('./logger')

// 分页查询辅助：执行列表查询 + 总数查询，返回 { status, result, total }
const paginate = (req, res, listSql, listArgs, countSql, countArgs) => {
  const a = new URL(req.url, 'http://localhost:3000')
  const pagenum = parseInt(a.searchParams.get('pagenum')) || 1
  const pagesize = parseInt(a.searchParams.get('pagesize')) || 10
  const offset = (pagenum - 1) * pagesize
  sqlClient(listSql + ' limit ?,?', (listArgs || []).concat([offset, pagesize]), result => {
    sqlClient(countSql, countArgs || null, countRes => {
      res.send({ status: 200, result, total: (countRes && countRes[0]) ? countRes[0].total : 0 })
    })
  })
}

// 权限树辅助：读取 allrights 树（id=1）
const getRightTree = () => new Promise((resolve) => {
  sqlClient('select children from allrights where id=1', null, result => {
    let tree = []
    if (result && result[0] && result[0].children) {
      try {
        tree = JSON.parse(result[0].children)
      } catch (e) {
        tree = []
      }
    }
    resolve(tree)
  })
})

// 权限树辅助：写回 allrights 树
const saveRightTree = (tree) => new Promise((resolve) => {
  sqlClient('update allrights set children=? where id=1', [JSON.stringify(tree)], result => {
    resolve(result && result.affectedRows > 0)
  })
})

// 写操作接口（仅管理员，普通用户访问返回 403）
const WRITE_PATHS = [
  '/users/uId/state/type', '/adduser', '/updateUser', '/deleteUserById',
  '/deleteRightById', '/addrole', '/updateUserRole', '/deleteRoleById',
  '/addright', '/updateright', '/deleteright',
  '/addfoodscate', '/updateCate', '/deleteCateById',
  '/addcateparams', '/updateParams', '/deleteParamsById',
  '/addfood', '/updatefood', '/deleteFoodById',
  '/updateOrderAddress', '/updateOrderStatus', '/addLogistics',
  '/upload'
]

// 接口路径 -> 权限模块（一级权限的 path），普通用户访问读接口需拥有对应模块权限
const API_MODULE = {
  // 用户管理
  '/users': 'users', '/usersearch': 'users', '/preUpdateUser': 'users',
  '/adduser': 'users', '/updateUser': 'users', '/deleteUserById': 'users', '/users/uId/state/type': 'users',
  // 权限管理
  '/rights': 'rights', '/rightstree': 'rights', '/addright': 'rights', '/updateright': 'rights', '/deleteright': 'rights',
  '/roles': 'rights', '/addrole': 'rights', '/updateUserRole': 'rights', '/deleteRoleById': 'rights',
  '/deleteRightById': 'rights', '/returnRightById': 'rights', '/allRightById': 'rights', '/UserRoleById': 'rights', '/preUpdateUserRole': 'rights',
  // 菜品管理
  '/foodscate': 'foods', '/addfoodscate': 'foods', '/updateCate': 'foods', '/deleteCateById': 'foods', '/preUpdateCate': 'foods',
  '/foodcountbycate': 'foods',
  '/cateparams': 'foods', '/addcateparams': 'foods', '/updateParams': 'foods', '/deleteParamsById': 'foods', '/preUpdateParams': 'foods',
  '/foods': 'foods', '/foodsearch': 'foods', '/addfood': 'foods', '/updatefood': 'foods', '/deleteFoodById': 'foods', '/preUpdatefood': 'foods',
  '/upload': 'foods',
  // 订单管理
  '/order': 'orders', '/ordersearch': 'orders', '/orderitems': 'orders', '/updateOrderAddress': 'orders', '/updateOrderStatus': 'orders', '/addLogistics': 'orders',
  // 数据统计
  '/report': 'report', '/statistics': 'report'
}

// body 参数校验中间件工厂
const validateBody = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body)
  if (error) {
    return res.status(400).send({ status: 400, msg: '参数错误：' + error.details[0].message })
  }
  next()
}

// 数字字段：兼容前端 JSON body 里的 number 或数字字符串
const num = () => Joi.alternatives().try(
  Joi.number(),
  Joi.string().pattern(/^\d+(\.\d+)?$/)
)

// JSON 数组字符串字段（分类树 children 等），校验能成功解析为数组
const jsonArray = Joi.string().custom((value, helpers) => {
  try {
    const arr = JSON.parse(value)
    if (!Array.isArray(arr)) throw new Error('not array')
    return value
  } catch (e) {
    return helpers.error('any.invalid')
  }
}, 'JSON 数组字符串')

// token 鉴权中间件（登录接口除外）
router.use((req, res, next) => {
  if (req.path === '/login') return next()
  const token = req.headers.authorization
  if (!token) {
    return res.status(401).send({ status: 401, msg: '未登录' })
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch (e) {
    return res.status(401).send({ status: 401, msg: 'token 无效' })
  }
})

// 角色权限中间件：写接口仅管理员；读接口按权限模块控制
router.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/menus') return next()
  // 管理员拥有全部权限
  if (req.user.rid === 1) return next()
  // 写接口：普通用户一律拒绝
  if (WRITE_PATHS.indexOf(req.path) !== -1) {
    return res.status(403).send({ status: 403, msg: '无权限，仅管理员可操作' })
  }
  // 读接口：检查是否拥有对应模块权限
  const module = API_MODULE[req.path]
  if (!module) return next()
  const rights = (req.user.rights || []).map(r => r.path)
  if (rights.indexOf(module) !== -1) {
    return next()
  }
  return res.status(403).send({ status: 403, msg: '无权限访问该模块' })
})

// 登录
router.post('/login', validateBody(Joi.object({
  username: Joi.string().min(3).max(10).required(),
  password: Joi.string().min(6).max(15).required()
})), (req, res) => {
  const {
    username,
    password
  } = req.body

  // 防爆破：已被锁定的账号直接拒绝
  const rec = loginAttempts.get(username)
  if (rec && rec.lockedUntil > Date.now()) {
    const remain = Math.ceil((rec.lockedUntil - Date.now()) / 1000)
    return res.status(429).send({ status: 429, msg: `登录失败次数过多，请 ${remain} 秒后重试` })
  }

  const sql = 'select id, username, password, rid from user where username=?'
  const arr = [username]
  sqlClient(sql, arr, result => {
    // 登录失败统一处理：累计失败次数，超过阈值锁定
    const fail = () => {
      const r = loginAttempts.get(username) || { count: 0, lockedUntil: 0 }
      r.count += 1
      if (r.count >= MAX_LOGIN_FAIL) {
        r.lockedUntil = Date.now() + LOGIN_LOCK_MS
        r.count = 0
        return res.status(429).send({ status: 429, msg: '登录失败次数过多，请 10 分钟后重试' })
      }
      loginAttempts.set(username, r)
      return res.send({ status: 401, msg: '登录失败' })
    }

    if (result.length === 0) {
      return fail()
    }
    const user = result[0]
    const stored = user.password || ''
    // 兼容 bcrypt 哈希（$2a/$2b 开头）与历史明文密码
    const valid = stored.indexOf('$2') === 0
      ? bcrypt.compareSync(password, stored)
      : stored === password
    if (!valid) {
      return fail()
    }
    // 登录成功，清除失败记录
    loginAttempts.delete(username)

    // 查询该角色的权限树，把一级权限（id + path）放进 token 与返回
    sqlClient('select children from roles where id=?', [user.rid], roleResult => {
      let rights = []
      if (roleResult[0] && roleResult[0].children) {
        try {
          const children = JSON.parse(roleResult[0].children)
          rights = children.map(n => ({ id: n.id, path: n.path }))
        } catch (e) {
          rights = []
        }
      }
      const token = jwt.sign({
        username,
        id: user.id,
        rid: user.rid,
        rights
      }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
      res.send({
        status: 200,
        token,
        username,
        rid: user.rid,
        rights
      })
    })
  })
})

//  用户信息查询

router.get('/usersearch', (req, res) => {
  const a = new URL(req.url, 'http://localhost:3000')
  const like = '%' + (a.searchParams.get('search') || '') + '%'
  paginate(req, res,
    'select id,rid,username,mobile,email,mg_state,role_name from user where concat(`username`,`mobile`,`email`,`mg_state`,`role_name`) like ?',
    [like],
    'select count(*) as total from user where concat(`username`,`mobile`,`email`,`mg_state`,`role_name`) like ?',
    [like]
  )
})

// 左侧菜单权限（按用户权限过滤）
router.get('/menus', (req, res) => {
  const sql = 'select * from menus where id'
  sqlClient(sql, null, result => {
    let menus = result || []
    // 管理员看全部；普通用户按权限树过滤
    if (req.user.rid !== 1) {
      const ids = (req.user.rights || []).map(r => r.id)
      menus = menus.filter(m => ids.indexOf(m.id) !== -1)
    }
    res.send({ status: 200, result: menus })
  })
})

// 用户列表
router.get('/users', (req, res) => {
  paginate(req, res,
    'select id,rid,username,mobile,email,mg_state,role_name from user',
    [],
    'select count(*) as total from user',
    null
  )
})

// 用户状态修改
router.put('/users/uId/state/type', (req, res) => {
  const id = req.body.id
  const mgstate = req.body.mg_state
  const sql = 'update user set mg_state=? where id=?'
  const arr = [mgstate, id]

  sqlClient(sql, arr, result => {
    if (result.affectedRows > 0) {
      res.send({
        status: 200,
        msg: '修改用户状态成功'

      })
    } else {
      res.send({
        status: 500,
        msg: '修改用户状态失败'
      })
    }
  })
})

// 添加用户
router.post('/adduser', validateBody(Joi.object({
  rid: num().required(),
  username: Joi.string().min(3).max(10).required(),
  password: Joi.string().min(6).max(15).required(),
  mobile: Joi.string().pattern(/^1[0-9]{10}$/).required(),
  email: Joi.string().email().required()
})), (req, res) => {
  const rid = req.body.rid
  const username = req.body.username
  const password = req.body.password
  const mobile = req.body.mobile
  const email = req.body.email
  // 检查用户名是否已存在
  sqlClient('select id from user where username=?', [username], exists => {
    if (exists.length > 0) {
      return res.send({ status: 400, msg: '用户名已存在' })
    }
    // 根据角色 id 查角色名，保证 role_name 与 roles 表一致
    sqlClient('select roleName from roles where id=?', [rid], roleRes => {
      if (!roleRes.length) {
        return res.send({ status: 400, msg: '角色不存在' })
      }
      const hash = bcrypt.hashSync(password || '', 10)
      const sql = 'insert into user values (null,?,?,?,?,?,0,?)'
      const arr = [rid, username, hash, mobile, email, roleRes[0].roleName]
      sqlClient(sql, arr, result => {
        if (result.affectedRows > 0) {
          res.send({ status: 200, msg: '添加用户成功' })
        } else {
          res.send({ status: 500, msg: '添加用户失败' })
        }
      })
    })
  })
})

// 用户编辑预更新
router.get('/preUpdateUser', (req, res) => {
  const a = new URL(req.url, 'http://localhost:3000')
  const id = a.searchParams.get('id')
  const sql = 'select id,rid,username,mobile,email,mg_state,role_name from user where id=?'
  sqlClient(sql, [id], result => {
    if (result.length > 0) {
      res.send({
        status: 200,
        result
      })
    } else {
      res.send({
        status: 500,
        msg: '用户预更新失败'
      })
    }
  })
})

// 用户编辑
router.put('/updateUser', validateBody(Joi.object({
  id: num().required(),
  rid: num().required(),
  email: Joi.string().email().required(),
  mobile: Joi.string().pattern(/^1[0-9]{10}$/).required()
})), (req, res) => {
  const id = req.body.id
  const rid = req.body.rid
  const email = req.body.email
  const mobile = req.body.mobile
  // role_name 由 rid 查 roles 表同步，避免与前端传值脱节
  sqlClient('select roleName from roles where id=?', [rid], roleRes => {
    if (!roleRes.length) {
      return res.send({ status: 400, msg: '角色不存在' })
    }
    const sql = 'update user set rid=?,email=?,mobile=?,role_name=? where id=?'
    const arr = [rid, email, mobile, roleRes[0].roleName, id]
    sqlClient(sql, arr, result => {
      if (result.affectedRows > 0) {
        res.send({
          status: 200,
          msg: '用户修改成功'
        })
      } else {
        res.send({
          status: 500,
          msg: '用户修改失败'
        })
      }
    })
  })
})

// 用户删除
router.delete('/deleteUserById', validateBody(Joi.object({
  id: num().required()
})), (req, res) => {
  const id = Number(req.body.id)
  // 不能删除当前登录账号
  if (req.user && req.user.id === id) {
    return res.send({ status: 400, msg: '不能删除当前登录账号' })
  }
  sqlClient('select rid from user where id=?', [id], target => {
    if (!target.length) {
      return res.send({ status: 400, msg: '用户不存在' })
    }
    const doDelete = () => {
      sqlClient('delete from user where id=?', [id], result => {
        if (result.affectedRows > 0) {
          res.send({ status: 200, msg: '删除用户成功' })
        } else {
          res.send({ status: 500, msg: '删除用户失败' })
        }
      })
    }
    // 不能删除最后一个管理员
    if (target[0].rid === 1) {
      sqlClient('select count(*) as count from user where rid=1', null, admins => {
        const cnt = admins[0] ? admins[0].count : 0
        if (cnt <= 1) {
          return res.send({ status: 400, msg: '不能删除最后一个管理员' })
        }
        doDelete()
      })
    } else {
      doDelete()
    }
  })
})

// 权限列表（扁平，兼容旧数据）
router.get('/rights', (req, res) => {
  const sql = 'select * from rights where id '
  sqlClient(sql, null, result => {
    if (result.length > 0) {
      res.send({
        status: 200,
        result
      })
    } else {
      res.send({
        status: 401,
        msg: '获取权限列表失败'
      })
    }
  })
})

// 权限树列表（分配权限与权限列表页共用的完整树）
router.get('/rightstree', (req, res) => {
  getRightTree().then(tree => {
    res.send({ status: 200, result: tree })
  })
})

// 添加权限（pid 为 0 或省略表示一级，否则为二级）
router.post('/addright', validateBody(Joi.object({
  authName: Joi.string().required(),
  path: Joi.string().required(),
  pid: num().optional()
})), (req, res) => {
  const authName = req.body.authName
  const path = req.body.path
  const pid = req.body.pid ? Number(req.body.pid) : 0
  getRightTree().then(tree => {
    if (pid === 0) {
      // 一级权限：id = max(一级 id) + 1
      const maxId = tree.reduce((m, n) => Math.max(m, n.id), 100)
      tree.push({ id: maxId + 1, authName, path, children: [] })
    } else {
      // 二级权限：挂到对应一级节点下
      const parent = tree.find(n => n.id === pid)
      if (!parent) {
        return res.send({ status: 400, msg: '父级权限不存在' })
      }
      parent.children = parent.children || []
      const maxChild = parent.children.reduce((m, n) => Math.max(m, n.id), pid * 100)
      parent.children.push({ id: maxChild + 1, authName, path })
    }
    saveRightTree(tree).then(ok => {
      res.send(ok ? { status: 200, msg: '添加权限成功' } : { status: 500, msg: '添加权限失败' })
    })
  })
})

// 编辑权限（名称/路径）
router.put('/updateright', validateBody(Joi.object({
  id: num().required(),
  authName: Joi.string().required(),
  path: Joi.string().required()
})), (req, res) => {
  const id = Number(req.body.id)
  const authName = req.body.authName
  const path = req.body.path
  getRightTree().then(tree => {
    let found = false
    const walk = (nodes) => {
      (nodes || []).forEach(n => {
        if (n.id === id) {
          n.authName = authName
          n.path = path
          found = true
        }
        if (n.children && n.children.length) walk(n.children)
      })
    }
    walk(tree)
    if (!found) {
      return res.send({ status: 400, msg: '权限不存在' })
    }
    saveRightTree(tree).then(ok => {
      res.send(ok ? { status: 200, msg: '编辑权限成功' } : { status: 500, msg: '编辑权限失败' })
    })
  })
})

// 删除权限（删除前检查是否被角色引用）
router.delete('/deleteright', validateBody(Joi.object({
  id: num().required()
})), (req, res) => {
  const id = Number(req.body.id)
  getRightTree().then(tree => {
    // 检查该权限是否已被某角色分配
    sqlClient('select children from roles where children is not null', null, roles => {
      const referenced = (roles || []).some(r => {
        try {
          const c = JSON.parse(r.children)
          const find = (nodes) => (nodes || []).some(n => n.id === id || find(n.children))
          return find(c)
        } catch (e) {
          return false
        }
      })
      if (referenced) {
        return res.send({ status: 400, msg: '该权限已被角色引用，无法删除' })
      }
      const remove = (nodes) => (nodes || []).filter(n => {
        if (n.id === id) return false
        if (n.children) n.children = remove(n.children)
        return true
      })
      const newTree = remove(tree)
      saveRightTree(newTree).then(ok => {
        res.send(ok ? { status: 200, msg: '删除权限成功' } : { status: 500, msg: '删除权限失败' })
      })
    })
  })
})

// 角色列表
router.get('/roles', (req, res) => {
  const sql = 'select * from roles where id '
  sqlClient(sql, null, result => {
    if (result.length > 0) {
      res.send({
        status: 200,
        result
      })
    } else {
      res.send({
        status: 401,
        msg: '获取角色列表失败'
      })
    }
  })
})

// 角色权限更新（删除/分配权限均更新 children）
router.put('/deleteRightById', (req, res) => {
  const id = req.body.id
  const role = req.body.roles
  const sql = 'update roles set children=? where id=?'
  const arr = [role, id]
  sqlClient(sql, arr, result => {
    if (result.affectedRows > 0) {
      res.send({
        status: 200,
        msg: '删除角色权限成功'
      })
    } else {
      res.send({
        status: 500,
        msg: '删除角色权限失败'
      })
    }
  })
})

// 返回角色权限
router.get('/returnRightById', (req, res) => {
  const a = new URL(req.url, 'http://localhost:3000')
  const id = a.searchParams.get('id')
  const sql = 'select * from roles where id=?'
  const arr = [id]
  sqlClient(sql, arr, result => {
    if (result.length > 0) {
      res.send({
        status: 200,
        msg: '返回角色权限成功',
        result
      })
    } else {
      res.send({
        status: 500,
        msg: '返回角色权限失败'
      })
    }
  })
})

// 获取所有权限列表
router.get('/allRightById', (req, res) => {
  const sql = 'select * from allrights where id'
  sqlClient(sql, null, result => {
    if (result.length > 0) {
      res.send({
        status: 200,
        msg: '获取所有权限列表成功',
        result
      })
    } else {
      res.send({
        status: 500,
        msg: '获取所有权限列表失败'
      })
    }
  })
})

// 用户角色对应id查找
router.get('/UserRoleById', (req, res) => {
  const a = new URL(req.url, 'http://localhost:3000')
  const id = a.searchParams.get('id')
  const sql = 'select roleName from roles where id=?'
  const arr = [id]
  sqlClient(sql, arr, result => {
    if (result.length > 0) {
      res.send({
        status: 200,
        msg: '用户角色查找成功',
        result
      })
    } else {
      res.send({
        status: 500,
        msg: '用户角色查找失败'
      })
    }
  })
})

// 添加角色
router.post('/addrole', validateBody(Joi.object({
  rolename: Joi.string().required(),
  roledesc: Joi.string().required()
})), (req, res) => {
  const rolename = req.body.rolename
  const roledesc = req.body.roledesc
  const sql = 'insert into roles values (null,?,?,null)'
  const arr = [rolename, roledesc]
  sqlClient(sql, arr, result => {
    if (result.affectedRows > 0) {
      res.send({
        status: 200,
        msg: '添加用户成功'
      })
    } else {
      res.send({
        status: 500,
        msg: '添加用户失败'
      })
    }
  })
})

// 角色编辑预更新
router.get('/preUpdateUserRole', (req, res) => {
  const a = new URL(req.url, 'http://localhost:3000')
  const id = a.searchParams.get('id')
  const sql = 'select * from roles where id=?'
  sqlClient(sql, [id], result => {
    if (result.length > 0) {
      res.send({
        status: 200,
        result
      })
    } else {
      res.send({
        status: 500,
        msg: '角色预更新失败'
      })
    }
  })
})

// 角色编辑
router.put('/updateUserRole', (req, res) => {
  const id = req.body.id
  const rolename = req.body.rolename
  const roledesc = req.body.roledesc
  const sql = 'update roles set roleName=?,roleDesc=? where id=?'
  const arr = [rolename, roledesc, id]
  sqlClient(sql, arr, result => {
    if (result.affectedRows > 0) {
      // 同步该角色下所有用户的 role_name 冗余字段
      sqlClient('update user set role_name=? where rid=?', [rolename, id], () => {
        res.send({ status: 200, msg: '角色修改成功' })
      })
    } else {
      res.send({
        status: 500,
        msg: '角色修改失败'
      })
    }
  })
})

// 角色删除
router.delete('/deleteRoleById', (req, res) => {
  const id = Number(req.body.id)
  // 系统内置管理员角色不可删除
  if (id === 1) {
    return res.send({ status: 400, msg: '系统内置管理员角色不可删除' })
  }
  // 检查该角色下是否存在用户
  sqlClient('select id from user where rid=?', [id], users => {
    if (users.length > 0) {
      return res.send({ status: 400, msg: '该角色下存在用户，无法删除' })
    }
    const sql = 'delete from roles where id=?'
    const arr = [id]
    sqlClient(sql, arr, result => {
      if (result.affectedRows > 0) {
        res.send({ status: 200, msg: '删除角色成功' })
      } else {
        res.send({ status: 500, msg: '删除角色失败' })
      }
    })
  })
})

// 菜品分类列表
router.get('/foodscate', (req, res) => {
  const sql = 'select * from foodscate where id '
  sqlClient(sql, null, result => {
    if (result.length > 0) {
      res.send({
        status: 200,
        result
      })
    } else {
      res.send({
        status: 401,
        msg: '获取菜品分类列表失败'
      })
    }
  })
})

// 添加菜品分类
router.post('/addfoodscate', validateBody(Joi.object({
  children: jsonArray.required()
})), (req, res) => {
  const children = req.body.children
  const sql = 'update foodscate set children=? where id=?'
  const arr = [children, 1]
  sqlClient(sql, arr, result => {
    if (result.affectedRows > 0) {
      res.send({
        status: 200,
        msg: '菜品分类添加成功'
      })
    } else {
      res.send({
        status: 500,
        msg: '菜品分类添加失败'
      })
    }
  })
})

// 菜品分类编辑预更新
router.get('/preUpdateCate', (req, res) => {
  const a = new URL(req.url, 'http://localhost:3000')
  const id = a.searchParams.get('id')
  const sql = 'select children from foodscate where id'
  sqlClient(sql, [id], result => {
    if (result.length > 0) {
      res.send({
        status: 200,
        result
      })
    } else {
      res.send({
        status: 500,
        msg: '角色预更新失败'
      })
    }
  })
})

// 菜品分类名修改
router.put('/updateCate', validateBody(Joi.object({
  children: jsonArray.required()
})), (req, res) => {
  const children = req.body.children
  const sql = 'update foodscate set children=? where id=?'
  const arr = [children, 1]
  sqlClient(sql, arr, result => {
    if (result.affectedRows > 0) {
      res.send({
        status: 200,
        msg: '菜品分类名修改成功'
      })
    } else {
      res.send({
        status: 500,
        msg: '菜品分类名修改失败'
      })
    }
  })
})

// 菜品分类删除（更新分类树；删除前校验分类下是否还有菜品）
router.put('/deleteCateById', validateBody(Joi.object({
  children: jsonArray.required(),
  cat_id: Joi.string().required()
})), (req, res) => {
  const children = req.body.children
  const catId = req.body.cat_id
  // 后端兜底校验：该分类（含所有子分类）下存在菜品则禁止删除
  sqlClient('select count(*) as count from food where cat_id=? or cat_id like ?', [catId, catId + ',%'], cntRes => {
    const count = cntRes[0] ? cntRes[0].count : 0
    if (count > 0) {
      return res.send({ status: 400, msg: '该分类下存在菜品，无法删除' })
    }
    const sql = 'update foodscate set children=? where id=?'
    const arr = [children, 1]
    sqlClient(sql, arr, result => {
      if (result.affectedRows > 0) {
        res.send({
          status: 200,
          msg: '菜品分类删除成功'
        })
      } else {
        res.send({
          status: 500,
          msg: '菜品分类删除失败'
        })
      }
    })
  })
})

// 检查分类下是否有菜品（删除分类前校验）
router.get('/foodcountbycate', (req, res) => {
  const a = new URL(req.url, 'http://localhost:3000')
  const catid = a.searchParams.get('cat_id') || ''
  // cat_id 为逗号分隔路径，如 "1" / "1,1" / "1,1,1"；匹配自身及所有子分类
  const sql = 'select count(*) as count from food where cat_id=? or cat_id like ?'
  const arr = [catid, catid + ',%']
  sqlClient(sql, arr, result => {
    res.send({ status: 200, count: result[0] ? result[0].count : 0 })
  })
})

// 获取参数列表
router.get('/cateparams', (req, res) => {
  const sql = 'select * from cateparams where attr_id'
  sqlClient(sql, null, result => {
    if (result.length > 0) {
      res.send({
        status: 200,
        msg: '获取所有参数列表成功',
        result
      })
    } else {
      res.send({
        status: 500,
        msg: '获取所有参数列表失败'
      })
    }
  })
})

// 添加分类参数
router.post('/addcateparams', validateBody(Joi.object({
  attr_name: Joi.string().required(),
  cat_id: Joi.string().required(),
  attr_sel: Joi.string().valid('many', 'only').required()
})), (req, res) => {
  const catid = req.body.cat_id
  const attrname = req.body.attr_name
  const attrsel = req.body.attr_sel
  const sql = 'insert into cateparams values (null,?,?,?,null,null)'
  const arr = [attrname, catid, attrsel]
  sqlClient(sql, arr, result => {
    if (result.affectedRows > 0) {
      res.send({
        status: 200,
        msg: '添加分类参数成功'
      })
    } else {
      res.send({
        status: 500,
        msg: '添加分类参数失败'
      })
    }
  })
})

// 分类参数编辑预更新
router.get('/preUpdateParams', (req, res) => {
  const a = new URL(req.url, 'http://localhost:3000')
  const attrid = a.searchParams.get('attr_id')
  const catid = a.searchParams.get('cat_id')
  const sql = 'select * from cateparams where attr_id=? and cat_id=?'
  sqlClient(sql, [attrid, catid], result => {
    if (result.length > 0) {
      res.send({
        status: 200,
        result
      })
    } else {
      res.send({
        status: 500,
        msg: '分类参数预更新失败'
      })
    }
  })
})

// 分类参数修改
router.put('/updateParams', (req, res) => {
  const attrid = req.body.attr_id
  const catid = req.body.cat_id
  const attrname = req.body.attr_name
  const attrvals = req.body.attr_vals
  const sql = 'update cateparams set attr_name=?,attr_vals=? where attr_id=? and cat_id=?'
  const arr = [attrname, attrvals, attrid, catid]
  sqlClient(sql, arr, result => {
    if (result.affectedRows > 0) {
      res.send({
        status: 200,
        msg: '分类参数修改成功'
      })
    } else {
      res.send({
        status: 500,
        msg: '分类参数修改失败'
      })
    }
  })
})

// 分类参数删除
router.delete('/deleteParamsById', (req, res) => {
  const attrid = req.body.attr_id
  const sql = 'delete from cateparams where attr_id=?'
  const arr = [attrid]
  sqlClient(sql, arr, result => {
    if (result.affectedRows > 0) {
      res.send({
        status: 200,
        msg: '分类参数删除成功'
      })
    } else {
      res.send({
        status: 500,
        msg: '分类参数删除失败'
      })
    }
  })
})

// 菜品列表
router.get('/foods', (req, res) => {
  paginate(req, res,
    'select * from food',
    [],
    'select count(*) as total from food',
    null
  )
})

//  菜品信息查询
router.get('/foodsearch', (req, res) => {
  const a = new URL(req.url, 'http://localhost:3000')
  const like = '%' + (a.searchParams.get('search') || '') + '%'
  paginate(req, res,
    'select * from food where concat(`foods_name`,`foods_price`,`foods_weight`) like ?',
    [like],
    'select count(*) as total from food where concat(`foods_name`,`foods_price`,`foods_weight`) like ?',
    [like]
  )
})

// 菜品删除
router.delete('/deleteFoodById', (req, res) => {
  const foodsid = req.body.foods_id
  const sql = 'delete from food where foods_id=?'
  const arr = [foodsid]
  sqlClient(sql, arr, result => {
    if (result.affectedRows > 0) {
      res.send({
        status: 200,
        msg: '删除菜品成功'
      })
    } else {
      res.send({
        status: 500,
        msg: '删除菜品失败'
      })
    }
  })
})

/**
 * 上传图片
 */
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './upload/')
  },
  filename: function (req, file, cb) {
    // 清洗文件名：防止路径穿越（../）与扩展名注入，只保留安全字符
    const ext = path.extname(file.originalname).replace(/[^.\w]/g, '')
    const base = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '')
      .slice(0, 40)
    cb(null, Date.now() + '-' + (base || 'img') + ext)
  }
})

var createFolder = function (folder) {
  try {
    fs.accessSync(folder)
  } catch (e) {
    fs.mkdirSync(folder)
  }
}

var uploadFolder = './upload/'
createFolder(uploadFolder)
var upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (/^image\//.test(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('只允许上传图片文件'))
    }
  }
})

router.post('/upload', upload.single('file'), function (req, res, next) {
  var file = req.file
  if (!file) {
    return res.json({ res_code: '1', msg: '未接收到文件' })
  }
  logger.info(`文件上传：${file.originalname} (${file.mimetype}, ${file.size} bytes) -> ${file.path}`)
  res.json({ res_code: '0', name: file.originalname, url: file.path })
}, function (err, req, res, next) {
  if (err) {
    return res.json({ res_code: '1', msg: err.message || '上传失败' })
  }
  next()
})

// 添加菜品
router.post('/addfood', validateBody(Joi.object({
  foods_name: Joi.string().required(),
  foods_price: num().required(),
  cat_id: Joi.string().required(),
  foods_number: num().required(),
  foods_weight: Joi.string().required(),
  foods_introduce: Joi.string().allow('').optional(),
  add_time: num().optional(),
  upd_time: num().optional(),
  pics: Joi.string().allow('').optional(),
  attrs: Joi.string().allow('').optional()
})), (req, res) => {
  const foodsname = req.body.foods_name
  const foodsprice = req.body.foods_price
  const catid = req.body.cat_id
  const foodsnumber = req.body.foods_number
  const foodsweight = req.body.foods_weight
  const foodsintroduce = req.body.foods_introduce
  const addtime = req.body.add_time
  const updtime = req.body.upd_time
  const pics = req.body.pics
  const attrs = req.body.attrs
  // 检查菜品名是否已存在
  sqlClient('select foods_id from food where foods_name=?', [foodsname], exists => {
    if (exists.length > 0) {
      return res.send({ status: 400, msg: '菜品名称已存在' })
    }
    const sql = 'insert into food values (null,?,?,?,?,?,?,null,?,?,null,0,?,?)'
    const arr = [foodsname, foodsprice, catid, foodsnumber, foodsweight, foodsintroduce, addtime, updtime, pics, attrs]
    sqlClient(sql, arr, result => {
      if (result.affectedRows > 0) {
        res.send({ status: 200, msg: '添加菜品成功' })
      } else {
        res.send({ status: 500, msg: '添加菜品失败' })
      }
    })
  })
})

// 菜品修改
router.put('/updatefood', validateBody(Joi.object({
  foods_id: num().required(),
  foods_name: Joi.string().required(),
  foods_price: num().required(),
  cat_id: Joi.string().required(),
  foods_number: num().required(),
  foods_weight: Joi.string().allow('').optional(),
  foods_introduce: Joi.string().allow('').optional(),
  upd_time: num().optional(),
  pics: Joi.string().allow('').optional(),
  attrs: Joi.string().allow('').optional()
})), (req, res) => {
  const foodsid = req.body.foods_id
  const foodsname = req.body.foods_name
  const foodsprice = req.body.foods_price
  const catid = req.body.cat_id
  const foodsnumber = req.body.foods_number
  const foodsweight = req.body.foods_weight
  const foodsintroduce = req.body.foods_introduce
  const updtime = req.body.upd_time
  const pics = req.body.pics
  const attrs = req.body.attrs
  // 检查菜品名是否与其他菜品重复（排除自身）
  sqlClient('select foods_id from food where foods_name=? and foods_id<>?', [foodsname, foodsid], exists => {
    if (exists.length > 0) {
      return res.send({ status: 400, msg: '菜品名称已存在' })
    }
    const sql = 'update food set foods_name=?,foods_price=?,cat_id=?,foods_number=?,foods_weight=?,foods_introduce=?,upd_time=?,pics=?,attrs=? where foods_id=?'
    const arr = [foodsname, foodsprice, catid, foodsnumber, foodsweight, foodsintroduce, updtime, pics, attrs, foodsid]
    sqlClient(sql, arr, result => {
      if (result.affectedRows > 0) {
        res.send({
          status: 200,
          msg: '修改菜品成功'
        })
      } else {
        res.send({
          status: 500,
          msg: '修改菜品失败'
        })
      }
    })
  })
})

// 菜品编辑预更新
router.get('/preUpdatefood', (req, res) => {
  const a = new URL(req.url, 'http://localhost:3000')
  const foodsid = a.searchParams.get('foods_id')
  const sql = 'select * from food where foods_id=?'
  sqlClient(sql, [foodsid], result => {
    if (result.length > 0) {
      res.send({
        status: 200,
        result
      })
    } else {
      res.send({
        status: 500,
        msg: '菜品预更新失败'
      })
    }
  })
})

// 订单商品明细
router.get('/orderitems', (req, res) => {
  const a = new URL(req.url, 'http://localhost:3000')
  const orderId = a.searchParams.get('order_id')
  if (!orderId) {
    return res.send({ status: 400, msg: '缺少 order_id' })
  }
  sqlClient('select * from order_items where order_id=?', [orderId], result => {
    res.send({ status: 200, result: result || [] })
  })
})

// 订单列表
router.get('/order', (req, res) => {
  paginate(req, res,
    'select * from orders',
    [],
    'select count(*) as total from orders',
    null
  )
})

//  订单查询

router.get('/ordersearch', (req, res) => {
  const a = new URL(req.url, 'http://localhost:3000')
  const like = '%' + (a.searchParams.get('search') || '') + '%'
  paginate(req, res,
    'select * from orders where order_number like ?',
    [like],
    'select count(*) as total from orders where order_number like ?',
    [like]
  )
})

// 修改订单地址
router.put('/updateOrderAddress', validateBody(Joi.object({
  order_id: num().required(),
  address: Joi.string().required()
})), (req, res) => {
  const orderid = req.body.order_id
  const address = req.body.address
  const sql = 'update orders set address=? where order_id=?'
  sqlClient(sql, [address, orderid], result => {
    if (result.affectedRows > 0) {
      res.send({ status: 200, msg: '修改地址成功' })
    } else {
      res.send({ status: 500, msg: '修改地址失败' })
    }
  })
})

// 修改订单支付/发货状态（可单独或同时修改）
router.put('/updateOrderStatus', validateBody(Joi.object({
  order_id: num().required(),
  pay_status: Joi.number().valid(0, 1).optional(),
  is_send: Joi.number().valid(0, 1).optional()
}).or('pay_status', 'is_send')), (req, res) => {
  const orderId = req.body.order_id
  const fields = []
  const arr = []
  if (req.body.pay_status !== undefined) {
    fields.push('pay_status=?')
    arr.push(req.body.pay_status)
  }
  if (req.body.is_send !== undefined) {
    fields.push('is_send=?')
    arr.push(req.body.is_send)
  }
  if (!fields.length) {
    return res.send({ status: 400, msg: '未提供要修改的状态' })
  }
  arr.push(orderId)
  sqlClient('select order_id from orders where order_id=?', [orderId], rows => {
    if (!rows.length) {
      return res.send({ status: 400, msg: '订单不存在' })
    }
    sqlClient('update orders set ' + fields.join(',') + ' where order_id=?', arr, result => {
      if (result.affectedRows > 0) {
        res.send({ status: 200, msg: '订单状态修改成功' })
      } else {
        res.send({ status: 500, msg: '订单状态修改失败' })
      }
    })
  })
})

// 追加物流轨迹节点
router.post('/addLogistics', validateBody(Joi.object({
  order_id: num().required(),
  context: Joi.string().min(1).max(100).required()
})), (req, res) => {
  const orderId = req.body.order_id
  const context = req.body.context
  sqlClient('select logistics from orders where order_id=?', [orderId], rows => {
    if (!rows.length) {
      return res.send({ status: 400, msg: '订单不存在' })
    }
    let list = []
    try {
      list = JSON.parse(rows[0].logistics || '[]')
    } catch (e) {
      list = []
    }
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const time = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
      ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds())
    list.push({ time, context })
    sqlClient('update orders set logistics=? where order_id=?', [JSON.stringify(list), orderId], result => {
      if (result.affectedRows > 0) {
        res.send({ status: 200, msg: '物流信息已更新' })
      } else {
        res.send({ status: 500, msg: '物流信息更新失败' })
      }
    })
  })
})

// 数据报表
router.get('/report', (req, res) => {
  const sql = 'select * from report where id '
  sqlClient(sql, null, result => {
    if (result.length > 0) {
      res.send({
        status: 200,
        result
      })
    } else {
      res.send({
        status: 401,
        msg: '获取数据报表失败'
      })
    }
  })
})

// 数据统计（基于真实业务数据动态聚合）
router.get('/statistics', (req, res) => {
  const q = (sql, arr) => new Promise((resolve) => {
    sqlClient(sql, arr || null, resolve)
  })
  // 近 7 天（含今天），对齐到本地今天 0 点往前 6 天，避免时区边界漏数据
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysAgo = Math.floor(todayStart.getTime() / 1000) - 6 * 86400

  Promise.all([
    q('select count(*) as total from user'),
    q('select count(*) as total, coalesce(sum(cast(order_price as decimal(10,2))),0) as amount from orders'),
    q('select count(*) as total from food'),
    q('select pay_status, count(*) as c from orders group by pay_status'),
    q('select is_send, count(*) as c from orders group by is_send'),
    q('select coalesce(role_name,"未知") as name, count(*) as value from user group by role_name'),
    q('select from_unixtime(create_time, "%Y-%m-%d") as d, count(*) as c, coalesce(sum(cast(order_price as decimal(10,2))),0) as amount from orders where create_time >= ? group by d order by d', [sevenDaysAgo])
  ]).then(([users, orders, foods, payStatus, sendStatus, roleDist, trend]) => {
    const pick = (rows, key) => {
      const m = {}
      rows.forEach(r => { m[r[key]] = r })
      return m
    }
    const payMap = pick(payStatus, 'pay_status')
    const sendMap = pick(sendStatus, 'is_send')

    // 补全近 7 天日期，无订单的补 0，保证趋势图连续
    const days = []
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(Date.now() - i * 86400000)
      const key = dt.getFullYear() + '-' +
        String(dt.getMonth() + 1).padStart(2, '0') + '-' +
        String(dt.getDate()).padStart(2, '0')
      days.push(key)
    }
    const trendMap = {}
    trend.forEach(r => { trendMap[r.d] = r })
    const orderTrend = days.map(d => trendMap[d]
      ? { date: d, count: trendMap[d].c, amount: Number(trendMap[d].amount) }
      : { date: d, count: 0, amount: 0 })

    res.send({
      status: 200,
      data: {
        totalUsers: users[0] ? users[0].total : 0,
        totalOrders: orders[0] ? orders[0].total : 0,
        totalFoods: foods[0] ? foods[0].total : 0,
        totalAmount: orders[0] ? Number(orders[0].amount) : 0,
        paidOrders: payMap['1'] ? payMap['1'].c : 0,
        unpaidOrders: payMap['0'] ? payMap['0'].c : 0,
        sentOrders: sendMap['1'] ? sendMap['1'].c : 0,
        unsentOrders: sendMap['0'] ? sendMap['0'].c : 0,
        roleDist,
        orderTrend
      }
    })
  }).catch(() => {
    res.send({ status: 500, msg: '获取统计数据失败' })
  })
})

module.exports = router
