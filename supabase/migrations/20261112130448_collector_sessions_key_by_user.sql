-- Collector sessions (TD45; owner's approval 2026-11-12). The collector app
-- and every row rule on collector_sessions use the collector's user id, but
-- the foreign key pointed at collector_profiles.id, so every save failed.
-- Point it at collector_profiles.user_id (unique: one profile per user) and
-- keep one session row per collector, so the app's upsert updates in place.
-- The table was empty.
CREATE UNIQUE INDEX IF NOT EXISTS collector_profiles_user_id_key ON public.collector_profiles (user_id);
ALTER TABLE public.collector_sessions DROP CONSTRAINT IF EXISTS collector_sessions_collector_id_fkey;
ALTER TABLE public.collector_sessions ADD CONSTRAINT collector_sessions_collector_id_fkey
  FOREIGN KEY (collector_id) REFERENCES public.collector_profiles (user_id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS collector_sessions_collector_id_key ON public.collector_sessions (collector_id);
