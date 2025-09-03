-- Create announcements table for news announcement feature
-- Run this script in your PostgreSQL database

CREATE TABLE IF NOT EXISTS announcements (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (type IN ('Major', 'Medium', 'Minor')),
    is_login_required BOOLEAN NOT NULL DEFAULT true,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    created_by VARCHAR NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key constraint to staff table
    CONSTRAINT fk_announcements_created_by 
        FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_announcements_active_dates 
    ON announcements (is_active, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_announcements_login_required 
    ON announcements (is_login_required);

CREATE INDEX IF NOT EXISTS idx_announcements_type 
    ON announcements (type);

CREATE INDEX IF NOT EXISTS idx_announcements_created_by 
    ON announcements (created_by);

-- Add some sample data (optional)
-- You can run these after creating the table if you want test data

/*
-- Sample announcements (uncomment to use)
INSERT INTO announcements (title, content, type, is_login_required, start_date, end_date, created_by, is_active) 
VALUES 
    (
        'Welcome to the New System',
        '<p>We have upgraded our family care system with new features!</p><ul><li>Improved search functionality</li><li>Better mobile support</li><li>New announcement system</li></ul>',
        'Major',
        false,
        NOW(),
        NOW() + INTERVAL '30 days',
        (SELECT id FROM staff WHERE group = 'ADM' LIMIT 1),
        true
    ),
    (
        'Maintenance Notice',
        '<p>System maintenance will be performed this <strong>Sunday at 2 AM</strong>.</p><p>Expected downtime: 30 minutes</p>',
        'Medium',
        true,
        NOW(),
        NOW() + INTERVAL '7 days',
        (SELECT id FROM staff WHERE group = 'ADM' LIMIT 1),
        true
    ),
    (
        'New Team Member',
        'Please welcome our new team member joining the TEAM-A group!',
        'Minor',
        false,
        NOW(),
        NOW() + INTERVAL '14 days',
        (SELECT id FROM staff WHERE group = 'ADM' LIMIT 1),
        true
    );
*/

-- Verify the table was created
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'announcements' 
ORDER BY ordinal_position;