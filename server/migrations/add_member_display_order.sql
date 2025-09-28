-- ===============================================
-- Add display_order column to family_members table
-- This migration adds member ordering functionality
-- ===============================================

-- Add display_order column to family_members table
ALTER TABLE family_members
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Update existing records to have sequential display orders within each family
-- This ensures existing data has proper ordering
WITH ordered_members AS (
  SELECT
    id,
    family_id,
    ROW_NUMBER() OVER (
      PARTITION BY family_id
      ORDER BY
        CASE relationship
          WHEN 'husband' THEN 1
          WHEN 'wife' THEN 2
          WHEN 'child' THEN 3
          ELSE 4
        END,
        created_at
    ) as new_order
  FROM family_members
  WHERE display_order = 0 OR display_order IS NULL
)
UPDATE family_members
SET display_order = ordered_members.new_order
FROM ordered_members
WHERE family_members.id = ordered_members.id;

-- Add comment to document the purpose of the field
COMMENT ON COLUMN family_members.display_order IS 'Display order of family members within a family for UI presentation';

-- Optional: Create an index for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_family_members_family_display_order
ON family_members(family_id, display_order);

-- Verify the changes
SELECT
  family_id,
  korean_name,
  english_name,
  relationship,
  display_order
FROM family_members
ORDER BY family_id, display_order
LIMIT 10;

SELECT 'Member display order migration completed successfully!' AS status;