CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text DEFAULT 'email' NOT NULL,
	`is_test` integer DEFAULT true NOT NULL,
	`external_id` text NOT NULL,
	`sender_name` text DEFAULT '' NOT NULL,
	`sender_email` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`category` text DEFAULT 'otro' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`consortium_id` text,
	`task_id` text,
	`created_by_id` text,
	`assigned_to_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`consortium_id`) REFERENCES `consorcios`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `claims_external_id_unique` ON `claims` (`external_id`);--> statement-breakpoint
CREATE INDEX `idx_claims_status_created` ON `claims` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_claims_consortium_id` ON `claims` (`consortium_id`);--> statement-breakpoint
CREATE INDEX `idx_claims_assigned_to_id` ON `claims` (`assigned_to_id`);