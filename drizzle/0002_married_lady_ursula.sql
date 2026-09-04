ALTER TABLE `company_settings` ADD `latitude` text;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `longitude` text;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `allowed_radius_meters` integer DEFAULT 150 NOT NULL;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `require_location` integer DEFAULT true NOT NULL;