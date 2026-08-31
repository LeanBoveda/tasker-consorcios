DROP INDEX `automatic_intake_source_external_unique`;--> statement-breakpoint
ALTER TABLE `automatic_intake` ADD `workspace_id` text DEFAULT 'main' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `automatic_intake_workspace_external_unique` ON `automatic_intake` (`workspace_id`,`source`,`source_account`,`external_id`);--> statement-breakpoint
DROP INDEX `consorcios_name_unique`;--> statement-breakpoint
ALTER TABLE `consorcios` ADD `workspace_id` text DEFAULT 'main' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `consorcios_workspace_name_unique` ON `consorcios` (`workspace_id`,`name`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `workspace_id` text DEFAULT 'main' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_tasks_workspace` ON `tasks` (`workspace_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `workspace_id` text DEFAULT 'main' NOT NULL;--> statement-breakpoint
-- Create the isolated profile once. Never overwrite an existing account.
INSERT INTO `users` (`id`, `workspace_id`, `username`, `email`, `name`, `role`, `status`,
  `password_hash`, `password_salt`, `password_iterations`, `created_at`, `last_seen_at`)
SELECT 'd79be8bc-b585-4d99-9a58-1d4e17593c92', 'test', 'test', 'sandbox-test@tasker.local',
  'Perfil de prueba', 'admin', 'active',
  'a1e12b87d4a90d01916fa40cf1c95add8ac4c9cb5f9e9362700a011ad9a349ea',
  '459994116834b001743ae51ce8738285', 100000, 1788207281586, 1788207281586
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE lower(`username`) = 'test'
  OR `email` = 'sandbox-test@tasker.local');
