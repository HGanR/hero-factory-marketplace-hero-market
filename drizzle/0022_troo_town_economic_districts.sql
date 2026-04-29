-- Troo Town Economic City Blueprint
-- Hub-and-spoke district layout for platform_global_zones
-- Run each INSERT separately in TiDB Cloud if batch fails.

INSERT INTO platform_global_zones (id, name, slug, boundsJson, placementsJson, npcsJson, isActive, priority, createdAt, updatedAt)
VALUES ('zone-central-plaza', 'Central Plaza', 'central_plaza', '{"centerX":0,"centerZ":0,"width":48,"length":48,"heightLimit":100}', '[]', NULL, 1, 100, NOW(), NOW())
ON DUPLICATE KEY UPDATE updatedAt = NOW();

INSERT INTO platform_global_zones (id, name, slug, boundsJson, placementsJson, npcsJson, isActive, priority, createdAt, updatedAt)
VALUES ('zone-consulting', 'Consulting District', 'consulting_district', '{"centerX":60,"centerZ":-40,"width":40,"length":40,"heightLimit":100}', '[]', NULL, 1, 90, NOW(), NOW())
ON DUPLICATE KEY UPDATE updatedAt = NOW();

INSERT INTO platform_global_zones (id, name, slug, boundsJson, placementsJson, npcsJson, isActive, priority, createdAt, updatedAt)
VALUES ('zone-creator', 'Creator District', 'creator_district', '{"centerX":-60,"centerZ":-40,"width":40,"length":40,"heightLimit":100}', '[]', NULL, 1, 90, NOW(), NOW())
ON DUPLICATE KEY UPDATE updatedAt = NOW();

INSERT INTO platform_global_zones (id, name, slug, boundsJson, placementsJson, npcsJson, isActive, priority, createdAt, updatedAt)
VALUES ('zone-marketplace', 'Marketplace District', 'marketplace_district', '{"centerX":0,"centerZ":40,"width":48,"length":40,"heightLimit":100}', '[]', NULL, 1, 95, NOW(), NOW())
ON DUPLICATE KEY UPDATE updatedAt = NOW();

INSERT INTO platform_global_zones (id, name, slug, boundsJson, placementsJson, npcsJson, isActive, priority, createdAt, updatedAt)
VALUES ('zone-innovation', 'Innovation District', 'innovation_district', '{"centerX":0,"centerZ":-80,"width":40,"length":40,"heightLimit":100}', '[]', NULL, 1, 85, NOW(), NOW())
ON DUPLICATE KEY UPDATE updatedAt = NOW();

INSERT INTO platform_global_zones (id, name, slug, boundsJson, placementsJson, npcsJson, isActive, priority, createdAt, updatedAt)
VALUES ('zone-education', 'Education District', 'education_district', '{"centerX":0,"centerZ":80,"width":40,"length":48,"heightLimit":100}', '[]', NULL, 1, 85, NOW(), NOW())
ON DUPLICATE KEY UPDATE updatedAt = NOW();
