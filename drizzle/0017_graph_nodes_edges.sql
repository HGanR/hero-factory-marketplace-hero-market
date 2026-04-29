-- Canonical Business Graph: graph_nodes, graph_edges
CREATE TABLE IF NOT EXISTS `graph_nodes` (
  `id` varchar(36) NOT NULL,
  `nodeType` varchar(40) NOT NULL,
  `refId` varchar(120) NOT NULL,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `graph_nodes_type_ref_idx` (`nodeType`,`refId`),
  KEY `graph_nodes_type_idx` (`nodeType`)
);

CREATE TABLE IF NOT EXISTS `graph_edges` (
  `id` varchar(36) NOT NULL,
  `fromNodeId` varchar(36) NOT NULL,
  `toNodeId` varchar(36) NOT NULL,
  `relationType` varchar(40) NOT NULL,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(`id`),
  KEY `graph_edges_from_idx` (`fromNodeId`),
  KEY `graph_edges_to_idx` (`toNodeId`),
  KEY `graph_edges_relation_idx` (`relationType`),
  KEY `graph_edges_from_to_idx` (`fromNodeId`,`toNodeId`)
);
