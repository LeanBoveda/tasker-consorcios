CREATE TABLE `consorcios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `consorcios_name_unique` ON `consorcios` (`name`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `consortium_id` text REFERENCES consorcios(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `idx_tasks_consortium_id` ON `tasks` (`consortium_id`);
