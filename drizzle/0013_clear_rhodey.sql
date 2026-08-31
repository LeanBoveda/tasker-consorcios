CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`actor_username` text DEFAULT '' NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`entity_label` text NOT NULL,
	`details` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activity_workspace_created_id` ON `activity_log` (`workspace_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_activity_workspace_actor_created` ON `activity_log` (`workspace_id`,`actor_id`,`created_at`);