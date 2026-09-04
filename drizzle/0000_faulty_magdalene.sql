CREATE TABLE `adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`punch_date` text NOT NULL,
	`requested_time` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`cpf` text NOT NULL,
	`code` text NOT NULL,
	`pin_hash` text NOT NULL,
	`role` text NOT NULL,
	`department` text DEFAULT 'Geral' NOT NULL,
	`workdays` text DEFAULT 'Seg a Sex' NOT NULL,
	`start_time` text DEFAULT '08:00' NOT NULL,
	`break_start` text DEFAULT '12:00' NOT NULL,
	`break_end` text DEFAULT '13:00' NOT NULL,
	`end_time` text DEFAULT '17:00' NOT NULL,
	`weekly_minutes` integer DEFAULT 2640 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_cpf_unique` ON `employees` (`cpf`);--> statement-breakpoint
CREATE UNIQUE INDEX `employees_code_unique` ON `employees` (`code`);--> statement-breakpoint
CREATE TABLE `punches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`kind` text NOT NULL,
	`local_date` text NOT NULL,
	`occurred_at` text NOT NULL,
	`source` text DEFAULT 'totem' NOT NULL,
	`latitude` text,
	`longitude` text,
	`device` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
