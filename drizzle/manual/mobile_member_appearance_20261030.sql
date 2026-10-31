-- Additive; apply only to the approved schema before deploying this branch.
CREATE TABLE IF NOT EXISTS mobile_member_appearance (
 member_id INT NOT NULL PRIMARY KEY,
 skin VARCHAR(16) NOT NULL DEFAULT 'gold',
 updated_at DATETIME(3) NOT NULL
) CHARACTER SET utf8mb4;
