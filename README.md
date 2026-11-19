# 吃啥呢外卖后台管理系统（csn）

一个基于 Vue 2 + Node.js + MySQL 的前后端分离外卖后台管理系统，覆盖用户、权限、菜品、订单、数据统计等核心模块。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 2.6、Vue CLI 4.5、Element UI、Vuex、Vue Router、ECharts |
| 后端 | Node.js、Express 4、jsonwebtoken（JWT）、multer（上传）、bcryptjs（密码哈希）、joi（参数校验）、winston（日志） |
| 数据库 | MySQL 5.7（推荐，兼容 `mysql@2.x` 驱动的 `mysql_native_password` 认证） |
| 测试 | Jest + Supertest |

## 功能模块

- 登录 / 退出（JWT 鉴权）
- 用户管理：列表、搜索、增删改、状态开关、角色分配
- 权限管理：权限列表（树形增删改）、角色列表（增删改、分配权限）
- 菜品管理：菜品列表、菜品分类、分类参数、添加/编辑菜品（富文本 + 图片上传 + 动态参数）
- 订单管理：列表、搜索、修改收货地址、物流进度
- 数据统计：动态聚合仪表盘（统计卡片 + 订单趋势 + 角色分布）

## 项目结构

```
csn/
├── server/                  # 后端
│   ├── index.js             # Express 入口（导出 app、条件监听）
│   ├── router.js            # 路由 + 业务逻辑 + 鉴权/权限/参数校验中间件
│   ├── config.js            # MySQL 连接池（配置走 .env）
│   └── logger.js            # winston 日志（控制台 + 文件）
├── src/                     # 前端源码
│   ├── api/                 # 接口定义（base.js / index.js）
│   ├── assets/              # 静态资源与全局样式
│   ├── components/          # 页面组件（user/power/foods/order/report 等）
│   ├── plugins/             # Element UI 按需引入
│   ├── router/              # 路由与权限守卫
│   ├── store/               # Vuex（登录态、角色）
│   └── utils/               # axios 封装、初始化
├── tests/                   # 接口自动化测试（Jest + Supertest）
├── upload/                  # 上传文件目录
├── csn.sql                  # 建表 + 种子数据（含登录账号）
├── migrate_password.sql     # 密码哈希迁移脚本
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
JWT_SECRET=csn-dev-secret-change-me   # JWT 签名密钥，生产环境务必改成随机长字符串
DB_HOST=localhost                     # 数据库主机
DB_USER=root                          # 数据库用户
DB_PASSWORD=                          # 数据库密码
DB_NAME=csn                           # 数据库名
```

### 4. 初始化数据库

创建数据库并导入建表脚本（含种子数据）：

```bash
mysql -uroot -p < csn.sql
```

### 5. 启动

**方式一：一条命令同时启动前后端**

```bash
npm run dev
```

**方式二：分开启动**

```bash
# 后端（端口 3000）
node server/index.js

# 前端（端口 8080，Node 17+ 需加 openssl 兼容参数）
npm run serve
# Windows Git Bash: NODE_OPTIONS=--openssl-legacy-provider npm run serve
```

启动后浏览器访问 `http://localhost:8080`。

## 默认账号

| 角色 | 账号 | 密码 |
|---|---|---|
| 管理员 | `admin` | `123456` |
| 普通用户 | `test` | `123456` |

> 密码已使用 bcrypt 哈希存储（`csn.sql` 中 seed 密码即哈希值）。

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

在「权限管理」中新增/编辑的权限，会同步反映到「角色列表 → 分配权限」的权限树中。

## 测试

```bash
npm test
```

测试套件基于 Jest + Supertest，覆盖登录、鉴权（401）、接口级权限（403）、参数校验（400）、字段脱敏、RESTful 写接口等场景。

## 注意事项

1. **Node 17+ 兼容**：Vue CLI 4 使用 webpack 4，Node 17+ 会报 `digital envelope routines::unsupported`，需 `NODE_OPTIONS=--openssl-legacy-provider`（`npm run dev` 已内置）。
2. **MySQL 版本**：`mysql@2.x` 驱动兼容 MySQL 5.7 的 `mysql_native_password`；使用 MySQL 8.0 时若启用默认的 `caching_sha2_password`，需要为账号改用 `mysql_native_password` 认证。
3. **安全**：`.env`（含密钥）已加入 `.gitignore`，请勿提交；生产部署前务必更换 `JWT_SECRET`。
4. **鉴权**：后端接口统一走「身份鉴权(401) → 角色权限(403) → 参数校验(400) → 业务逻辑」三层中间件。
5. **日志**：运行日志输出到 `logs/`（`combined.log` 全量、`error.log` 仅错误）。
