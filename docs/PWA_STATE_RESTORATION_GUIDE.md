# PWA State Restoration - QA Testing Guide

## Overview

This document outlines the expected behavior and testing procedures for PWA state restoration in the TrashDrop Mobile Collector Driver app. The system is designed to restore user session state after the app is backgrounded and potentially killed by the operating system.

## Platform Expectations

### iOS (WKWebView-based PWAs)
- **Background Limit**: ~30-60 seconds before process eviction
- **Behavior**: iOS aggressively terminates PWA processes to conserve memory
- **Restoration**: Full state restoration possible if backgrounding event fired before eviction
- **Testing Window**: Use 90+ seconds to ensure eviction occurs

### Android (Chrome-based PWAs)
- **Background Limit**: More forgiving, typically 2-5+ minutes
- **Behavior**: Better memory management, less aggressive eviction
- **Restoration**: Higher success rate due to longer background tolerance
- **Testing Window**: Use 90+ seconds for consistency with iOS

### Critical Platform Constraint
**The 1-minute background window is a hard platform limitation, not a bug.** Our guarantee: *if the OS gave us time to write before eviction, the app will restore correctly.*

## State Restoration Architecture

### 3-Layer Persistence Strategy

1. **Layer 1 (Critical)**: Synchronous localStorage writes on `visibilitychange`
   - Route path (`trashdrop_last_route`)
   - Navigation modal state (`trashdrop_nav_modal_state`)
   - User location (`trashdrop_user_location`)
   - Timing: Immediate, guaranteed execution

2. **Layer 2 (Backup)**: Existing route change persistence
   - Page path changes (`pagePersistence.js`)
   - Modal state mutations (debounced, 500ms)
   - Timing: Best effort during normal operation

3. **Layer 3 (Comprehensive)**: IndexedDB state persistence
   - Full app state via `statePersistence.js`
   - Session metadata and analytics
   - Timing: Async, may not complete before eviction

### Data Model

```javascript
// localStorage keys (synchronous, critical)
trashdrop_last_route: "/request"
trashdrop_last_route_time: "1640995200000"
trashdrop_nav_modal_state: {
  isOpen: true,
  destination: [5.6037, -0.1870],
  requestId: "uuid",
  wasteType: "general",
  sourceType: "pickup_request",
  destinationName: "Accra Mall"
}
trashdrop_nav_modal_time: "1640995200000"
trashdrop_user_location: {
  lat: 5.6037,
  lng: -0.1870,
  accuracy: 10
}
trashdrop_user_location_time: "1640995200000"

// IndexedDB (async, comprehensive)
app_state: {
  lastRoute: "/request",
  activeModal: "navigation",
  activeModalData: { ... },
  sessionMetadata: {
    lastBackgroundedAt: 1640995200000,
    lastRestoredAt: 1640995300000,
    restorationCount: 3
  }
}
```

## Testing Procedures

### Manual Testing Steps

#### 1. Basic Navigation Restoration
1. Open the app and authenticate
2. Navigate to `/request` page
3. Open a navigation modal for any request
4. Background the app (switch to another app)
5. Wait **90 seconds** (exceeds typical eviction threshold)
6. Re-open the app
7. **Expected**: Should return to `/request` with navigation modal open

#### 2. Map Page Restoration
1. Navigate to `/map` page
2. Apply filters (radius, waste type)
3. Background the app for 90+ seconds
4. Re-open the app
5. **Expected**: Should return to `/map` with filters preserved

#### 3. Assignment Page Restoration
1. Navigate to `/assign` page
2. Accept an assignment
3. Background the app for 90+ seconds
4. Re-open the app
5. **Expected**: Should return to `/assign` with assignment status preserved

#### 4. Form Draft Restoration
1. Start filling any form (profile, etc.)
2. Background the app for 90+ seconds
3. Re-open the app
4. **Expected**: Form draft should be preserved

### Browser Console Testing

#### Validation Functions
Open browser console and run:

```javascript
// Validate current restoration data
window.validatePWARestoration()

// Simulate app backgrounding
window.simulateAppBackgrounding()

// Simulate app foregrounding  
window.simulateAppForegrounding()

// Check localStorage contents directly
Object.keys(localStorage).filter(key => key.includes('trashdrop'))
```

#### Expected Console Output
```
🔍 PWA State Restoration Validation
├── Timestamp: Mon Jan 01 2024 12:00:00 GMT
├── LocalStorage Contents: {
    trashdrop_last_route: "/request",
    trashdrop_nav_modal_state: {"isOpen":true,"destination":[5.6037,-0.1870]},
    trashdrop_user_location: {"lat":5.6037,"lng":-0.1870}
  }
├── Validation Results: {
    lastPage: "/request",
    navModalState: {isOpen: true, destination: [5.6037, -0.1870]},
    userLocation: {lat: 5.6037, lng: -0.1870},
    routeIntegrity: true,
    navModalIntegrity: true,
    userLocationIntegrity: true,
    overallIntegrity: true
  }
└── ✅ Overall Integrity: PASS
```

### Automated Testing Scenarios

#### Scenario 1: Navigation Modal State
```javascript
// Test navigation modal persistence
1. Open navigation modal
2. Run: window.validatePWARestoration()
3. Verify navModalIntegrity: true
4. Background app 90s
5. Reopen and verify modal is restored
```

#### Scenario 2: Route Persistence
```javascript
// Test route persistence across pages
1. Navigate to /request
2. Run: window.validatePWARestoration()
3. Verify routeIntegrity: true
4. Background app 90s
5. Reopen and verify route is restored
```

#### Scenario 3: User Location Persistence
```javascript
// Test GPS location persistence
1. Ensure GPS is available
2. Run: window.validatePWARestoration()
3. Verify userLocationIntegrity: true
4. Background app 90s
5. Reopen and verify location is restored
```

## Success Criteria

### Must Pass
- ✅ Route restoration after 90+ second background
- ✅ Navigation modal state preservation
- ✅ User location persistence (when available)
- ✅ No `/map` flash on cold restart
- ✅ Loading state shows during restoration

### Should Pass
- ✅ Form draft preservation
- ✅ Filter state preservation
- ✅ Assignment status preservation
- ✅ Session metadata tracking

### May Fail (Platform Limitations)
- ⚠️ Restoration if app killed before `visibilitychange` fires
- ⚠️ State preservation after force-quit (not backgrounding)
- ⚠️ Cross-device restoration (different scope)

## Debugging Information

### Console Logs to Monitor
```
📱 App backgrounded - executing comprehensive state flush
✅ Comprehensive state flush completed
📱 App foregrounded - checking state integrity
🔄 Restoring route from localStorage: /request
🔄 Restored userLocation: {lat: 5.6037, lng: -0.1870}
🔄 Found saved route for restoration: /request
🔄 Restoring app state from persistence...
```

### Common Failure Points
1. **Missing `visibilitychange` event**: App killed before event fires
2. **localStorage quota exceeded**: Storage full, writes fail
3. **Corrupted state data**: JSON parsing errors
4. **Timing race conditions**: Async operations incomplete

### Recovery Procedures
If restoration fails:
1. Clear localStorage: `localStorage.clear()`
2. Restart the app
3. Verify basic functionality works
4. Test restoration again

## Performance Considerations

### Write Performance
- Synchronous localStorage writes: <1ms
- Debounced modal state: 500ms delay
- IndexedDB operations: 10-50ms

### Storage Usage
- localStorage: ~5KB for complete state
- IndexedDB: ~50KB for full app state
- Well within typical PWA quotas

### Battery Impact
- Minimal background processing
- No periodic polling during background
- Single write on backgrounding

## Platform-Specific Notes

### iOS Safari
- Test on real devices, not simulators
- Use 90+ second background window
- Monitor memory usage patterns
- Test with multiple apps open

### Android Chrome
- Test across different Android versions
- Verify behavior with Chrome's memory saver
- Test with different device memory configurations
- Monitor Chrome DevTools for eviction events

## Regression Testing

### After Code Changes
1. Run `window.validatePWARestoration()` 
2. Test basic 90-second background scenario
3. Verify all success criteria still pass
4. Check for new console errors

### Platform Updates
1. Re-test after iOS updates
2. Re-test after Chrome updates  
3. Verify PWA manifest changes don't break restoration
4. Monitor for new platform restrictions

## Troubleshooting Guide

### Issue: Route not restored
**Symptoms**: Always returns to `/map` after backgrounding
**Causes**: 
- `visibilitychange` event not firing
- localStorage write failure
- Route validation failure

**Debugging**:
```javascript
// Check if event fired
console.log('visibilitychange supported:', 'onvisibilitychange' in document);

// Check localStorage
console.log('last route:', localStorage.getItem('trashdrop_last_route'));

// Check validation
window.validatePWARestoration()
```

### Issue: Modal not restored
**Symptoms**: Route restored but modal closed
**Causes**:
- Modal state not written
- Modal state expired
- Modal data corruption

**Debugging**:
```javascript
// Check modal state
console.log('nav modal:', localStorage.getItem('trashdrop_nav_modal_state'));

// Check expiry
const time = localStorage.getItem('trashdrop_nav_modal_time');
console.log('expired:', Date.now() - parseInt(time) > 2*60*60*1000);
```

### Issue: Flash on restart
**Symptoms**: Brief glimpse of `/map` before redirect
**Causes**:
- Loading state not gating properly
- Async restoration race condition

**Debugging**:
```javascript
// Check restoration timing
console.log('isRestoring:', document.querySelector('[data-is-restoring]'));

// Monitor redirect timing
console.time('restoration');
// ... observe console output
```

## Conclusion

The PWA state restoration system provides robust session recovery across platform limitations. The 3-layer persistence strategy ensures maximum reliability while respecting platform constraints. Testing should focus on the 90+ second background scenario to verify correct behavior under realistic conditions.
