-- Apply to a non-production copy first. Deploy this additive column before
-- starting an application build containing User.is_guest.
ALTER TABLE users
  ADD COLUMN is_guest TINYINT NOT NULL DEFAULT 0;

-- Historical guest_ names remain 0. The old device ID was not proof of
-- ownership, so they must never be bulk-marked as verified guests.
