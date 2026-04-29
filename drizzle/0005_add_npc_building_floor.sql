-- Add building and floor to oasis_npcs for Troo World building agents
ALTER TABLE `oasis_npcs` ADD COLUMN `buildingId` varchar(64) NULL COMMENT 'Troo World building: apex-tower, nexus-tower, meridian-tower';
ALTER TABLE `oasis_npcs` ADD COLUMN `floor` int NULL COMMENT '0-based floor number within building';
