-- Additive migration. Review/apply to an isolated non-production MySQL copy first.
-- Never applied automatically by application startup. No notification delivery tables.
CREATE TABLE notification_drafts (
  id INT NOT NULL AUTO_INCREMENT,
  organizer_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  title VARCHAR(120) NOT NULL,
  body TEXT NOT NULL,
  variables JSON NOT NULL,
  status ENUM('draft', 'archived') NOT NULL DEFAULT 'draft',
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  created_by INT NOT NULL,
  updated_by INT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_drafts_owner_name (organizer_id, name),
  CONSTRAINT fk_notification_drafts_owner FOREIGN KEY (organizer_id) REFERENCES users(id),
  CONSTRAINT fk_notification_drafts_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_notification_drafts_updater FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
