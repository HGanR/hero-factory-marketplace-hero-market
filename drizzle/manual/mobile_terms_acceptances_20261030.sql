-- Additive migration only. Apply to a test database first.
-- Production execution requires the owner's explicit approval.
-- No member rows, credentials, permissions, or existing agreements are modified.
CREATE TABLE IF NOT EXISTS mobile_terms_documents (
  terms_version VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  terms_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  title VARCHAR(255) NOT NULL,
  content_html MEDIUMTEXT NOT NULL,
  archived_at DATETIME(3) NOT NULL,
  PRIMARY KEY (terms_version, terms_sha256)
) CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS mobile_terms_acceptances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_id INT NOT NULL,
  terms_version VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  terms_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  accepted_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mobile_member_terms (member_id, terms_version, terms_sha256),
  KEY ix_mobile_terms_accepted_at (accepted_at)
);
