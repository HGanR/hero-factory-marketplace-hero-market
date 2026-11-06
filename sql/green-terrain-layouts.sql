-- Additive prerequisite only. Explicit production approval required before application.
-- Existing placements and elements are not modified or copied.
CREATE TABLE IF NOT EXISTS `green_terrain_layouts` (
 `worldId` varchar(64) NOT NULL,
 `revision` int NOT NULL,
 `layout` json NOT NULL,
 `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`worldId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
