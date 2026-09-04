CREATE TABLE `company_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`legal_name` text DEFAULT '' NOT NULL,
	`trade_name` text DEFAULT '' NOT NULL,
	`document` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`timezone` text DEFAULT 'America/Fortaleza' NOT NULL,
	`tolerance_minutes` integer DEFAULT 10 NOT NULL,
	`logo_key` text,
	`updated_at` text NOT NULL
);
