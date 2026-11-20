USE csn;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `order_items` (
  `id`          INT PRIMARY KEY AUTO_INCREMENT,
  `order_id`    INT          NOT NULL,
  `foods_id`    INT          DEFAULT NULL,
  `foods_name`  VARCHAR(50)  DEFAULT NULL,
  `foods_price` VARCHAR(20)  DEFAULT NULL,
  `count`       INT          DEFAULT 1,
  KEY `idx_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `order_items` (`order_id`,`foods_id`,`foods_name`,`foods_price`,`count`)
SELECT t.order_id, t.foods_id, t.foods_name, t.foods_price, t.cnt
FROM (
  SELECT 7 AS order_id, 1 AS foods_id, '尖椒红烧肉' AS foods_name, '28' AS foods_price, 1 AS cnt
  UNION ALL SELECT 7, NULL, '可乐', '5', 2
  UNION ALL SELECT 8, NULL, '鸡蛋汤', '15', 1
  UNION ALL SELECT 9, 1, '尖椒红烧肉', '28', 2
  UNION ALL SELECT 9, NULL, '米饭', '2', 2
  UNION ALL SELECT 11, 1, '尖椒红烧肉', '28', 1
) t
WHERE NOT EXISTS (SELECT 1 FROM order_items LIMIT 1);
