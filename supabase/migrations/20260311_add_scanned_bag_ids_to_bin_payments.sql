-- Migration: Add scanned_bag_ids column to bin_payments table
-- Purpose: Store individual QR-scanned bag IDs for transparency and audit trail
-- The manual bag count input has been replaced with QR-code-based scanning
-- to ensure each bag is verified and prevent fraud.

ALTER TABLE bin_payments
ADD COLUMN IF NOT EXISTS scanned_bag_ids TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN bin_payments.scanned_bag_ids IS 'Array of unique QR code IDs scanned from individual bags. Used for deduplication and audit trail.';
