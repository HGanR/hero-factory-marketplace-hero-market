-- Review/apply explicitly before releasing administrator profile persistence.
-- Additive; member tables, passwords, worlds, assets and terms are unchanged.
CREATE TABLE IF NOT EXISTS mobile_administrator_profiles (
  administrator_username VARCHAR(100) COLLATE utf8mb4_bin NOT NULL,
  banner_data MEDIUMTEXT NULL,
  avatar_data MEDIUMTEXT NULL,
  skin VARCHAR(16) NOT NULL DEFAULT 'gold',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (administrator_username)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
