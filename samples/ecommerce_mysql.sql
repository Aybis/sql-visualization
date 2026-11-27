-- MySQL Dump: E-Commerce Platform
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8mb4 */;

CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `full_name` varchar(120) NOT NULL,
  `phone` varchar(32) DEFAULT NULL,
  `role` enum('customer','vendor','admin') NOT NULL DEFAULT 'customer',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Registered platform accounts';

CREATE TABLE `user_profiles` (
  `user_id` bigint unsigned NOT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `bio` text,
  `locale` varchar(16) NOT NULL DEFAULT 'en-US',
  `loyalty_points` int unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='1:1 extended user profile';

CREATE TABLE `addresses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `label` varchar(40) NOT NULL DEFAULT 'Home',
  `street` varchar(255) NOT NULL,
  `city` varchar(100) NOT NULL,
  `postal_code` varchar(20) NOT NULL,
  `country_code` char(2) NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_addresses_user` (`user_id`),
  CONSTRAINT `fk_addresses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `categories` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `parent_id` int unsigned DEFAULT NULL,
  `slug` varchar(120) NOT NULL,
  `name` varchar(120) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categories_slug` (`slug`),
  CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Self-referencing category tree';

CREATE TABLE `products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `category_id` int unsigned NOT NULL,
  `vendor_id` bigint unsigned NOT NULL,
  `sku` varchar(64) NOT NULL,
  `name` varchar(200) NOT NULL,
  `price` decimal(12,2) NOT NULL,
  `stock_qty` int NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_products_sku` (`sku`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_products_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `shipping_address_id` bigint unsigned DEFAULT NULL,
  `order_number` varchar(40) NOT NULL,
  `status` enum('pending','paid','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  `total_amount` decimal(12,2) NOT NULL,
  `ordered_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_orders_number` (`order_number`)
) ENGINE=InnoDB;

CREATE TABLE `order_items` (
  `order_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `quantity` int unsigned NOT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  PRIMARY KEY (`order_id`, `product_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE `payments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `provider` varchar(40) NOT NULL,
  `transaction_ref` varchar(128) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `status` enum('authorized','captured','refunded','failed') NOT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payments_tx` (`transaction_ref`),
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `reviews` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `rating` tinyint unsigned NOT NULL,
  `body` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reviews_product_user` (`product_id`, `user_id`)
) ENGINE=InnoDB;

-- Post-table ALTER TABLE constraints (just like real mysqldump exports)
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_orders_address` FOREIGN KEY (`shipping_address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL;

ALTER TABLE `reviews`
  ADD CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
