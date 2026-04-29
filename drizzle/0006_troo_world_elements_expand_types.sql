-- Expand troo_world_elements.type from enum to varchar to support full object library
ALTER TABLE `troo_world_elements` MODIFY COLUMN `type` varchar(64) NOT NULL;
