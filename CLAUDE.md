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
