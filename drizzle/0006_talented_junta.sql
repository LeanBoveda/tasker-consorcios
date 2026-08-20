CREATE TABLE `email_intake_events` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text NOT NULL,
	`sender_email` text DEFAULT '' NOT NULL,
	`recipient_emails` text DEFAULT '' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`claim_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_intake_events_external_id_unique` ON `email_intake_events` (`external_id`);--> statement-breakpoint
CREATE INDEX `idx_email_intake_events_status_created` ON `email_intake_events` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `mail_settings` ADD `accepted_patterns` text DEFAULT '["RECLAMO","SOLICITUD","PEDIDO"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `mail_settings` ADD `ignored_subject_patterns` text DEFAULT '["[TASKER]","RESPUESTA AUTOMÁTICA","FUERA DE LA OFICINA"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `mail_settings` ADD `blocked_senders` text DEFAULT '["no-reply","noreply"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `mail_settings` ADD `minimum_body_length` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `mail_settings` ADD `last_sync_at` integer;--> statement-breakpoint
ALTER TABLE `mail_settings` ADD `last_sync_status` text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE `mail_settings` ADD `last_sync_detail` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mail_settings` ADD `last_sync_processed` integer DEFAULT 0 NOT NULL;