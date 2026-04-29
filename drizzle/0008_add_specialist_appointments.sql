-- Create specialist_appointments table for REALITY chatbot bookings
CREATE TABLE IF NOT EXISTS `specialist_appointments` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `appointmentId` VARCHAR(64) NOT NULL UNIQUE,
  `visitorName` VARCHAR(200) NOT NULL,
  `visitorEmail` VARCHAR(255) NOT NULL,
  `visitorPhone` VARCHAR(50),
  `appointmentDate` TIMESTAMP NOT NULL,
  `appointmentType` ENUM('trust_consultation', 'family_office', 'general_consultation', 'other') NOT NULL DEFAULT 'general_consultation',
  `topic` TEXT,
  `notes` TEXT,
  `status` ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') NOT NULL DEFAULT 'scheduled',
  `isNew` BOOLEAN NOT NULL DEFAULT TRUE,
  `bookedVia` VARCHAR(50) DEFAULT 'reality_chatbot',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX `specialist_appointments_date_idx` ON `specialist_appointments` (`appointmentDate`);
CREATE INDEX `specialist_appointments_status_idx` ON `specialist_appointments` (`status`);
CREATE INDEX `specialist_appointments_email_idx` ON `specialist_appointments` (`visitorEmail`);
CREATE INDEX `specialist_appointments_is_new_idx` ON `specialist_appointments` (`isNew`);
