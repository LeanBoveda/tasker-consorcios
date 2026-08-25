CREATE TABLE `automatic_intake` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_account` text DEFAULT '' NOT NULL,
	`external_id` text NOT NULL,
	`conversation_id` text,
	`sender_name` text DEFAULT '' NOT NULL,
	`sender_address` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'other' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`consortium_id` text,
	`task_id` text,
	`attachments` text DEFAULT '[]' NOT NULL,
	`is_test` integer DEFAULT false NOT NULL,
	`error_detail` text DEFAULT '' NOT NULL,
	`received_at` integer NOT NULL,
	`reviewed_by_id` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`consortium_id`) REFERENCES `consorcios`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automatic_intake_source_external_unique` ON `automatic_intake` (`source`,`source_account`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_automatic_intake_status_created` ON `automatic_intake` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_automatic_intake_source_account` ON `automatic_intake` (`source`,`source_account`,`received_at`);--> statement-breakpoint
CREATE INDEX `idx_automatic_intake_task_id` ON `automatic_intake` (`task_id`);