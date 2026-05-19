-- Executive inbox: structured attachments (files + voice notes) per message
ALTER TABLE `executive_department_messages`
  ADD COLUMN `attachmentsJson` text NULL AFTER `metadataJson`;
