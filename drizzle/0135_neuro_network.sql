CREATE TABLE IF NOT EXISTS `neuro_documents` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `adminUserId` int NOT NULL,
  `title` varchar(500) NOT NULL,
  `fileName` varchar(500) NOT NULL,
  `mimeType` varchar(191) NOT NULL,
  `sizeBytes` int NOT NULL,
  `storageUri` text NOT NULL,
  `assignedAgent` enum('JARVA','ELEANOR','MAANIA','BENTLEY','SKIPPER','GENERAL') NOT NULL DEFAULT 'GENERAL',
  `subjectArea` enum('TRUST','ACCOUNTING','TAX','CONSUMER_LAW','FINANCIAL_READINESS','REAL_ESTATE','AI_REVENUE_OS','GENERAL') NOT NULL DEFAULT 'GENERAL',
  `sourceType` enum('pdf','doc','docx','txt','markdown','image','other') NOT NULL DEFAULT 'other',
  `status` enum('uploaded','processing','indexed','failed','unsupported_for_text') NOT NULL DEFAULT 'uploaded',
  `statusMessage` text,
  `extractedTextPreview` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `neuro_documents_admin` (`adminUserId`),
  KEY `neuro_documents_subject` (`subjectArea`),
  KEY `neuro_documents_agent` (`assignedAgent`),
  KEY `neuro_documents_status` (`status`)
);

CREATE TABLE IF NOT EXISTS `neuro_document_chunks` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `documentId` varchar(36) NOT NULL,
  `chunkIndex` int NOT NULL,
  `pageNumber` int,
  `sectionTitle` varchar(500),
  `text` longtext NOT NULL,
  `tokenEstimate` int NOT NULL DEFAULT 0,
  `citationLabel` varchar(500) NOT NULL,
  `sourceLocator` varchar(500) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `neuro_chunks_document` (`documentId`),
  KEY `neuro_chunks_doc_index` (`documentId`, `chunkIndex`)
);

CREATE TABLE IF NOT EXISTS `neuro_document_tags` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `documentId` varchar(36) NOT NULL,
  `tagKey` varchar(120) NOT NULL,
  `tagValue` varchar(500) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `neuro_tags_document` (`documentId`),
  KEY `neuro_tags_key` (`tagKey`)
);

CREATE TABLE IF NOT EXISTS `neuro_source_citations` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `adminUserId` int NOT NULL,
  `documentId` varchar(36) NOT NULL,
  `chunkId` varchar(36),
  `queryText` text NOT NULL,
  `citationLabel` varchar(500) NOT NULL,
  `snippet` text NOT NULL,
  `confidence` decimal(5,4) NOT NULL DEFAULT 0.0000,
  `subjectArea` varchar(64),
  `assignedAgent` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `neuro_citations_admin` (`adminUserId`),
  KEY `neuro_citations_document` (`documentId`)
);

CREATE TABLE IF NOT EXISTS `neuro_access_logs` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `adminUserId` int NOT NULL,
  `action` varchar(64) NOT NULL,
  `queryText` text,
  `subjectArea` varchar(64),
  `assignedAgent` varchar(64),
  `documentId` varchar(36),
  `metadataJson` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `neuro_access_admin` (`adminUserId`),
  KEY `neuro_access_action` (`action`)
);
