CREATE TABLE `analysis_telemetry` (
	`id` text PRIMARY KEY NOT NULL,
	`analysis_id` text NOT NULL,
	`user_hash` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`tier` text NOT NULL,
	`status` text NOT NULL,
	`error_code` text,
	`duration_ms` integer NOT NULL,
	`document_count` integer DEFAULT 0 NOT NULL,
	`documents_read` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`cached_input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_microusd` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_analysis_telemetry_created` ON `analysis_telemetry` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_analysis_telemetry_expires` ON `analysis_telemetry` (`expires_at`);--> statement-breakpoint
CREATE TABLE `error_events` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`source` text NOT NULL,
	`route` text,
	`error_name` text NOT NULL,
	`error_message` text NOT NULL,
	`stack` text,
	`context_json` text DEFAULT '{}' NOT NULL,
	`severity` text DEFAULT 'error' NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `error_events_fingerprint_unique` ON `error_events` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `idx_error_events_last_seen` ON `error_events` (`last_seen`);--> statement-breakpoint
CREATE TABLE `market_index_progress` (
	`key` text PRIMARY KEY NOT NULL,
	`cursor` text,
	`finished` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `market_tenders` (
	`id` text PRIMARY KEY NOT NULL,
	`tender_external_id` text NOT NULL,
	`cpv8` text NOT NULL,
	`cpv5` text NOT NULL,
	`cpv3` text NOT NULL,
	`region` text,
	`method` text,
	`expected_amount` real NOT NULL,
	`currency` text,
	`participants` integer DEFAULT 0 NOT NULL,
	`winning_amount` real,
	`winner_edrpou` text,
	`completed_at` text,
	`indexed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_tenders_cpv5_completed` ON `market_tenders` (`cpv5`,`completed_at`);--> statement-breakpoint
CREATE INDEX `idx_market_tenders_cpv3_completed` ON `market_tenders` (`cpv3`,`completed_at`);--> statement-breakpoint
CREATE INDEX `idx_market_tenders_region_completed` ON `market_tenders` (`region`,`completed_at`);--> statement-breakpoint
CREATE TABLE `public_tender_summaries` (
	`tender_external_id` text PRIMARY KEY NOT NULL,
	`tender_date_modified` text,
	`title` text NOT NULL,
	`buyer` text NOT NULL,
	`buyer_edrpou` text,
	`amount_minor` integer,
	`currency` text,
	`deadline` text,
	`status` text NOT NULL,
	`method` text,
	`cpv_code` text,
	`cpv_label` text,
	`document_count` integer DEFAULT 0 NOT NULL,
	`verdict` text NOT NULL,
	`score` integer NOT NULL,
	`confidence` integer NOT NULL,
	`summary` text NOT NULL,
	`result_json` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_public_summaries_expires_at` ON `public_tender_summaries` (`expires_at`);--> statement-breakpoint
CREATE TABLE `seo_alert_state` (
	`check_name` text PRIMARY KEY NOT NULL,
	`last_status` text NOT NULL,
	`last_alert_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seo_backfill_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job` text NOT NULL,
	`processed` integer DEFAULT 0 NOT NULL,
	`upserted` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_seo_backfill_runs_created` ON `seo_backfill_runs` (`created_at`);--> statement-breakpoint
CREATE TABLE `seo_health_events` (
	`id` text PRIMARY KEY NOT NULL,
	`check_name` text NOT NULL,
	`status` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_seo_health_events_created` ON `seo_health_events` (`created_at`);