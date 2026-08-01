CREATE TABLE `auth_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_subject` text NOT NULL,
	`secret_hash` text,
	`secret_salt` text,
	`verified_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auth_identities_provider_subject` ON `auth_identities` (`provider`,`provider_subject`);--> statement-breakpoint
CREATE INDEX `idx_auth_identities_user_id` ON `auth_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`user_agent_hash` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_user_expires` ON `auth_sessions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_expires_at` ON `auth_sessions` (`expires_at`);--> statement-breakpoint
ALTER TABLE `user_accounts` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `user_accounts` ADD `avatar_url` text;--> statement-breakpoint
ALTER TABLE `user_accounts` ADD `email_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_accounts` ADD `phone_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `user_accounts` SET `email_verified` = true WHERE `email` NOT LIKE '%@phone.vymoha.invalid';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_accounts_phone` ON `user_accounts` (`phone`);
