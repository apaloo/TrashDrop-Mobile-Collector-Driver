-- Add missing collected_at column to digital_bins table
-- This fixes the error: Could not find the 'collected_at' column of 'digital_bins' in the schema cache

-- Check if the column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'digital_bins' 
        AND column_name = 'collected_at'
    ) THEN
        ALTER TABLE digital_bins ADD COLUMN collected_at TIMESTAMPTZ;
        RAISE NOTICE 'Added collected_at column to digital_bins table';
    ELSE
        RAISE NOTICE 'collected_at column already exists in digital_bins table';
    END IF;
END $$;

-- Also add collector_id column if missing (for tracking who collected the bin)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'digital_bins' 
        AND column_name = 'collector_id'
    ) THEN
        ALTER TABLE digital_bins ADD COLUMN collector_id UUID REFERENCES auth.users(id);
        RAISE NOTICE 'Added collector_id column to digital_bins table';
    ELSE
        RAISE NOTICE 'collector_id column already exists in digital_bins table';
    END IF;
END $$;

-- Also add status column if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'digital_bins' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE digital_bins ADD COLUMN status TEXT DEFAULT 'available';
        RAISE NOTICE 'Added status column to digital_bins table';
    ELSE
        RAISE NOTICE 'status column already exists in digital_bins table';
    END IF;
END $$;

-- Update any missing status values to 'available' (only if status column exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'digital_bins' 
        AND column_name = 'status'
    ) THEN
        UPDATE digital_bins 
        SET status = 'available' 
        WHERE status IS NULL;
        RAISE NOTICE 'Updated null status values to available';
    END IF;
END $$;

-- Show current table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'digital_bins' 
ORDER BY ordinal_position;
