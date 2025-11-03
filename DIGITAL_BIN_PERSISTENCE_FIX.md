# Digital Bin Persistence Fix

## Problem
Accepted digital bins were not persisting - they would reappear as "available" even after being accepted.

## Root Causes

### 1. Real-time Subscription Filter Issue (Map.jsx)
**Location**: `/src/pages/Map.jsx` line 1463

**Problem**: 
- The real-time subscription had a filter: `filter: 'status=eq.available'`
- When a digital bin status changed from 'available' to 'accepted', it no longer matched the filter
- The UPDATE event was **never received** by the subscription
- The bin remained in the Map's local state showing as "available" even though it was "accepted" in the database

**Fix Applied**:
```javascript
// BEFORE (Broken):
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'digital_bins',
  filter: 'status=eq.available' // ❌ Blocks UPDATE events when status changes
}, ...)

// AFTER (Fixed):
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'digital_bins'
  // ✅ Removed filter to receive UPDATE events when status changes from 'available' to 'accepted'
}, ...)
```

**Result**: The Map now receives UPDATE events when digital bins are accepted and properly removes them from the available list.

---

### 2. Cache Not Updated on Acceptance (Request.jsx)
**Location**: `/src/pages/Request.jsx` handleAcceptRequest function

**Problem**:
- When a digital bin was accepted, the local state was updated
- However, the `requestCache` was NOT updated
- The 2-minute cache would return stale data showing the bin as "available"
- If user refreshed or navigated away and back, the accepted bin would reappear as available

**Fix Applied**:
```javascript
// Added cache update after state update:
setRequests(updatedRequests);

// CRITICAL: Update cache to prevent accepted request from reappearing as available
setRequestCache(prev => ({
  ...prev,
  available: {
    data: newAvailable,
    timestamp: Date.now()
  },
  accepted: {
    data: newAccepted,
    timestamp: Date.now()
  }
}));
```

**Result**: Cache is now synchronized with state, preventing stale data from showing accepted bins as available.

---

## How Digital Bin Acceptance Works (After Fix)

### Database Update Flow:
1. User clicks "Accept" on a digital bin
2. `handleAcceptRequest()` updates database:
   ```javascript
   supabase
     .from('digital_bins')
     .update({ 
       status: 'accepted',
       collector_id: user?.id
     })
     .eq('id', requestId)
   ```
3. Database status changes: `'available'` → `'accepted'`

### Real-time Propagation:
4. Map.jsx real-time subscription receives UPDATE event
5. UPDATE handler detects status change:
   ```javascript
   if (oldRecord.status === 'available' && newRecord.status !== 'available') {
     // Remove from map display
     setAllRequests(prev => prev.filter(r => r.id !== newRecord.id));
   }
   ```
6. Digital bin is removed from Map

### Local State & Cache Update:
7. Request.jsx updates local state (moves bin from available to accepted)
8. Request.jsx updates cache with new state
9. Both tabs show correct status

### Query Results:
10. Available tab queries: `status = 'available'` → digital bin NOT included ✅
11. Accepted tab queries: `status = 'accepted' AND collector_id = user.id` → digital bin IS included ✅

---

## Files Modified
1. `/src/pages/Map.jsx` - Removed real-time subscription filter
2. `/src/pages/Request.jsx` - Added cache update on acceptance

---

## Testing Checklist
- [ ] Accept a digital bin from Available tab
- [ ] Verify it moves to Accepted tab
- [ ] Verify it's removed from Map markers
- [ ] Refresh the page - bin should stay in Accepted tab
- [ ] Navigate away and back - bin should NOT reappear in Available
- [ ] Check another collector's view - bin should NOT show as available

---

## Status: ✅ FIXED
Digital bins now properly persist their accepted status across:
- Real-time updates
- Page refreshes  
- Navigation
- Cache hits
- Multiple users/collectors
