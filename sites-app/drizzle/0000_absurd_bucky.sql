CREATE TABLE `login_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`csrf` text NOT NULL,
	`expires` integer NOT NULL,
	`password_version` text NOT NULL
);
