-- Add email column to staff table if it doesn't exist
ALTER TABLE staff ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  time VARCHAR(10) NOT NULL,
  location VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create event_attendance table
CREATE TABLE IF NOT EXISTS event_attendance (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  family_id VARCHAR NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  family_member_id VARCHAR REFERENCES family_members(id) ON DELETE CASCADE,
  attendance_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  updated_by VARCHAR NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_attendance_status CHECK (attendance_status IN ('present', 'absent', 'pending'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_is_active ON events(is_active);
CREATE INDEX IF NOT EXISTS idx_event_attendance_event_id ON event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_family_id ON event_attendance(family_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_status ON event_attendance(attendance_status);