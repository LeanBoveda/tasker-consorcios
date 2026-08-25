DELETE FROM `automatic_intake`;--> statement-breakpoint
DELETE FROM `email_notifications`;--> statement-breakpoint
DELETE FROM `email_intake_events`;--> statement-breakpoint
DELETE FROM `claims`;--> statement-breakpoint
DELETE FROM `comments`;--> statement-breakpoint
DELETE FROM `tasks`;--> statement-breakpoint
DROP TABLE `email_intake_events`;--> statement-breakpoint
DROP TABLE `email_notifications`;--> statement-breakpoint
DROP TABLE `claims`;--> statement-breakpoint
DROP TABLE `mail_settings`;--> statement-breakpoint
PRAGMA optimize;
