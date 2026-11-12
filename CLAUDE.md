# TrashDrop collector app — rules for AI assistants and contributors

## Protected: TrashDrop Digital Bin Pricing
Digital bin prices and promotions follow the accepted **TrashDrop Digital Bin
Pricing**, specified in `docs/DIGITAL_BIN_PRICING.md` of the household app
repository (apaloo/TrashDrop-Mobile-User-Domestic). The database prices every
bin when it is booked; this app pays collectors from what was stored then.

Do not change how this app pays for digital bins, promotional ones included,
without the owner's written approval in the pull request. That covers
`src/utils/paymentCalculations.js` (`promotionalPayout`,
`computePromotionalShares`, `PROMOTIONAL_FEE_SCHEDULE`),
`src/services/disposalService.js` (`calculatePaymentSharing`) and
`src/services/paymentService.js`. When a change is approved, update the
household app's specification and `src/utils/__tests__/promotionalPayout.test.js`
in step. Never weaken or skip that test to make a change pass.

The payout rules themselves are specified in `docs/COLLECTOR_PAYOUTS.md` of the
household app repository (accepted by the owner 2026-11-12): collectors earn
85–92% of the base by travel distance plus 75% of the urgent surcharge, never
more than the payout the database stored at booking. The database keeps a
bin's booked price and payout whatever this app sends
(`supabase/migrations/20261112113921_keep_booked_payout.sql`), and works out
the travel distance and the collector's share itself
(`20261112120016_server_side_collector_share.sql`); the figures this app sends
are ignored. The household repository's daily security watch fails if those
database objects change without a recorded approval.

## Database changes go in the household repository
Decided by the owner on 2026-11-12 (ADR-001): new database migrations go in
`trashdrop/supabase/migrations/` of apaloo/TrashDrop-Mobile-User-Domestic, not
here (`supabase/migrations/README.md`). A pull request here that needs a
schema change links the household pull request that makes it.
