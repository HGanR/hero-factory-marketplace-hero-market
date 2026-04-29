CREATE TABLE `challenge_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`challengeKey` varchar(64) NOT NULL,
	`rulesVersion` varchar(16) NOT NULL,
	`rubricVersion` varchar(16) NOT NULL,
	`scoringVersion` varchar(16) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'draft',
	`answers` json,
	`totalScore` int,
	`phaseScores` json,
	`submissionHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `challenge_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `challenge_submissions_submissionId_unique` UNIQUE(`submissionId`)
);
--> statement-breakpoint
CREATE INDEX `challenge_submissions_user_idx` ON `challenge_submissions` (`userId`);
--> statement-breakpoint
CREATE INDEX `challenge_submissions_challenge_key_idx` ON `challenge_submissions` (`challengeKey`);
--> statement-breakpoint
CREATE INDEX `challenge_submissions_status_idx` ON `challenge_submissions` (`status`);
--> statement-breakpoint
CREATE TABLE `challenge_credits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`challengeKey` varchar(64) NOT NULL,
	`creditType` varchar(48) NOT NULL,
	`amount` int NOT NULL,
	`appliedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `challenge_credits_id` PRIMARY KEY(`id`),
	CONSTRAINT `challenge_credits_submissionId_unique` UNIQUE(`submissionId`)
);
--> statement-breakpoint
CREATE INDEX `challenge_credits_user_idx` ON `challenge_credits` (`userId`);
--> statement-breakpoint
CREATE INDEX `challenge_credits_challenge_key_idx` ON `challenge_credits` (`challengeKey`);
--> statement-breakpoint
CREATE TABLE `challenge_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`action` varchar(64) NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `challenge_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `challenge_audit_log_submission_idx` ON `challenge_audit_log` (`submissionId`);
