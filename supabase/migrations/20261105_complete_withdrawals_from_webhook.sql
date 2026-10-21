-- Finish withdrawals from TrendiPay's payout result.
--
-- trendipay-proxy marks a withdrawal processing when it sends the payout
-- (td_begin_payout / td_finish_payout, 20261104). Nothing moved it on from
-- there, so successful withdrawals sat at processing for ever.
--
-- td_complete_payout() is called by the trendipay-webhook function after it
-- has confirmed the result with TrendiPay's transaction-status API (the
-- callback body itself is not trusted):
--   success -> completed (completed_at set)
--   failure -> failed    (its earnings items become withdrawable again)
-- Only a withdrawal that is still processing changes; repeated callbacks do
-- nothing. Service role only. Safe to re-run.

CREATE OR REPLACE FUNCTION public.td_complete_payout(
  p_withdrawal_id uuid,
  p_ok boolean,
  p_transaction_id text DEFAULT NULL,
  p_response jsonb DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  UPDATE public.withdrawals
  SET status = CASE WHEN p_ok THEN 'completed' ELSE 'failed' END,
      completed_at = CASE WHEN p_ok THEN now() ELSE completed_at END,
      gateway_transaction_id = coalesce(p_transaction_id, gateway_transaction_id),
      gateway_response = coalesce(p_response, gateway_response),
      gateway_error = CASE WHEN p_ok THEN NULL ELSE coalesce(p_error, 'Payout failed') END,
      updated_at = now()
  WHERE id = p_withdrawal_id AND status = 'processing'
  RETURNING status INTO v_status;

  IF v_status IS NULL THEN
    -- Not processing (already completed/failed, or unknown): report what it is
    SELECT status INTO v_status FROM public.withdrawals WHERE id = p_withdrawal_id;
    RETURN coalesce('unchanged:' || v_status, 'not_found');
  END IF;
  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.td_complete_payout(uuid, boolean, text, jsonb, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.td_complete_payout(uuid, boolean, text, jsonb, text) TO service_role;
