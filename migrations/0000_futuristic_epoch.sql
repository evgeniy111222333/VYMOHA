CREATE TABLE `analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tender_external_id` text NOT NULL,
	`tender_internal_id` text,
	`source_url` text NOT NULL,
	`title` text NOT NULL,
	`buyer` text NOT NULL,
	`amount_minor` integer,
	`currency` text,
	`deadline` text,
	`verdict` text NOT NULL,
	`score` integer NOT NULL,
	`mode` text NOT NULL,
	`result_json` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_analyses_user_created` ON `analyses` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_analyses_tender_external_id` ON `analyses` (`tender_external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_analyses_user_hash` ON `analyses` (`user_id`,`content_hash`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`ip_hash` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_user_created` ON `audit_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_resource` ON `audit_events` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`organization_id` text,
	`name` text NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_documents_user_created` ON `documents` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_documents_user_sha256` ON `documents` (`user_id`,`sha256`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`edrpou` text,
	`region` text,
	`cpv_codes_json` text DEFAULT '[]' NOT NULL,
	`capabilities_json` text DEFAULT '[]' NOT NULL,
	`certifications_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organizations_owner_user_id` ON `organizations` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_organizations_edrpou` ON `organizations` (`edrpou`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`bucket_key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_reset_at` ON `rate_limits` (`reset_at`);--> statement-breakpoint
CREATE TABLE `watches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tender_external_id` text NOT NULL,
	`last_modified` text,
	`last_hash` text,
	`notify_email` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_watches_user_tender` ON `watches` (`user_id`,`tender_external_id`);--> statement-breakpoint
CREATE INDEX `idx_watches_active` ON `watches` (`active`);