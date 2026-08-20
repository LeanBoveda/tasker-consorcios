CREATE TABLE `email_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`notification_key` text NOT NULL,
	`recipient_email` text NOT NULL,
	`type` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reserved_at` integer,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_notifications_key_unique` ON `email_notifications` (`notification_key`);--> statement-breakpoint
CREATE INDEX `idx_email_notifications_status_created` ON `email_notifications` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `mail_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`intake_enabled` integer DEFAULT true NOT NULL,
	`inbox_address` text DEFAULT 'leandroboveda@gmail.com' NOT NULL,
	`subject_prefix` text DEFAULT '[RECLAMO]' NOT NULL,
	`lookback_days` integer DEFAULT 7 NOT NULL,
	`reminders_enabled` integer DEFAULT false NOT NULL,
	`reminder_recipients` text DEFAULT '[]' NOT NULL,
	`notify_urgent` integer DEFAULT true NOT NULL,
	`notify_due_today` integer DEFAULT true NOT NULL,
	`notify_overdue` integer DEFAULT true NOT NULL,
	`daily_summary` integer DEFAULT false NOT NULL,
	`reminder_hour` integer DEFAULT 9 NOT NULL,
	`timezone` text DEFAULT 'America/Buenos_Aires' NOT NULL,
	`updated_by_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
