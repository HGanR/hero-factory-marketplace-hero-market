-- Additive only. Apply to the owner-approved account schema before enabling this preview.
-- Existing avatar_profiles models, members, and saved assets are never modified.
CREATE TABLE IF NOT EXISTS mobile_member_profiles (
  member_id INT NOT NULL,
  banner_data MEDIUMTEXT NULL,
  avatar_data MEDIUMTEXT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (member_id)
) CHARACTER SET utf8mb4;
