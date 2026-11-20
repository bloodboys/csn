# 吃啥呢外卖平台（csn）

一个前后端分离的外卖平台，包含 **后台管理系统**（商家运营端）与 **顾客点餐端**，共享同一套 Node.js + Express + MySQL 后端。

| 端 | 说明 | 技术 | 访问地址 |
|---|---|---|---|
| 后台管理系统 | 用户 / 权限 / 菜品 / 订单 / 数据统计 | Vue 2.6 + Element UI + Vuex + ECharts | `http://localhost:8080` |
| 顾客点餐端 | 浏览菜单 / 下单 / 模拟支付 / 查物流 | Vue 2.6 + axios（无打包，后端静态托管） | `http://localhost:3000/shop/` |
| 后端 API | 后台 + 点餐端共享 | Node.js + Express 4 | `http://localhost:3000` |

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 2.6、Vue CLI 4.5、Element UI、Vuex、Vue Router、ECharts |
| 后端 | Node.js、Express 4、jsonwebtoken（JWT）、multer（上传）、bcryptjs（密码哈希）、joi（参数校验）、winston（日志） |
| 数据库 | MySQL 5.7（兼容 `mysql@2.x` 驱动的 `mysql_native_password` 认证） |
| 测试 | Jest + Supertest |

## 功能特性

### 后台管理系统

- 登录 / 退出（JWT 鉴权）
- 用户管理：列表、搜索、增删改、状态开关、角色分配
- 权限管理：权限列表（树形增删改）、角色列表（增删改、分配权限）
- 菜品管理：菜品列表、菜品分类、分类参数、添加 / 编辑菜品（富文本 + 图片上传 + 动态规格）
- 订单管理：列表、搜索、修改收货地址、取消订单、付款 / 发货状态、物流节点展示
- 数据统计：动态聚合仪表盘（统计卡片 + 订单趋势 + 角色分布 + 付款 / 发货统计）

### 顾客点餐端

- 注册 / 登录（独立顾客 JWT）
- 菜单浏览：分类、关键字搜索、真实菜品图片、可选规格（辣度 / 糖度 / 冰量）
- 购物车：跨规格分组、跨规格库存校验
- 下单：事务扣库存，支持备注与收货地址
- 模拟支付：微信 / 支付宝 / 余额三种方式（默认成功）
- 取消订单：未付款订单取消后自动回补库存
- 模拟物流：按支付时间动态推算节点（已下单 → 商家接单 → 制作中 → 骑手取餐 → 配送中 → 已送达），刷新 / 换设备保持进度

## 项目结构

```
csn/
├── server/                  # 后端
│   ├── index.js             # Express 入口（导出 app、条件监听，启动时自动跑 migrate）
│   ├── router.js            # 后台路由 + 业务逻辑 + 鉴权 / 权限 / 参数校验中间件
│   ├── shop.js              # 顾客点餐端 API（/api/shop）
│   ├── logistics.js         # 模拟物流动态推算（支付时间起算，前后端共用）
│   ├── config.js            # MySQL 连接池（配置走 .env）
│   ├── logger.js            # winston 日志（控制台 + 文件）
│   ├── migrate.js           # 启动时幂等迁移（字段 / 唯一索引 / 演示账号 / 演示菜品）
│   ├── menu_data.js         # 菜单单一数据源（分类树 / 菜品 / 规格）
│   ├── seed_menu.js         # 全量重置菜单（幂等）
│   ├── seed_images.js       # 招牌菜图片入库（幂等）
│   └── fetch_images.js      # 抓取菜品真实图片（必应图片搜索，幂等可重跑）
├── public-shop/             # 顾客点餐端前端（Vue2 + axios，无打包步骤）
│   ├── index.html
│   ├── css/app.css
│   ├── js/app.js
│   └── vendor/              # 本地 vue / axios（无 CDN 依赖）
├── src/                     # 后台前端源码
│   ├── api/                 # 接口定义（base.js / index.js）
│   ├── assets/              # 静态资源与全局样式
│   ├── components/          # 页面组件（user / power / foods / order / report 等）
│   ├── plugins/             # Element UI 按需引入
│   ├── router/              # 路由与权限守卫
│   ├── store/               # Vuex（登录态、角色）
│   └── utils/               # axios 封装、初始化
├── tests/                   # 接口自动化测试（Jest + Supertest）
├── upload/                  # 上传文件目录（已 .gitignore，图片不进版本库）
├── csn.sql                  # 建表 + 种子数据（含登录账号）
├── migrate_password.sql     # 密码哈希迁移脚本
├── migrate_order_items.sql  # 订单明细表迁移脚本
└── .env.example             # 环境变量模板
```

## 快速开始

### 1. 环境要求

- Node.js 14 ~ 16（推荐）；Node 17+ 需额外加 `--openssl-legacy-provider`（`npm run dev` 已内置处理）
- MySQL 5.7（本地或远程均可）

### 2. 安装依赖

```bash
npm install
```

> 若 `package-lock.json` 中的旧镜像域名导致安装失败，可改用 `npm install --registry=https://registry.npmmirror.com`。

### 3. 配置环境变量

复制模板并修改：

```bash
cp .env.example .env
```

`.env` 内容说明：

```ini
JWT_SECRET=请替换为随机长字符串   # JWT 签名密钥，生产环境务必改成随机长字符串
DB_HOST=localhost                 # 数据库主机
DB_USER=root                      # 数据库用户
DB_PASSWORD=                      # 数据库密码
DB_NAME=csn                       # 数据库名
```

### 4. 初始化数据库

创建数据库并导入建表脚本（含种子数据）：

```bash
mysql -uroot -p < csn.sql
```

> 后端启动时会自动执行 `server/migrate.js` 幂等迁移，补齐 `orders` 表的 `user_id` / `order_status` / `pay_time` 字段、唯一索引、顾客演示账号与演示菜品，无需手动跑迁移脚本。

### 5. 启动

**方式一：一条命令同时启动前后端**

```bash
npm run dev
```

**方式二：分开启动**

```bash
# 后端（端口 3000）
node server/index.js

# 后台前端（端口 8080，Node 17+ 需加 openssl 兼容参数）
npm run serve
# Windows Git Bash: NODE_OPTIONS=--openssl-legacy-provider npm run serve
```

启动后：

- 后台管理系统：`http://localhost:8080`
- 顾客点餐端：`http://localhost:3000/shop/`

## 默认账号

| 端 | 账号 | 密码 |
|---|---|---|
| 后台管理系统 | `admin` | `123456` |
| 后台管理系统 | `test` | `123456` |
| 顾客点餐端 | `xiaomei` | `123456` |

> - `admin` / `test` 来自 `csn.sql` 种子数据；`xiaomei` 由 `server/migrate.js` 启动时自动创建。
> - 密码均使用 bcrypt 哈希存储。

## 权限体系

系统采用「角色-权限」模型，并已打通鉴权链路：

```
登录 → 查询角色权限树 → 权限写入 JWT
        ↓
左侧菜单：仅显示角色拥有的模块
        ↓
后端接口：读接口按模块权限拦截（403），写接口仅管理员可用（403）
        ↓
前端 UI：普通用户隐藏写操作按钮（与后端双重防护）
```

- 管理员（rid=1）：全部功能可用
- 普通用户：默认分配「菜品 / 订单 / 数据统计」三个模块的只读权限，写操作返回 403

## 顾客点餐端 API

后端挂载于 `/api/shop`，使用独立顾客 JWT（`customer: true` 声明）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/shop/categories` | 分类列表 |
| GET | `/api/shop/foods` | 上架菜品列表（支持分类 / 关键字过滤） |
| GET | `/api/shop/foods/:id` | 菜品详情（已过滤下架菜品） |
| POST | `/api/shop/register` | 顾客注册 |
| POST | `/api/shop/login` | 顾客登录 |
| GET | `/api/shop/me` | 当前顾客信息 |
| POST | `/api/shop/orders` | 下单（事务扣库存，跨规格防超卖） |
| GET | `/api/shop/orders` | 我的订单（含明细与动态物流） |
| POST | `/api/shop/orders/:id/cancel` | 取消订单（未付款未发货，回补库存） |
| POST | `/api/shop/orders/:id/pay` | 模拟支付（生成支付单号，记录支付时间） |

## 测试

```bash
npm test
```

测试套件基于 Jest + Supertest（`tests/api.test.js`，20 个用例），覆盖登录、鉴权（401）、接口级权限（403）、参数校验（400）、字段脱敏、RESTful 写接口等场景。

## 注意事项

1. **Node 17+ 兼容**：Vue CLI 4 使用 webpack 4，Node 17+ 会报 `digital envelope routines::unsupported`，需 `NODE_OPTIONS=--openssl-legacy-provider`（`npm run dev` 已内置）。
2. **MySQL 版本**：`mysql@2.x` 驱动兼容 MySQL 5.7 的 `mysql_native_password`；使用 MySQL 8.0 时若启用默认的 `caching_sha2_password`，需为账号改用 `mysql_native_password` 认证。
3. **安全**：`.env`（含密钥）已加入 `.gitignore`，请勿提交；生产部署前务必更换 `JWT_SECRET`。
4. **鉴权**：后端接口统一走「身份鉴权(401) → 角色权限(403) → 参数校验(400) → 业务逻辑」三层中间件。
5. **日志**：运行日志输出到 `logs/`（`combined.log` 全量、`error.log` 仅错误）。
6. **菜品图片**：`upload/` 目录（51 道菜图片）已 `.gitignore` 忽略，不进版本库。克隆后如需补图，依次运行 `node server/seed_images.js`、`node server/fetch_images.js`（均幂等，可重跑）。
