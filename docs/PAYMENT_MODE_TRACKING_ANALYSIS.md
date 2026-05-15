# TrashDrop Payment Mode Tracking & SOP Application Analysis

## Executive Summary

The TrashDrop Mobile Collector Driver app tracks **three payment modes** during collection:
1. **MoMo** (Mobile Money) - Digital payment via MTN, Vodafone, AirtelTigo
2. **e-Cash** - Electronic cash/digital wallet payments
3. **Cash** - Physical cash collected by collector from client

Each mode attracts **commission** according to **SOP v4.5.6**, with distinct tracking mechanisms for cash vs digital payments.

---

## 1. Payment Mode Selection Flow

### During Collection (DigitalBinPaymentModal.jsx)

```
Collector arrives → QR Scan → DigitalBinPaymentModal opens
                                    ↓
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
                   MoMo           e-Cash          Cash
                    ↓               ↓               ↓
            [Client Phone     [Client Phone   [No extra
             Required]          Required]       fields]
                    ↓               ↓               ↓
            [TrendiPay        [TrendiPay      [Immediate
             Gateway]          Gateway]        Success]
```

### Payment Mode Storage (bin_payments table)

```sql
CREATE TABLE bin_payments (
  id UUID PRIMARY KEY,
  digital_bin_id UUID REFERENCES digital_bins,
  collector_id UUID REFERENCES collector_profiles,
  
  -- PAYMENT MODE TRACKING
  payment_mode TEXT CHECK (payment_mode IN ('momo', 'e_cash', 'cash')),
  
  -- Amounts
  total_bill DECIMAL(10,2),           -- What user paid (Gross Revenue)
  collector_share DECIMAL(10,2),    -- Collector's portion per SOP
  platform_share DECIMAL(10,2),     -- Platform's commission
  
  -- For digital payments
  client_momo TEXT,                 -- Client phone for MoMo/e-Cash
  client_rswitch TEXT,              -- Network (mtn/vodafone/airteltigo)
  
  -- Status tracking
  status TEXT CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  
  -- SOP Application at payment time
  bags_collected INTEGER,
  scanned_bag_ids TEXT[],           -- QR audit trail
  created_at TIMESTAMP
);
```

---

## 2. SOP v4.5.6 Commission Structure

### Payment Split Algorithm (SOP v4.5.6)

```
┌─────────────────────────────────────────────────────────────┐
│                    USER PAYS (total_bill)                   │
│                        Example: ₵10.00                      │
└────────────────────┬────────────────────────────────────────┘
                     ↓
        ┌────────────────────────┐
        │ Platform Request Fee   │ ← ₵1.00 (100% to platform)
        │ (Not shared)           │
        └──────────┬─────────────┘
                   ↓
        ┌────────────────────────┐
        │   SHAREABLE AMOUNT     │ ← ₵9.00 (85-92% to collector)
        │   (total_bill - ₵1)    │
        └──────────┬─────────────┘
                   ↓
    ┌──────────────┼──────────────┐
    ↓              ↓              ↓
┌───────┐    ┌─────────┐    ┌──────────┐
│Core   │    │ Urgent  │    │ Distance │ ← Only if urgent & >5km
│85-92% │    │ 75/25   │    │ 100%     │
│       │    │ split   │    │ collector│
└───┬───┘    └────┬────┘    └────┬─────┘
    │             │              │
    └─────────────┴──────────────┘
                   ↓
        ┌────────────────────────┐
        │   COLLECTOR PAYOUT     │ ← 85-92% of core + bonuses
        │   (collector_share)    │
        └────────────────────────┘
                   +
        ┌────────────────────────┐
        │   PLATFORM SHARE       │ ← 8-15% commission + ₵1 fee
        │   (platform_share)       │
        └────────────────────────┘
```

### SOP v4.5.6 Percentage Breakdown

| Component | Collector | Platform | User | Notes |
|-----------|-----------|----------|------|-------|
| **Core Fee** | 85-92% | 8-15% | - | Based on deadhead distance |
| **Urgent Surcharge** | 75% | 25% | - | 30% premium on base |
| **Distance Bonus** | 100% | - | - | Only urgent & >5km |
| **Surge Multiplier** | 75% | 25% | - | When demand is high |
| **Tips** | 100% | - | - | Direct to collector |
| **Recyclables** | 60% | 15% | 25% | From recycler payout |
| **Request Fee** | - | 100% | - | ₵1 fixed, not shared |

### Deadhead Distance Tiers (Core Fee)

| Distance | Collector Share | Platform Share |
|----------|-----------------|----------------|
| 0-2 km | 85% | 15% |
| 2-5 km | 87% | 13% |
| 5-10 km | 89% | 11% |
| 10+ km | 92% | 8% |

---

## 3. Cash vs Digital Payment Tracking

### Cash Payments

**Flow:**
```
Collector receives cash from client → Records in app → Cash tracked as "collected"
                                                                            ↓
                                ┌───────────────────────────────────────────┐
                                │ Cash Collected: ₵10.00                    │
                                │ Platform Commission Due: ₵2.13 (approx)   │
                                │                                           │
                                │ Collector owes platform the commission    │
                                └───────────────────────────────────────────┘
```

**Key Characteristics:**
- Collector receives **full amount** from client immediately
- Collector **owes platform** the commission portion
- Commission is settled via:
  - Deduction from digital earnings (if collector has MoMo earnings)
  - Direct MoMo payment by collector to platform (if cash > digital earnings)

**Database Tracking:**
```javascript
// In earningsService.js - Payment Mode Tracking
cash: {
  grossRevenue: cashGrossRevenue,    // Raw fees from cash payments
  collected: cashCollected,          // Total cash collector received
  platformDue: cashPlatformDue       // Commission collector owes
}
```

### Digital Payments (MoMo/e-Cash)

**Flow:**
```
Client pays via MoMo → TrendiPay Gateway → Platform receives funds
                                                        ↓
                                ┌───────────────────────┴───────────────────────┐
                                │ Digital Collected: ₵10.00                   │
                                │ Collector Share Due: ₵7.87 (approx)         │
                                │                                               │
                                │ Platform owes collector their share           │
                                └───────────────────────────────────────────────┘
```

**Key Characteristics:**
- Platform receives **full amount** from client via gateway
- Platform **owes collector** their share
- Share is disbursed via:
  - TrendiPay disbursement to collector's MoMo
  - Net settlement (deducting cash commissions owed)

**Database Tracking:**
```javascript
// In earningsService.js - Payment Mode Tracking
digital: {
  grossRevenue: digitalGrossRevenue,  // Raw fees from digital payments
  collected: digitalCollected,        // Total digital platform received
  collectorDue: digitalCollectorDue  // Share platform owes collector
}
```

---

## 4. Commission Reconciliation Logic

### Net Settlement Calculation

```javascript
// From earningsService.js
const netSettlement = cashPlatformDue - digitalCollectorDue;

// reconciliation object
reconciliation: {
  // If collector has digital earnings, platform deducts cash commission
  commissionDeducted: Math.min(cashPlatformDue, digitalCollectorDue),
  
  // Net payout after deduction
  netPayoutToCollector: Math.max(0, digitalCollectorDue - cashPlatformDue),
  
  // If collector owes more than they earned digitally
  collectorMustPayBack: Math.max(0, cashPlatformDue - digitalCollectorDue),
  
  // Whether collector needs to make payment to platform
  requiresPayback: cashPlatformDue > digitalCollectorDue
}
```

### Settlement Scenarios

| Scenario | Cash Commission | Digital Earnings | Result |
|----------|-----------------|------------------|--------|
| **A** | ₵50 owed | ₵100 earned | Platform pays ₵50 net (₵100 - ₵50) |
| **B** | ₵50 owed | ₵30 earned | Collector pays ₵20 to platform (₵50 - ₵30) |
| **C** | ₵50 owed | ₵0 earned | Collector pays full ₵50 to platform |
| **D** | ₵0 owed | ₵100 earned | Platform pays full ₵100 to collector |

---

## 5. Implementation Files

### Core Payment Tracking Files

| File | Purpose |
|------|---------|
| `DigitalBinPaymentModal.jsx` | UI for payment mode selection & collection |
| `paymentService.js` | Initiates payments, creates bin_payments records |
| `paymentCalculations.js` | SOP v4.5.6 calculation formulas |
| `earningsService.js` | Tracks cash vs digital, reconciliation |
| `disposalService.js` | Applies SOP when marking bins as disposed |

### Database Tables

| Table | Purpose |
|-------|---------|
| `bin_payments` | Records each payment with mode, amounts, shares |
| `digital_bins` | Stores bin data with payout breakdown |
| `pickup_requests` | Legacy pickup request payments |
| `collector_tips` | Tracks tips (100% to collector) |

---

## 6. SOP Application at Different Stages

### Stage 1: Payment Collection (QR Scan)

```javascript
// paymentService.js - initiateCollection()
const { collectorShare, platformShare } = computeBinPaymentShares({
  totalBill: paymentData.totalBill,
  isUrgent: binMetadata.is_urgent,
  deadheadKm: binMetadata.deadhead_km,
  requestFee: 1.0
});

// Store in bin_payments record
const paymentRecord = {
  payment_mode: paymentData.paymentMode,  // 'momo' | 'e_cash' | 'cash'
  total_bill: paymentData.totalBill,
  collector_share: collectorShare,
  platform_share: platformShare
};
```

### Stage 2: Disposal (Marking as Complete)

```javascript
// disposalService.js - calculatePaymentSharing()
// Same SOP v4.5.6 formula applied when bin is marked 'disposed'
// This ensures payout is calculated at disposal time with actual data
```

### Stage 3: Earnings Aggregation

```javascript
// earningsService.js - Payment Mode Tracking
// Aggregates all payments by mode for display in Earnings page
```

---

## 7. Key Tracking Metrics

### For Each Collection, System Tracks:

1. **Payment Mode** (`payment_mode`): momo | e_cash | cash
2. **Gross Revenue** (`total_bill`): What user paid
3. **Collector Share** (`collector_share`): Per SOP v4.5.6
4. **Platform Share** (`platform_share`): Commission amount
5. **Status**: pending → processing → success | failed
6. **Reconciliation**: Cash vs digital netting

### Earnings Page Display

```
Revenue Split
Gross Revenue (User Paid)         ₵153.00
📱 MoMo: ₵100.00    💵 Cash: ₵53.00

[======== 92% ========][= 8% =]
Your Earnings              Platform Fee
₵140.87                    ₵12.13
92% of revenue             8% of revenue

Payment Settlement
💵 Cash Collected          ₵53.00
   Platform commission:    ₵4.24 (you owe)

📱 Digital Payments        ₵100.00
   Your share:             ₵93.50 (platform owes you)

📊 Reconciliation
Commission deducted:      -₵4.24
─────────────────────────────────
Net payout to you:        ₵89.26
```

---

## 8. Compliance & Audit Trail

### SOP v4.5.6 Compliance

✅ **All collections tracked** with payment mode
✅ **Commission applied consistently** per SOP percentages
✅ **Cash payments flagged** for reconciliation
✅ **Digital payments** via authorized TrendiPay gateway
✅ **QR scan audit trail** (`scanned_bag_ids` array)
✅ **Payout breakdown stored** for transparency

### Audit Fields

```sql
-- Every bin_payments record includes:
scanned_bag_ids TEXT[],     -- Which bags were scanned
payment_mode TEXT,          -- How client paid
status TEXT,                -- Payment status
commissionDeducted DECIMAL, -- For reconciliation
gateway_reference TEXT,     -- TrendiPay transaction ID
created_at TIMESTAMP        -- When collected
```

---

## Summary

The TrashDrop app implements **comprehensive payment mode tracking**:

1. **Three modes supported**: MoMo, e-Cash, Cash
2. **SOP v4.5.6 applied uniformly**: Same commission structure regardless of mode
3. **Cash tracking**: Collector receives full amount, owes commission
4. **Digital tracking**: Platform receives full amount, owes collector share
5. **Automatic reconciliation**: Net settlement between cash and digital
6. **Full audit trail**: QR scans, payment records, payout breakdowns

All commissions are calculated using the **SOP v4.5.6 percentage sharing algorithm** ensuring collectors receive **85-92% of core fees** plus bonuses, while platform earns **8-15% commission** plus the ₵1 request fee.
