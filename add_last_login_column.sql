-- Migration script to add last_login column to staff table
-- This adds the missing last_login column that exists in the schema but not in the database

-- Add the last_login column to the staff table
ALTER TABLE "staff" ADD COLUMN "last_login" timestamp;

-- Add a comment to document the column
COMMENT ON COLUMN "staff"."last_login" IS 'Timestamp of when the staff member last logged in';

-- Optional: Update existing records with a placeholder value if needed
-- UPDATE "staff" SET "last_login" = "created_at" WHERE "last_login" IS NULL;