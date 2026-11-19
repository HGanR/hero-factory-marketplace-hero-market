-- Apply only after checking the existing wizard_sessions table definition.
-- Required before enabling the revocable wizard. Preserves existing rows.
ALTER TABLE wizard_sessions
  MODIFY COLUMN kind ENUM('IRREVOCABLE_TRUST','REVOCABLE_TRUST') NOT NULL;
