const request = require('supertest')
const app = require('../server/index')
const sqlClient = require('../server/config')

let adminToken = ''
let userToken = ''

describe('csn 后端接口测试', () => {
  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/login')
      .type('form')
      .send({ username: 'admin', password: '123456' })
    expect(adminRes.body.status).toBe(200)
    adminToken = adminRes.body.token

    const userRes = await request(app)
      .post('/api/login')
      .type('form')
      .send({ username: 'test', password: '123456' })
    expect(userRes.body.status).toBe(200)
    userToken = userRes.body.token
  })

  afterAll(() => {
    sqlClient.close()
  })

  describe('登录接口', () => {
    test('正确密码登录返回 token 与 rid', async () => {
      const res = await request(app)
        .post('/api/login')
        .type('form')
        .send({ username: 'admin', password: '123456' })
      expect(res.body.status).toBe(200)
      expect(res.body.token).toBeTruthy()
      expect(res.body.rid).toBe(1)
    })

    test('错误密码登录失败', async () => {
      const res = await request(app)
        .post('/api/login')
        .type('form')
        .send({ username: 'admin', password: 'wrongpass' })
      expect(res.body.status).toBe(401)
    })

    test('缺少密码参数返回 400', async () => {
      const res = await request(app)
        .post('/api/login')
        .type('form')
        .send({ username: 'admin' })
      expect(res.status).toBe(400)
    })
  })

  describe('鉴权', () => {
    test('无 token 访问返回 401', async () => {
      const res = await request(app).get('/api/users')
      expect(res.status).toBe(401)
    })

    test('伪造 token 返回 401', async () => {
      const res = await request(app).get('/api/users').set('Authorization', 'invalid-token')
      expect(res.status).toBe(401)
    })
  })

  describe('接口级权限', () => {
    test('普通用户访问写接口返回 403', async () => {
      const res = await request(app).post('/api/adduser').set('Authorization', userToken).send({})
      expect(res.status).toBe(403)
    })

    test('管理员访问写接口（缺参数）返回 400', async () => {
      const res = await request(app).post('/api/adduser').set('Authorization', adminToken).send({})
      expect(res.status).toBe(400)
    })

    test('普通用户访问读接口返回 200', async () => {
      const res = await request(app).get('/api/menus').set('Authorization', userToken)
      expect(res.status).toBe(200)
    })
  })

  describe('joi 参数校验', () => {
    test('非法 email 返回 400', async () => {
      const res = await request(app)
        .post('/api/adduser')
        .set('Authorization', adminToken)
        .send({ rid: 2, username: 'tester1', password: 'abc123', mobile: '13612345678', email: 'not-an-email' })
      expect(res.status).toBe(400)
    })

    test('非法手机号返回 400', async () => {
      const res = await request(app)
        .post('/api/adduser')
        .set('Authorization', adminToken)
        .send({ rid: 2, username: 'tester2', password: 'abc123', mobile: '123', email: 't2@csn.com' })
      expect(res.status).toBe(400)
    })
  })

  describe('写接口（RESTful 增删）', () => {
    test('管理员添加并删除用户（POST + DELETE）', async () => {
      // 添加用户
      const addRes = await request(app)
        .post('/api/adduser')
        .set('Authorization', adminToken)
        .send({ rid: 2, username: 'resttest', password: 'abc123', mobile: '13712345678', email: 'resttest@csn.com' })
      expect(addRes.body.status).toBe(200)

      // 查询该用户 id
      const searchRes = await request(app)
        .get('/api/usersearch')
        .set('Authorization', adminToken)
        .query({ search: 'resttest' })
      expect(searchRes.body.status).toBe(200)
      const uid = searchRes.body.result[0].id

      // 删除用户
      const delRes = await request(app)
        .delete('/api/deleteUserById')
        .set('Authorization', adminToken)
        .send({ id: uid })
      expect(delRes.body.status).toBe(200)
    })
  })

  describe('权限树鉴权', () => {
    test('普通用户访问有权限模块（菜品）返回 200', async () => {
      const res = await request(app).get('/api/foods').set('Authorization', userToken)
      expect(res.status).toBe(200)
    })

    test('普通用户访问无权限模块（用户）返回 403', async () => {
      const res = await request(app).get('/api/users').set('Authorization', userToken)
      expect(res.status).toBe(403)
    })

    test('普通用户菜单按权限过滤为 3 个', async () => {
      const res = await request(app).get('/api/menus').set('Authorization', userToken)
      expect(res.status).toBe(200)
      expect(res.body.result.length).toBe(3)
    })

    test('管理员菜单返回全部 5 个', async () => {
      const res = await request(app).get('/api/menus').set('Authorization', adminToken)
      expect(res.status).toBe(200)
      expect(res.body.result.length).toBe(5)
    })
  })

  describe('读接口', () => {
    test('菜单接口返回 200', async () => {
      const res = await request(app).get('/api/menus').set('Authorization', adminToken)
      expect(res.status).toBe(200)
      expect(res.body.result).toBeTruthy()
    })

    test('用户列表返回 200 且不含 password 字段', async () => {
      const res = await request(app).get('/api/users').set('Authorization', adminToken)
      expect(res.status).toBe(200)
      expect(res.body.result.length).toBeGreaterThan(0)
      expect(res.body.result[0].password).toBeUndefined()
    })

    test('菜品列表返回 200', async () => {
      const res = await request(app).get('/api/foods').set('Authorization', adminToken)
      expect(res.status).toBe(200)
    })

    test('订单列表返回 200', async () => {
      const res = await request(app).get('/api/order').set('Authorization', adminToken)
      expect(res.status).toBe(200)
    })

    test('数据报表返回 200', async () => {
      const res = await request(app).get('/api/report').set('Authorization', adminToken)
      expect(res.status).toBe(200)
    })
  })
})
