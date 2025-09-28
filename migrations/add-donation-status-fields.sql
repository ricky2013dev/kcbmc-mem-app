-- Add status fields to donations table
-- Migration: Add received, email_for_thank, and email_for_tax columns to donations table

ALTER TABLE donations
ADD COLUMN IF NOT EXISTS received BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS email_for_thank BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS email_for_tax BOOLEAN NOT NULL DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN donations.received IS 'Whether the donation has been received';
COMMENT ON COLUMN donations.email_for_thank IS 'Whether a thank you email has been sent';
COMMENT ON COLUMN donations.email_for_tax IS 'Whether a tax receipt email has been sent';