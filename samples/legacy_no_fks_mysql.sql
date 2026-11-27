-- Standalone sample: Legacy MySQL schema WITHOUT explicit FOREIGN KEY constraints
-- Great for testing the "Infer FKs" feature!
CREATE TABLE `customers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `name` VARCHAR(120) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM;

CREATE TABLE `stores` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `city` VARCHAR(80) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM;

CREATE TABLE `invoices` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` INT UNSIGNED NOT NULL,
  `store_id` INT UNSIGNED NOT NULL,
  `total` DECIMAL(10,2) NOT NULL,
  `issued_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM;

CREATE TABLE `invoice_lines` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_id` INT UNSIGNED NOT NULL,
  `sku` VARCHAR(64) NOT NULL,
  `qty` INT NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM;
