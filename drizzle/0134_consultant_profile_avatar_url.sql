-- Consultant headshot for public /consultations list (admin upload, data URL in LONGTEXT).
ALTER TABLE `consultant_profiles`
  ADD COLUMN `avatarUrl` LONGTEXT NULL
  AFTER `note`;
