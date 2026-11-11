# Modal Persistence Testing Guide

## Test Cases for App Refresh and Modal Persistence Fixes

### 1. App Page Persistence Test
**Goal**: Verify the app returns to the last known page after switching apps

**Steps**:
1. Open the TrashDrop app
2. Navigate to the Request tab (or any tab other than Map)
3. Switch to another app (e.g., Phone, Messages)
4. Switch back to TrashDrop
5. **Expected**: App should still be on the Request tab, not redirected to Map

**Debugging**:
- Check browser console for: `🔄 Restoring to last saved page: /request`
- Verify localStorage has `trashdrop_last_page` key with correct value

### 2. Modal UI Persistence Test
**Goal**: Verify the Google Maps navigation button appears in persistent modal

**Steps**:
1. Open the TrashDrop app
2. Go to Request tab
3. Click "Navigate" on any request to open the NavigationQRModal
4. Verify the green "Google Maps Navigation" button is visible
5. Switch to another app (or refresh the page)
6. Return to TrashDrop and go back to Request tab
7. **Expected**: Modal should re-open with Google Maps navigation button visible

**Debugging**:
- Check console for: `🔄 Restored userLocation: [lat, lng]`
- Verify modal shows both "Voice Navigation" (blue) and "Google Maps Navigation" (green) buttons

### 3. Combined Test
**Goal**: Verify both fixes work together

**Steps**:
1. Open app, navigate to Request tab
2. Open navigation modal on a request
3. Verify Google Maps button is present
4. Switch apps for 30+ seconds
5. Return to app
6. **Expected**: 
   - App stays on Request tab
   - Modal reopens with Google Maps button visible
   - User location is restored (no need to wait for GPS)

## Technical Implementation Details

### Fix 1: Page Persistence
- Created `pagePersistence.js` utility to save/restore last visited page
- Updated PWA `start_url` from `/?v=2.0.1` to `/` 
- Modified `DefaultRedirect` in App.jsx to check saved page first
- Added `PagePersistence` component to save page on navigation changes

### Fix 2: Modal UI Persistence
- Added `initialUserLocation` prop to NavigationQRModal
- Modified Request.jsx to save and restore `userLocation` in navigation state
- Updated NavigationQRModal to restore location from props or saved state
- Ensures Google Maps button appears immediately when modal is restored

## Console Logs to Monitor

### Page Persistence:
- `🔄 Restoring to last saved page: /request`
- `📍 Page saved: /request`

### Modal Persistence:
- `🔄 Restored userLocation: [lat, lng]`
- `🔄 Restored navigation modal state: {isOpen: true, destination: [...], userLocation: [...]}`
- `🔄 Restoring to previous route: /request`

## Troubleshooting

### If app still redirects to Map:
1. Check if `trashdrop_last_page` exists in localStorage
2. Verify the saved page is not expired (30-minute limit)
3. Ensure user is authenticated (redirect only works for logged-in users)

### If Google Maps button is missing:
1. Check if `userLocation` is restored in NavigationQRModal
2. Verify `!isNavigating` condition (button hides during voice navigation)
3. Ensure destination coordinates are valid

### If modal doesn't persist:
1. Check `NAV_MODAL_STATE_KEY` in localStorage
2. Verify state is not expired (2-hour limit)
3. Ensure modal is not closed properly before app switch
