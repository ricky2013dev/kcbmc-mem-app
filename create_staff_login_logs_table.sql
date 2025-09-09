-- Migration script to create staff_login_logs table
-- This table tracks all login attempts (successful and failed) for staff members

-- Create the staff_login_logs table
CREATE TABLE IF NOT EXISTS "staff_login_logs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "staff_id" varchar NOT NULL,
  "login_time" timestamp NOT NULL DEFAULT NOW(),
  "ip_address" varchar(45),
  "user_agent" varchar(500),
  "success" boolean NOT NULL DEFAULT true,
  "failure_reason" varchar(255),
  "created_at" timestamp DEFAULT NOW(),
  CONSTRAINT "staff_login_logs_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE
);

-- Add index for faster queries by staff_id
CREATE INDEX IF NOT EXISTS "idx_staff_login_logs_staff_id" ON "staff_login_logs" ("staff_id");

-- Add index for faster queries by login_time (for chronological sorting)
CREATE INDEX IF NOT EXISTS "idx_staff_login_logs_login_time" ON "staff_login_logs" ("login_time");

-- Add index for faster queries by success status
CREATE INDEX IF NOT EXISTS "idx_staff_login_logs_success" ON "staff_login_logs" ("success");

-- Add comment to document the table
COMMENT ON TABLE "staff_login_logs" IS 'Tracks all login attempts for staff members including successful logins and failed attempts';
COMMENT ON COLUMN "staff_login_logs"."staff_id" IS 'Foreign key reference to the staff member';
COMMENT ON COLUMN "staff_login_logs"."login_time" IS 'Timestamp of when the login attempt was made';
COMMENT ON COLUMN "staff_login_logs"."ip_address" IS 'IP address from which the login attempt was made';
COMMENT ON COLUMN "staff_login_logs"."user_agent" IS 'Browser/client user agent string';
COMMENT ON COLUMN "staff_login_logs"."success" IS 'Whether the login attempt was successful';
COMMENT ON COLUMN "staff_login_logs"."failure_reason" IS 'Reason for failed login (e.g., invalid credentials, account locked)';