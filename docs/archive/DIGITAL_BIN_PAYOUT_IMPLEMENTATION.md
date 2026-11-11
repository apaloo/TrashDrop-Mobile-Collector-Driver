# Digital Bin Payment Breakdown - Implementation Guide

## 🎯 Objective
Display the **actual calculated payment breakdown** to collectors for digital bin collections, showing the same detailed breakdown as regular pickup requests (Base Payout, Bonuses, Total).

---

## ✅ Changes Implemented

### **1. Frontend Fix - RequestCard.jsx**
**Removed:** Special handling that showed generic message for zero-fee digital bins  
**Result:** Digital bins now ALWAYS show the estimated payout breakdown when `fee` exists

```javascript
// BEFORE: Showed generic message for fee = 0
if (request.source_type === 'digital_bin' && totalPayout === 0) {
  // Generic message about deferred calculation
}

// AFTER: Always shows breakdown for any fee value
if (request.fee !== undefined && request.fee !== null) {
  const totalPayout = parseFloat(request.fee);
  const estimatedCore = totalPayout * 0.87;
  const estimatedBonus = totalPayout * 0.13;
  // Show breakdown...
}
```

### **2. Database Migration - New Columns**
**File:** `/scripts/add-digital-bin-payout-breakdown.sql`

**Added columns to `digital_bins` table:**
```sql
- collector_core_payout        -- Base payout
- collector_urgent_payout      -- Urgent bonus
- collector_distance_payout    -- Distance bonus
- collector_surge_payout       -- Surge pricing
- collector_tips               -- Tips (if applicable)
- collector_recyclables_payout -- Recyclables bonus
- collector_loyalty_cashback   -- Loyalty program
- collector_total_payout       -- Total (sum of all)
- surge_multiplier             -- Surge multiplier (1.0 = no surge)
- deadhead_km                  -- Distance to bin
```

---

## 📋 Implementation Steps

### **Step 1: Run Database Migration** ⚠️ **REQUIRED**

1. **Open Supabase Dashboard** → SQL Editor
2. **Run the migration:**
   ```bash
   /scripts/add-digital-bin-payout-breakdown.sql
   ```
3. **Verify columns were added:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns
   WHERE table_name = 'digital_bins'
   ORDER BY ordinal_position;
   ```

### **Step 2: Update Digital Bin Creation Logic** ⚠️ **REQUIRED**

When creating digital bins (server-side or admin panel), you must **calculate and populate** the breakdown fields:

#### **Example Calculation Logic:**
```javascript
// Calculate payout breakdown when creating digital bin
function calculateDigitalBinPayout(binData, collectorLocation) {
  const { waste_type, bin_capacity, collection_frequency } = binData;
  
  // Base rate depends on bin capacity and waste type
  const baseRates = {
    small: { general: 10, recyclable: 12, organic: 11 },
    medium: { general: 15, recyclable: 18, organic: 16 },
    large: { general: 20, recyclable: 24, organic: 22 }
  };
  
  const baseRate = baseRates[bin_capacity]?.[waste_type] || 15;
  
  // Calculate distance to bin (deadhead)
  const deadheadKm = calculateDistance(collectorLocation, binData.coordinates);
  
  // Core payout: base rate + distance component
  const collectorCorePayout = baseRate + (deadheadKm * 0.5);
  
  // Distance bonus for far locations (>3km)
  const collectorDistancePayout = deadheadKm > 3 ? (deadheadKm - 3) * 1.0 : 0;
  
  // Urgent bonus for same-day collections
  const isUrgent = collection_frequency === 'urgent';
  const collectorUrgentPayout = isUrgent ? baseRate * 0.2 : 0;
  
  // Recyclables bonus
  const collectorRecyclablesPayout = waste_type === 'recyclable' ? baseRate * 0.15 : 0;
  
  // Surge multiplier (check current demand)
  const surgeMultiplier = getCurrentSurgeMultiplier(); // 1.0 - 2.0
  const collectorSurgePayout = surgeMultiplier > 1.0 
    ? (collectorCorePayout * (surgeMultiplier - 1.0)) 
    : 0;
  
  // Calculate total
  const collectorTotalPayout = 
    collectorCorePayout +
    collectorDistancePayout +
    collectorUrgentPayout +
    collectorRecyclablesPayout +
    collectorSurgePayout;
  
  return {
    fee: collectorTotalPayout, // Legacy field
    collector_core_payout: collectorCorePayout,
    collector_distance_payout: collectorDistancePayout,
    collector_urgent_payout: collectorUrgentPayout,
    collector_recyclables_payout: collectorRecyclablesPayout,
    collector_surge_payout: collectorSurgePayout,
    collector_tips: 0, // Set when user tips
    collector_loyalty_cashback: 0, // Set based on collector loyalty tier
    collector_total_payout: collectorTotalPayout,
    surge_multiplier: surgeMultiplier,
    deadhead_km: deadheadKm
  };
}
```

#### **Insert Digital Bin with Breakdown:**
```javascript
const payoutBreakdown = calculateDigitalBinPayout(binData, collectorLocation);

await supabase
  .from('digital_bins')
  .insert({
    waste_type: binData.waste_type,
    coordinates: binData.coordinates,
    location: binData.location,
    bin_capacity: binData.bin_capacity,
    priority: binData.priority,
    status: 'available',
    
    // Payment breakdown
    fee: payoutBreakdown.fee,
    collector_core_payout: payoutBreakdown.collector_core_payout,
    collector_distance_payout: payoutBreakdown.collector_distance_payout,
    collector_urgent_payout: payoutBreakdown.collector_urgent_payout,
    collector_recyclables_payout: payoutBreakdown.collector_recyclables_payout,
    collector_surge_payout: payoutBreakdown.collector_surge_payout,
    collector_total_payout: payoutBreakdown.collector_total_payout,
    surge_multiplier: payoutBreakdown.surge_multiplier,
    deadhead_km: payoutBreakdown.deadhead_km
  });
```

### **Step 3: Update Existing Digital Bins** (Optional)

If you have existing digital bins without breakdown data:

```sql
-- Recalculate and populate breakdown for existing bins
UPDATE digital_bins 
SET 
  collector_core_payout = fee * 0.87,
  collector_distance_payout = fee * 0.13,
  collector_total_payout = fee
WHERE collector_total_payout = 0 AND fee > 0;
```

---

## 📱 Frontend Display Logic

The `RequestCard.jsx` component now displays payment breakdown in **two scenarios:**

### **Scenario A: Full Breakdown Available** (Preferred)
When digital bin has `collector_core_payout` populated:

```
┌─────────────────────────────────────────┐
│ Your Payout Breakdown                    │
├─────────────────────────────────────────┤
│ Core (2.3km approach)       GH₵ 13.05   │
│ ⚡ Urgent Bonus              GH₵ 3.00    │
│ 📍 Distance Bonus           GH₵ 2.00    │
│ ♻️ Recyclables              GH₵ 2.25    │
├─────────────────────────────────────────┤
│ Total Payout                GH₵ 20.30   │
└─────────────────────────────────────────┘
```

### **Scenario B: Estimated Breakdown** (Fallback)
When only `fee` is available (legacy bins):

```
┌─────────────────────────────────────────┐
│ Estimated Payout Breakdown  [Estimated]  │
├─────────────────────────────────────────┤
│ 💼 Base Payout              GH₵ 17.66   │
│ ⚡ Potential Bonuses        GH₵ 2.64    │
├─────────────────────────────────────────┤
│ Total Payout                GH₵ 20.30   │
│                                          │
│ 💡 Actual breakdown will be calculated  │
│    when you accept this request.        │
└─────────────────────────────────────────┘
```

---

## 🧪 Testing Checklist

### **Test Case 1: New Digital Bin with Full Breakdown**

**Prerequisites:**
- Database migration completed
- Digital bin creation logic updated

**Steps:**
1. Create a new digital bin with calculated breakdown:
   ```javascript
   {
     waste_type: 'recyclable',
     bin_capacity: 'large',
     fee: 20.30,
     collector_core_payout: 13.05,
     collector_urgent_payout: 3.00,
     collector_distance_payout: 2.00,
     collector_recyclables_payout: 2.25,
     collector_total_payout: 20.30,
     deadhead_km: 2.3
   }
   ```

2. **Open TrashDrop Collector App** → Request page → Available tab
3. **Find the digital bin** (black corner accent)
4. ✅ **Verify fee badge** shows "GH₵ 20.30"
5. **Click "View More"**
6. ✅ **Verify full breakdown appears:**
   - Shows "Your Payout Breakdown" (NOT "Estimated")
   - Shows Core with distance: "Core (2.3km approach) GH₵ 13.05"
   - Shows all bonuses with amounts
   - Shows Total Payout: GH₵ 20.30

### **Test Case 2: Legacy Digital Bin (Fee Only)**

**Steps:**
1. Find/create digital bin with only `fee` populated (no breakdown columns)
2. **Open Request page** → Available tab
3. ✅ **Verify estimated breakdown** appears:
   - Shows "Estimated Payout Breakdown" with "Estimated" badge
   - Shows Base Payout (87% of fee)
   - Shows Potential Bonuses (13% of fee)
   - Shows disclaimer message

### **Test Case 3: Zero Fee Digital Bin**

**Steps:**
1. Create digital bin with `fee = 0`
2. **Open Request page** → Available tab
3. ✅ **Verify estimated breakdown** still appears:
   - Shows breakdown with all values as ₵0.00
   - Does NOT show generic "payment will be determined" message

### **Test Case 4: Accept and Complete Digital Bin**

**Steps:**
1. Accept digital bin with breakdown
2. ✅ Navigate to Accepted tab
3. ✅ Complete the collection
4. ✅ Navigate to Picked Up tab
5. ✅ Verify payout is recorded correctly

---

## 🔧 Files Modified

### **Frontend:**
- `/src/components/RequestCard.jsx` (Lines 354-360)
  - Removed zero-fee special handling
  - All digital bins now show breakdown when fee exists

### **Backend/Database:**
- `/scripts/add-digital-bin-payout-breakdown.sql` (NEW)
  - Migration to add payout breakdown columns
  - Includes sample update for existing records

### **Documentation:**
- `/DIGITAL_BIN_PAYOUT_IMPLEMENTATION.md` (NEW)
  - Complete implementation guide
  - Calculation examples
  - Testing instructions

---

## 🎯 Expected Results

### **Before Implementation:**
- ❌ Digital bins showed generic "payment will be determined upon completion" message
- ❌ Collectors couldn't see how much they'd earn
- ❌ No transparency on payout calculation

### **After Implementation:**
- ✅ Digital bins show detailed payment breakdown
- ✅ Collectors see Base Payout, Bonuses, Total upfront
- ✅ Matches the transparency of regular pickup requests
- ✅ Same UI/UX for both digital bins and pickup requests

---

## 📊 Summary

| Component | Status | Action Required |
|-----------|--------|----------------|
| **Frontend** | ✅ Complete | No action needed |
| **Database Schema** | ⚠️ Migration needed | Run SQL migration |
| **Bin Creation Logic** | ⚠️ Needs update | Implement payout calculation |
| **Existing Bins** | ⚠️ Optional | Recalculate breakdowns |
| **Testing** | ⏳ Pending | Follow test cases |

---

## 🚀 Quick Start

1. **Run database migration:**
   ```sql
   -- Copy contents of /scripts/add-digital-bin-payout-breakdown.sql
   -- Paste into Supabase SQL Editor → Run
   ```

2. **Update digital bin creation to include breakdown:**
   ```javascript
   const payoutData = calculateDigitalBinPayout(binInfo, collectorLocation);
   await insertDigitalBin({ ...binInfo, ...payoutData });
   ```

3. **Test in app:**
   - Create new digital bin with breakdown
   - Open TrashDrop Collector app
   - Click "View More" on digital bin
   - Verify full breakdown displays

**Status:** ✅ Frontend ready, ⚠️ Backend implementation required
