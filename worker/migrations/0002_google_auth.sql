-- 0002_google_auth.sql — Google sign-in support.
--
-- Existing accounts keep password login enabled. Google-created accounts keep
-- the password columns populated with an unusable sentinel record because the
-- original schema made them NOT NULL; the explicit flag is the authority.

ALTER TABLE users ADD COLUMN password_login_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (password_login_enabled IN (0, 1));

ALTER TABLE users ADD COLUMN google_sub TEXT;

CREATE UNIQUE INDEX idx_users_google_sub
  ON users (google_sub)
  WHERE google_sub IS NOT NULL;
