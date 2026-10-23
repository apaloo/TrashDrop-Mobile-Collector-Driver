-- Bag prices for pickup requests, for the collector's request card.
--
-- A QR-bag pickup request's fee is the sum of the unit prices of the bags it
-- covers: every bag carries its own unit_price (set from its batch's type,
-- size and number of bags). Bags aren't tied to a request until the collector
-- scans them, so this follows create_pickup_request's FIFO rule: the user's
-- active bags from their oldest batch first. When a user has several open
-- requests, each takes the next bags in that order, so no bag is counted twice.
--
-- Collectors can't read other users' bags, so this is SECURITY DEFINER and
-- returns only prices, only to registered active collectors, and only for
-- pending requests or requests assigned to the caller.
--
-- Read-only: it does not change pickup_requests.fee or any payout.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.get_pickup_request_bag_prices(p_request_ids text[])
RETURNS TABLE (request_id text, bag_count integer, unit_prices numeric[], total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH reqs AS (
    SELECT pr.id::text AS id, pr.user_id, pr.created_at,
           GREATEST(COALESCE(pr.estimated_volume, pr.bag_count, 1), 1)::integer AS n
    FROM pickup_requests pr
    WHERE pr.id::text = ANY (p_request_ids)
      AND (pr.status = 'pending' OR pr.collector_id = auth.uid())
      AND public.is_active_collector(auth.uid())
  ),
  -- every open request of those users, in the order they were made, so bags
  -- already counted for an earlier request go to that request
  user_reqs AS (
    SELECT pr.id::text AS id, pr.user_id,
           GREATEST(COALESCE(pr.estimated_volume, pr.bag_count, 1), 1)::integer AS n,
           SUM(GREATEST(COALESCE(pr.estimated_volume, pr.bag_count, 1), 1)::integer)
             OVER (PARTITION BY pr.user_id ORDER BY pr.created_at, pr.id
                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS upto
    FROM pickup_requests pr
    WHERE pr.user_id IN (SELECT user_id FROM reqs)
      AND pr.status IN ('pending', 'accepted', 'en_route', 'arrived')
  ),
  user_bags AS (
    SELECT bg.user_id, COALESCE(bg.unit_price, b.unit_price) AS price,
           ROW_NUMBER() OVER (PARTITION BY bg.user_id ORDER BY b.created_at, bg.id) AS rn
    FROM bags bg
    JOIN batches b ON b.id = bg.batch_id
    WHERE bg.user_id IN (SELECT user_id FROM reqs)
      AND bg.status = 'active'
  )
  SELECT r.id,
         r.n,
         COALESCE(array_agg(ub.price ORDER BY ub.rn) FILTER (WHERE ub.price IS NOT NULL), ARRAY[]::numeric[]),
         COALESCE(SUM(ub.price), 0)
  FROM reqs r
  JOIN user_reqs ur ON ur.id = r.id
  LEFT JOIN user_bags ub
    ON ub.user_id = r.user_id
   AND ub.rn > ur.upto - ur.n
   AND ub.rn <= ur.upto
  GROUP BY r.id, r.n;
$$;

REVOKE ALL ON FUNCTION public.get_pickup_request_bag_prices(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pickup_request_bag_prices(text[]) TO authenticated, service_role;
