ALTER TABLE `claims` ADD `gmail_thread_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `claims_gmail_thread_id_unique` ON `claims` (`gmail_thread_id`);