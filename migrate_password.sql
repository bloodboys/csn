-- 密码哈希迁移脚本：将明文密码升级为 bcrypt 哈希
USE csn;
ALTER TABLE `user` MODIFY `password` VARCHAR(100) NOT NULL;
UPDATE `user` SET `password` = '$2b$10$jsrVKeVXww.NQqh6pL4zSu8aYm74z0M4CAp5uHlk1QZHBb1dXzr6i' WHERE `username` IN ('admin', 'test');
