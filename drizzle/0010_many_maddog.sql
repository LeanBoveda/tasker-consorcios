CREATE TABLE `daemon_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`host_name` text DEFAULT '' NOT NULL,
	`version` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'online' NOT NULL,
	`started_at` integer NOT NULL,
	`last_heartbeat_at` integer NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_daemon_instances_heartbeat` ON `daemon_instances` (`last_heartbeat_at`);--> statement-breakpoint
CREATE TABLE `daemon_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_id` text NOT NULL,
	`kind` text NOT NULL,
	`account` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`last_checked_at` integer NOT NULL,
	`last_message_at` integer,
	`last_error` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`instance_id`) REFERENCES `daemon_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daemon_sources_instance_kind_account_unique` ON `daemon_sources` (`instance_id`,`kind`,`account`);--> statement-breakpoint
CREATE INDEX `idx_daemon_sources_instance` ON `daemon_sources` (`instance_id`);--> statement-breakpoint
ALTER TABLE `comments` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `comments` ADD `external_author` text DEFAULT '' NOT NULL;