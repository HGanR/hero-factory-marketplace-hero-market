-- Stadium Elyseum: ensure in world_library_assets (catalog) and troo_world_placements (green-terrain)
-- Run after 0014 (worlds) and 0003 (troo_world). Safe to run multiple times (INSERT IGNORE).

INSERT IGNORE INTO `world_library_assets` (
  `id`, `slug`, `name`, `category`, `description`, `status`, `version`,
  `modelUrl`, `tokenPrice`, `isPlatformOnly`, `isActive`, `metadataJson`
) VALUES (
  'stadium-elyseum',
  'stadium-elyseum',
  'Stadium Elyseum',
  'venue',
  'Large stadium venue for concerts, seminars, lectures, and presentations. 500 audience capacity, 3 host slots. Supports avatar mode, VR, live stream.',
  'published',
  1,
  '/models/world-assets/stadium-elyseum.glb',
  1000000,
  FALSE,
  TRUE,
  '{"asset_type":"stadium","max_users":500,"host_capacity":3,"audience_capacity":500,"compatible_worlds":["*"],"features":["avatar_mode","vr_headset","live_stream","seminar","lecture","concert","presentation"],"spawn_nodes":{"host":3,"audience":424,"entrance":4,"backstage":1},"screens":["SCREEN_MAIN","SCREEN_LEFT","SCREEN_RIGHT","SCREEN_SCOREBOARD"],"vr_cameras":["VR_CAM_STAGE","VR_CAM_AUDIENCE","VR_CAM_AERIAL","VR_CAM_BACKSTAGE","VR_CAM_BROADCAST"]}'
);

-- Stadium in green-terrain (default world)
INSERT INTO `troo_world_placements` (`worldId`, `elementKey`, `glbUrl`, `posX`, `posY`, `posZ`, `scale`, `rotY`)
SELECT 'default', 'stadium-elyseum', '/models/world-assets/stadium-elyseum.glb', '0', '0', '60', '1', '0'
FROM `troo_worlds` w
WHERE w.id = 'default'
  AND NOT EXISTS (SELECT 1 FROM `troo_world_placements` p WHERE p.worldId = 'default' AND p.elementKey = 'stadium-elyseum')
LIMIT 1;
