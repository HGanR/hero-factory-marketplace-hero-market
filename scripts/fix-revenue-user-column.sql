-- Fix revenue_profiles: rename userld or userId → user_id
-- Run in TiDB/MySQL console if Revenue Analysis fails with "Failed query" / "userld" error.
-- Run only the statement that matches your current column name (check with DESCRIBE revenue_profiles;).

-- If column is userld (typo):
ALTER TABLE revenue_profiles CHANGE COLUMN userld user_id VARCHAR(64) NOT NULL;

-- If column is userId (camelCase), use this instead:
-- ALTER TABLE revenue_profiles CHANGE COLUMN userId user_id VARCHAR(64) NOT NULL;
