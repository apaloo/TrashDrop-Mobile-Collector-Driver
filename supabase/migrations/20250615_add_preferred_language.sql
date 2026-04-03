-- Migration: Add preferred_language column to collector_profiles
-- This stores the collector's preferred voice navigation language (e.g. 'tw', 'ee', 'dag', 'gaa', 'fan', 'ha', 'en')
-- Default is 'tw' (Twi) as it is the most widely spoken local language in Ghana.

ALTER TABLE collector_profiles
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'tw';

-- Add a comment for documentation
COMMENT ON COLUMN collector_profiles.preferred_language IS 'BCP-style language code for voice navigation (tw=Twi, fan=Fante, ee=Ewe, dag=Dagbani, gaa=Ga, ha=Hausa, en=English)';
