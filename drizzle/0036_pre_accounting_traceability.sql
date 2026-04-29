-- Pre-accounting: document traceability, form matrix, handoff composition, internal notes

ALTER TABLE `accounting_profiles`
ADD `internalReviewNotes` text;
--> statement-breakpoint
ALTER TABLE `accounting_profiles`
ADD `defaultHandoffCompositionJson` text;
--> statement-breakpoint

ALTER TABLE `accounting_document_records`
ADD `reportType` varchar(64);
--> statement-breakpoint
ALTER TABLE `accounting_document_records`
ADD `ledgerContextJson` text;
--> statement-breakpoint
ALTER TABLE `accounting_document_records`
ADD `includeInHandoff` boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE `accounting_document_records`
ADD `linkedFormCodesJson` text;
--> statement-breakpoint
ALTER TABLE `accounting_document_records`
ADD `internalReviewerNotes` text;
--> statement-breakpoint

ALTER TABLE `tax_form_candidates`
ADD `requiredRecordsJson` text;
--> statement-breakpoint
ALTER TABLE `tax_form_candidates`
ADD `attachedDocumentIdsJson` text;
--> statement-breakpoint
ALTER TABLE `tax_form_candidates`
ADD `missingSupportJson` text;
--> statement-breakpoint
ALTER TABLE `tax_form_candidates`
ADD `reviewerStatus` varchar(40) NOT NULL DEFAULT 'pending_review';
--> statement-breakpoint
ALTER TABLE `tax_form_candidates`
ADD `reviewerNotes` text;
--> statement-breakpoint

ALTER TABLE `tax_preparer_handoffs`
ADD `compositionJson` text;
--> statement-breakpoint

DELETE t1 FROM `tax_form_candidates` t1
INNER JOIN `tax_form_candidates` t2
  ON t1.`accountingProfileId` = t2.`accountingProfileId`
  AND t1.`formCode` = t2.`formCode`
  AND t1.`id` > t2.`id`;
--> statement-breakpoint

CREATE UNIQUE INDEX `tax_form_candidates_profile_form_uidx` ON `tax_form_candidates` (`accountingProfileId`,`formCode`);
