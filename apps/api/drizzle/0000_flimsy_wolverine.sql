CREATE TABLE `sakes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brewery` text,
	`type` text NOT NULL,
	`rating` integer,
	`memo` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
