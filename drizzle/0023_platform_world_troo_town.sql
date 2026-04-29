-- Platform world for Troo Town (portal target)
-- Uses first marketplace user as owner; run after marketplace has at least one user.
INSERT IGNORE INTO `worlds` (
  `id`,
  `ownerId`,
  `name`,
  `description`,
  `visibility`,
  `terrainSeed`,
  `biomeType`,
  `status`,
  `createdAt`,
  `updatedAt`
) SELECT
  'troo-town',
  (SELECT id FROM marketplace_users ORDER BY id ASC LIMIT 1),
  'Troo Town',
  'Platform world: Troo Town experience',
  'public',
  42,
  'green-terrain',
  'published',
  NOW(),
  NOW()
WHERE EXISTS (SELECT 1 FROM marketplace_users LIMIT 1);

-- Ensure troo-town has a published version (required for viewing)
INSERT IGNORE INTO `world_versions` (`id`, `worldId`, `versionType`, `versionNumber`, `createdAt`, `updatedAt`)
SELECT 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee', 'troo-town', 'published', 1, NOW(), NOW()
WHERE EXISTS (SELECT 1 FROM worlds WHERE id = 'troo-town')
  AND NOT EXISTS (SELECT 1 FROM world_versions WHERE worldId = 'troo-town' AND versionType = 'published');
