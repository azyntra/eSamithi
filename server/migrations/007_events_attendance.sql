-- 007 — Attendance register (documentation only; applied idempotently by
-- ensureSchema() in db.js at server startup).
--
-- Staff scan the QR on a member's digital membership card (payload =
-- society_id) at meetings/funerals to build an attendance register and an
-- absentee list.

CREATE TABLE IF NOT EXISTS society_events (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  type       VARCHAR(20)  NOT NULL,               -- 'meeting' | 'funeral' | 'other'
  title      VARCHAR(255) NOT NULL,
  event_date DATE         NOT NULL,
  created_by INT          DEFAULT NULL,           -- staff user id
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_attendance (
  id        INT       PRIMARY KEY AUTO_INCREMENT,
  event_id  INT       NOT NULL,
  member_id INT       NOT NULL,
  marked_by INT       DEFAULT NULL,               -- staff user id
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_event_member (event_id, member_id),
  FOREIGN KEY (event_id) REFERENCES society_events(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
