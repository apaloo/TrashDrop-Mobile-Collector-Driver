-- Auth users created by the collector login bug: a phone sign-in with no
-- collector profile AND no customer profile. Read-only; deletes nothing.
--
-- auth.users is shared with the customer app, so phone users who have a
-- row in public.profiles (customers) are excluded.
SELECT
  u.id,
  u.phone,
  u.created_at,
  u.last_sign_in_at,
  (SELECT count(*) FROM public.pickup_requests pr WHERE pr.collector_id = u.id) AS pickups_as_collector,
  (SELECT count(*) FROM public.withdrawals w WHERE w.collector_id = u.id)      AS withdrawals
FROM auth.users u
LEFT JOIN public.collector_profiles cp ON cp.user_id = u.id
LEFT JOIN public.profiles p            ON p.id = u.id
WHERE coalesce(u.phone, '') <> ''
  AND cp.id IS NULL
  AND p.id IS NULL
ORDER BY u.created_at DESC;
