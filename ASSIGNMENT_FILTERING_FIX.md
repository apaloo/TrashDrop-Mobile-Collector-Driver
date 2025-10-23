# Assignment Filtering Fix - Admin-Assigned Collector Assignments

## Problem Identified

The Assignments page was loading **ALL assignments** from the database regardless of which collector was logged in. This violated the requirement that:
- Collectors should ONLY see assignments specifically assigned to them by admin/account manager
- Assignments pre-assigned by admin should appear in the "Available" tab until collector accepts them
- After acceptance, assignments move to "Accepted" tab
- Collectors should NOT see a shared pool - only assignments assigned to their account
- Should not load assignments from other collectors' accounts

## Root Causes

1. **Line 289-292**: Database query fetched ALL assignments without filtering by `collector_id`
   ```javascript
   // BEFORE (WRONG)
   const { data, error } = await supabase
     .from('authority_assignments')
     .select('*')
     .order('created_at', { ascending: false });
   ```

2. **Line 412-434**: When accepting an assignment, `collector_id` was NOT being set
   ```javascript
   // BEFORE (WRONG)
   .update({ 
     status: 'accepted',
     accepted_at: new Date().toISOString(),
     updated_at: new Date().toISOString()
   })
   ```

3. **Line 340-345**: Grouping logic didn't filter by `collector_id`

## Solutions Applied

### 1. **Collector-Specific Database Query** ✅
```javascript
// Fetch ONLY assignments assigned to THIS collector by admin
// - Available: Assignments assigned to me by admin with status 'available' (not yet accepted)
// - Accepted: Assignments assigned to me that I've accepted with status 'accepted'
// - Completed: Assignments assigned to me that I've completed with status 'completed'
// Note: If collector_id IS NULL, it means no admin has assigned it yet - should not show to collectors
const { data, error } = await supabase
  .from('authority_assignments')
  .select('*')
  .eq('collector_id', user.id)
  .order('created_at', { ascending: false });
```

**What this does:**
- Fetches ONLY assignments where `collector_id` matches the logged-in collector
- Excludes unassigned assignments (collector_id IS NULL) - these are not visible to collectors
- Excludes all assignments assigned to other collectors
- Admins must pre-assign assignments to specific collectors from the web interface

### 2. **Proper Tab Filtering** ✅
```javascript
// Group assignments by status:
// ALL assignments here are already filtered to THIS collector (collector_id = user.id)
// - Available: Assignments assigned to me by admin but not yet accepted by me
// - Accepted: Assignments I have accepted to work on
// - Completed: Assignments I have completed
const groupedAssignments = {
  available: uniqueAssignments.filter(a => a.status === AssignmentStatus.AVAILABLE),
  accepted: uniqueAssignments.filter(a => a.status === AssignmentStatus.ACCEPTED),
  completed: uniqueAssignments.filter(a => a.status === AssignmentStatus.COMPLETED)
};
```

**Available Tab:**
- Shows assignments PRE-ASSIGNED to this collector by admin
- Status = 'available', collector_id = current user
- Collector has not yet accepted these assignments
- These are NOT shared - only this collector can see them

**Accepted Tab:**
- Shows assignments this collector has accepted
- Status = 'accepted', collector_id = current user
- Collector is actively working on these

**Completed Tab:**
- Shows assignments this collector has completed
- Status = 'completed', collector_id = current user
- Historical record of completed work

### 3. **Accept Pre-Assigned Assignment** ✅
```javascript
// Update in Supabase - Change status from 'available' to 'accepted'
// Note: collector_id is already set by admin, we're just accepting the assignment
const { error } = await supabase
  .from('authority_assignments')
  .update({ 
    status: 'accepted',
    accepted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .eq('id', assignmentId)
  .eq('collector_id', user.id)  // ✅ VERIFY IT'S ASSIGNED TO ME
  .eq('status', 'available');   // ✅ ONLY IF STILL AVAILABLE
```

**Safety Checks:**
- `.eq('collector_id', user.id)` ensures you can only accept assignments assigned to you
- `.eq('status', 'available')` prevents accepting already-accepted assignments
- collector_id remains unchanged (already set by admin during assignment creation)

### 4. **Enhanced Error Handling** ✅
```javascript
if (error) {
  console.error('Error accepting assignment:', error);
  showToast('Failed to accept assignment. It may have been claimed by another collector.', 'error');
  // Refresh assignments to get latest state
  fetchAssignments();
  return;
}
```

### 5. **User Authentication Check** ✅
```javascript
if (!user?.id) {
  console.warn('⚠️ No user ID available, cannot fetch assignments');
  setLoading(false);
  return;
}
```

### 6. **Auto-Refresh on User Change** ✅
```javascript
// Load assignments when component mounts or when user changes
useEffect(() => {
  if (user?.id) {
    fetchAssignments();
  }
}, [user?.id]);
```

## Expected Behavior

### **Admin Assigns from Web Interface:**
Admin/Account Manager assigns:
- Assignment #1, #2, #3 → Collector A
- Assignment #4, #5 → Collector B

### **Collector A's View:**
**Available Tab:**
- Assignment #1 (assigned to A, status: available)
- Assignment #2 (assigned to A, status: available)
- Assignment #3 (assigned to A, status: available)

**Accepted Tab:**
- *(Empty until Collector A accepts an assignment)*

**Completed Tab:**
- *(Empty until Collector A completes an assignment)*

### **Collector B's View:**
**Available Tab:**
- Assignment #4 (assigned to B, status: available)
- Assignment #5 (assigned to B, status: available)

**Accepted Tab:**
- *(Empty until Collector B accepts an assignment)*

**Completed Tab:**
- *(Empty until Collector B completes an assignment)*

**Note:** Collector A and B see COMPLETELY DIFFERENT assignments. There is NO shared pool - each collector only sees assignments specifically assigned to them by admin.

## Workflow Example

### **Step 1: Admin Pre-Assigns**
Admin logs into web interface and assigns:
- Assignment #5, #10, #15 → Collector A (sets collector_id = Collector A's ID, status = 'available')
- Assignment #3, #8 → Collector B (sets collector_id = Collector B's ID, status = 'available')

### **Step 2: Collector A Logs In**
- **Available Tab**: Shows Assignment #5, #10, #15 (all pre-assigned to Collector A)
- **Accepted Tab**: Empty
- **Completed Tab**: Empty

### **Step 3: Collector A Accepts Assignment #5**
- Assignment #5 moves from "Available" to "Accepted" tab
- Status changes from 'available' to 'accepted'
- `collector_id` remains as Collector A's ID (already set by admin)
- Collector B never sees Assignment #5 (not assigned to them)

### **Step 4: Collector B Logs In**
- **Available Tab**: Shows Assignment #3, #8 (only assignments assigned to Collector B)
- Does NOT see Assignment #5, #10, #15 (those belong to Collector A)
- **Accepted Tab**: Empty
- **Completed Tab**: Empty

### **Step 5: Collector B Accepts Assignment #3**
- Assignment #3 moves to Collector B's "Accepted" tab
- Collector A never sees Assignment #3 (not assigned to them)

### **Step 6: Collector A Completes Assignment #5**
- Moves from "Accepted" to "Completed" tab in Collector A's account
- Still associated with Collector A (collector_id unchanged)
- Collector B never sees this assignment at any stage

## Database Requirements

The `authority_assignments` table must have:
```sql
ALTER TABLE authority_assignments 
ADD COLUMN IF NOT EXISTS collector_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_assignments_collector_status 
ON authority_assignments(collector_id, status);
```

## Console Logging for Verification

```javascript
📥 Fetching assignments for collector: [user-id]
📊 Assignments loaded for collector [user-id]:
  - available: 10
  - accepted: 2
  - completed: 5
  - total: 17
  - filtered_out: 0

✅ Accepting assignment [assignment-id] for collector: [user-id]
✅ Assignment accepted and assigned to you!
```

## Testing Checklist

### **Admin Side (Web Interface):**
- [ ] Admin can create assignment and assign it to a specific collector
- [ ] Assignment is created with collector_id set to chosen collector
- [ ] Assignment status is set to 'available' when created

### **Collector Side (Mobile App):**
- [ ] Login as Collector A
- [ ] Available tab shows ONLY assignments where collector_id = Collector A
- [ ] Available tab does NOT show assignments assigned to other collectors
- [ ] Available tab does NOT show unassigned assignments (collector_id IS NULL)
- [ ] Accept an assignment - verify it moves to Accepted tab
- [ ] Login as Collector B (different account)
- [ ] Verify Collector B does NOT see Collector A's assignments in any tab
- [ ] Verify Collector B only sees assignments assigned to them
- [ ] Verify proper isolation - no data leakage between accounts

## Result

**Before Fix:** 
- All collectors saw ALL assignments in the database
- No filtering by collector_id
- Assignments from other collectors were visible

**After Fix:** 
- Each collector ONLY sees assignments specifically assigned to them by admin
- **Available Tab**: Assignments pre-assigned to THIS collector (status = 'available', collector_id = current user)
- **Accepted Tab**: Assignments THIS collector has accepted (status = 'accepted', collector_id = current user)
- **Completed Tab**: Assignments THIS collector has completed (status = 'completed', collector_id = current user)
- NO shared pool - complete isolation between collectors
- Admins control which collector gets which assignment via web interface

This ensures:
- ✅ Complete assignment isolation between collectors
- ✅ No data leakage - collectors cannot see each other's assignments
- ✅ Controlled assignment distribution by admin/account manager
- ✅ Proper workflow: Admin assigns → Collector sees in Available → Collector accepts → Moves to Accepted
