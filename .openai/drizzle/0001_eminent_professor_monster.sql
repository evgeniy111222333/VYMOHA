CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`analysis_id` text NOT NULL,
	`tier` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`cached_input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_microusd` integer DEFAULT 0 NOT NULL,
	`credits_charged` integer NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_usage_analysis_id` ON `ai_usage` (`analysis_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_usage_user_created` ON `ai_usage` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `credit_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`delta` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`reason` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_credit_ledger_user_created` ON `credit_ledger` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credit_ledger_idempotency` ON `credit_ledger` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `payment_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`package_id` text NOT NULL,
	`credits` integer NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider` text DEFAULT 'stripe' NOT NULL,
	`provider_session_id` text,
	`provider_payment_id` text,
	`created_at` text NOT NULL,
	`paid_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_payment_orders_user_created` ON `payment_orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payment_orders_provider_session` ON `payment_orders` (`provider_session_id`);--> statement-breakpoint
CREATE TABLE `user_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`credit_balance` integer DEFAULT 0 NOT NULL,
	`total_credits_purchased` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_accounts_email` ON `user_accounts` (`email`);--> statement-breakpoint
CREATE INDEX `idx_user_accounts_role_status` ON `user_accounts` (`role`,`status`);