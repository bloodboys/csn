-- =============================================================
-- 吃啥呢外卖后台管理系统 数据库初始化脚本
-- 数据库: csn  字符集: utf8mb4
-- 说明: 本项目仓库原本不含任何建表 SQL，此脚本依据 server/router.js
--       及前端各组件字段反推补齐，含最小可运行的种子数据。
-- 登录账号: admin / 123456
-- =============================================================

SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS `csn` DEFAULT CHARACTER SET utf8mb4;
USE `csn`;

-- -------------------------------------------------------------
-- 用户表
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id`        INT PRIMARY KEY AUTO_INCREMENT,
  `rid`       INT          DEFAULT NULL,
  `username`  VARCHAR(50)  NOT NULL,
  `password`  VARCHAR(100) NOT NULL,
  `mobile`    VARCHAR(20)  DEFAULT NULL,
  `email`     VARCHAR(50)  DEFAULT NULL,
  `mg_state`  TINYINT      DEFAULT 1,
  `role_name` VARCHAR(20)  DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `user` (`rid`,`username`,`password`,`mobile`,`email`,`mg_state`,`role_name`) VALUES
(1,'admin','$2b$10$jsrVKeVXww.NQqh6pL4zSu8aYm74z0M4CAp5uHlk1QZHBb1dXzr6i','13800000000','admin@csn.com',1,'管理员'),
(2,'test','$2b$10$jsrVKeVXww.NQqh6pL4zSu8aYm74z0M4CAp5uHlk1QZHBb1dXzr6i','13900000000','test@csn.com',1,'普通用户');

-- -------------------------------------------------------------
-- 左侧菜单表 (children 为二级菜单 JSON 字符串)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `menus`;
CREATE TABLE `menus` (
  `id`       INT PRIMARY KEY,
  `authName` VARCHAR(50)  DEFAULT NULL,
  `children` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `menus` (`id`,`authName`,`children`) VALUES
(101,'用户管理','[{"id":10101,"authName":"用户列表","path":"userlist"}]'),
(102,'权限管理','[{"id":10201,"authName":"权限列表","path":"permissionlist"},{"id":10202,"authName":"角色列表","path":"rolelist"}]'),
(103,'菜品管理','[{"id":10301,"authName":"菜品分类","path":"foodclass"},{"id":10302,"authName":"分类参数","path":"classparam"},{"id":10303,"authName":"菜品列表","path":"foodlist"}]'),
(104,'订单管理','[{"id":10401,"authName":"订单列表","path":"orderlist"}]'),
(105,'数据统计','[{"id":10501,"authName":"数据报表","path":"datareport"}]');

-- -------------------------------------------------------------
-- 权限列表 (扁平, 权限列表页使用)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `rights`;
CREATE TABLE `rights` (
  `id`       INT PRIMARY KEY AUTO_INCREMENT,
  `authName` VARCHAR(50)  DEFAULT NULL,
  `path`     VARCHAR(100) DEFAULT NULL,
  `level`    VARCHAR(10)  DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `rights` (`authName`,`path`,`level`) VALUES
('用户管理','users','0'),
('用户列表','users','1'),
('权限管理','rights','0'),
('权限列表','rights','1'),
('角色管理','roles','0'),
('角色列表','roles','1'),
('菜品管理','foods','0'),
('菜品分类','categories','1'),
('菜品列表','foods','1'),
('订单管理','orders','0'),
('订单列表','orders','1');

-- -------------------------------------------------------------
-- 角色表 (children 为已分配权限 JSON 字符串)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id`       INT PRIMARY KEY AUTO_INCREMENT,
  `roleName` VARCHAR(50) DEFAULT NULL,
  `roleDesc` VARCHAR(200) DEFAULT NULL,
  `children` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `roles` (`roleName`,`roleDesc`,`children`) VALUES
('管理员','拥有全部权限',NULL),
('普通用户','拥有部分权限','[{"id":103,"authName":"菜品管理","path":"foods"},{"id":104,"authName":"订单管理","path":"orders"},{"id":105,"authName":"数据统计","path":"report"}]');

-- -------------------------------------------------------------
-- 全部权限树 (children 为权限树 JSON 字符串, 分配权限弹窗使用)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `allrights`;
CREATE TABLE `allrights` (
  `id`       INT PRIMARY KEY,
  `children` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `allrights` (`id`,`children`) VALUES
(1,'[{"id":101,"authName":"用户管理","path":"users","children":[{"id":10101,"authName":"用户列表","path":"userlist"}]},{"id":102,"authName":"权限管理","path":"rights","children":[{"id":10201,"authName":"权限列表","path":"permissionlist"},{"id":10202,"authName":"角色列表","path":"rolelist"}]},{"id":103,"authName":"菜品管理","path":"foods","children":[{"id":10301,"authName":"菜品分类","path":"foodclass"},{"id":10302,"authName":"分类参数","path":"classparam"},{"id":10303,"authName":"菜品列表","path":"foodlist"}]},{"id":104,"authName":"订单管理","path":"orders","children":[{"id":10401,"authName":"订单列表","path":"orderlist"}]},{"id":105,"authName":"数据统计","path":"report","children":[{"id":10501,"authName":"数据报表","path":"datareport"}]}]');

-- -------------------------------------------------------------
-- 菜品分类表 (children 为三级分类树 JSON 字符串, 固定 id=1)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `foodscate`;
CREATE TABLE `foodscate` (
  `id`       INT PRIMARY KEY,
  `children` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `foodscate` (`id`,`children`) VALUES
(1,'[{"cat_id":1,"cat_name":"家常菜","cat_pid":0,"cat_level":0,"cat_deleted":false,"children":[{"cat_id":1,"cat_name":"热菜","cat_pid":1,"cat_level":1,"cat_ppid":[1],"cat_deleted":false,"children":[{"cat_id":1,"cat_name":"川菜","cat_pid":1,"cat_level":2,"cat_ppid":[1,1],"cat_deleted":false}]}]},{"cat_id":2,"cat_name":"饮品","cat_pid":0,"cat_level":0,"cat_deleted":false,"children":[{"cat_id":1,"cat_name":"奶茶","cat_pid":2,"cat_level":1,"cat_ppid":[2],"cat_deleted":false,"children":[{"cat_id":1,"cat_name":"奶茶(大杯)","cat_pid":1,"cat_level":2,"cat_ppid":[2,1],"cat_deleted":false}]}]}]');

-- -------------------------------------------------------------
-- 分类参数表 (attr_sel: many=动态参数 / only=静态属性)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `cateparams`;
CREATE TABLE `cateparams` (
  `attr_id`    INT PRIMARY KEY AUTO_INCREMENT,
  `attr_name`  VARCHAR(50)  DEFAULT NULL,
  `cat_id`     VARCHAR(50)  DEFAULT NULL,
  `attr_sel`   VARCHAR(10)  DEFAULT NULL,
  `attr_write` VARCHAR(10)  DEFAULT NULL,
  `attr_vals`  VARCHAR(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `cateparams` (`attr_name`,`cat_id`,`attr_sel`,`attr_write`,`attr_vals`) VALUES
('辣度','[1,1,1]','many','list','微辣,中辣,重辣'),
('份量','[1,1,1]','many','list','小份,大份'),
('品牌','[2,1,1]','only','manual','');

-- -------------------------------------------------------------
-- 菜品表
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `food`;
CREATE TABLE `food` (
  `foods_id`         INT PRIMARY KEY AUTO_INCREMENT,
  `foods_name`       VARCHAR(50)  DEFAULT NULL,
  `foods_price`      VARCHAR(20)  DEFAULT NULL,
  `cat_id`           VARCHAR(50)  DEFAULT NULL,
  `foods_number`     INT          DEFAULT 0,
  `foods_weight`     VARCHAR(20)  DEFAULT NULL,
  `foods_introduce`  TEXT,
  `foods_logo`       VARCHAR(255) DEFAULT NULL,
  `add_time`         BIGINT       DEFAULT NULL,
  `upd_time`         BIGINT       DEFAULT NULL,
  `goods_state`      TINYINT      DEFAULT NULL,
  `is_promote`       TINYINT      DEFAULT 0,
  `pics`             TEXT,
  `attrs`            TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `food` (`foods_name`,`foods_price`,`cat_id`,`foods_number`,`foods_weight`,`foods_introduce`,`add_time`,`upd_time`,`pics`,`attrs`) VALUES
('尖椒红烧肉','28','1,1,1',100,'500g','经典川菜，香辣下饭。',UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),'[]','[]');

-- -------------------------------------------------------------
-- 订单表
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `order_id`     INT PRIMARY KEY AUTO_INCREMENT,
  `order_number` VARCHAR(50)   DEFAULT NULL,
  `order_price`  VARCHAR(20)   DEFAULT NULL,
  `pay_status`   TINYINT       DEFAULT 0,
  `is_send`      TINYINT       DEFAULT 0,
  `create_time`  BIGINT        DEFAULT NULL,
  `logistics`    TEXT,
  `address`      VARCHAR(255)  DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `orders` (`order_number`,`order_price`,`pay_status`,`is_send`,`create_time`,`logistics`) VALUES
('20261114000001','32',1,1,UNIX_TIMESTAMP()-6*86400,'[]'),
('20261114000002','18',0,0,UNIX_TIMESTAMP()-6*86400,'[]'),
('20261115000001','45',1,1,UNIX_TIMESTAMP()-5*86400,'[]'),
('20261116000001','26',1,0,UNIX_TIMESTAMP()-4*86400,'[]'),
('20261116000002','55',1,1,UNIX_TIMESTAMP()-4*86400,'[]'),
('20261117000001','20',0,0,UNIX_TIMESTAMP()-3*86400,'[]'),
('20261118000001','38',1,1,UNIX_TIMESTAMP()-2*86400,'[]'),
('20261118000002','15',1,0,UNIX_TIMESTAMP()-2*86400,'[]'),
('20261119000001','60',1,1,UNIX_TIMESTAMP()-1*86400,'[]'),
('20261119000002','22',0,0,UNIX_TIMESTAMP()-1*86400,'[]'),
('20261120000001','28',1,1,UNIX_TIMESTAMP(),'[{"time":"2026-11-20 10:00:00","context":"订单已提交"},{"time":"2026-11-20 10:30:00","context":"商家已接单"},{"time":"2026-11-20 11:00:00","context":"骑手配送中"},{"time":"2026-11-20 11:30:00","context":"已送达"}]');

-- -------------------------------------------------------------
-- 数据报表表 (data 为 echarts option JSON)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `report`;
CREATE TABLE `report` (
  `id`   INT PRIMARY KEY,
  `data` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `report` (`id`,`data`) VALUES
(1,'{"xAxis":[{"type":"category","data":["周一","周二","周三","周四","周五","周六","周日"]}],"series":[{"name":"用户来源","type":"line","data":[120,200,150,80,70,110,130]}]}');
