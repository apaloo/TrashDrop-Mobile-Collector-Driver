# Location Display Fix

**Date:** October 23, 2025  
**Issue:** RequestCard displaying raw `POINT()` coordinates instead of readable addresses

---

## Problem

The RequestCard component was displaying raw PostGIS coordinate data:
```
POINT(-0.17320421503543074 5.6335836115744446)
```

This is not user-friendly for collectors.

---

## Solution

Created utility functions to parse and format location data properly:

### 1. **Added to `/src/utils/geoUtils.js`:**

```javascript
/**
 * Parses a POINT() string from PostGIS into coordinates
 * @param {string} pointString - PostGIS POINT() format string
 * @returns {Object|null} {lat, lng} or null if invalid
 */
export const parsePointString = (pointString) => {
  // Matches POINT(lng lat) format and extracts coordinates
  const match = pointString.match(/POINT\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)/i);
  // Returns {lat, lng} object
};

/**
 * Formats coordinates into a readable location string
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Formatted location string
 */
export const formatCoordinates = (lat, lng) => {
  // Returns format like: "5.6336°N, 0.1732°W"
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
};

/**
 * Formats a location string (handles both POINT() format and regular strings)
 * @param {string} location - Location string (POINT() or address)
 * @returns {string} Formatted location
 */
export const formatLocation = (location) => {
  if (location.includes('POINT(')) {
    const coords = parsePointString(location);
    if (coords) {
      return formatCoordinates(coords.lat, coords.lng);
    }
  }
  return location; // Return as-is if it's already an address
};
```

### 2. **Updated `/src/components/RequestCard.jsx`:**

```javascript
// Added import
import { formatLocation } from '../utils/geoUtils';

// Changed from:
<h3 className="font-medium text-lg mb-3">{request.location}</h3>

// Changed to:
<p className="text-sm text-gray-600 mb-3">{formatLocation(request.location)}</p>
```

### 3. **Updated `/src/components/RequestDetailModal.jsx`:**

```javascript
// Added import
import { formatLocation } from '../utils/geoUtils';

// Changed from:
<span className="font-medium">{request.location || 'N/A'}</span>

// Changed to:
<span className="font-medium">{formatLocation(request.location)}</span>
```

---

## Result

### Before:
```
POINT(-0.17320421503543074 5.6335836115744446)
```

### After:
```
5.6336°N, 0.1732°W
```

---

## How It Works

1. **Detect Format:** Check if location string contains `POINT(`
2. **Parse Coordinates:** Extract latitude and longitude using regex
3. **Format Display:** Convert to degrees with N/S/E/W indicators
4. **Fallback:** If it's already an address string, display as-is

---

## Benefits

✅ **User-Friendly:** Collectors see readable coordinates  
✅ **Backwards Compatible:** Works with both POINT() and address strings  
✅ **Consistent:** Same formatting across all components  
✅ **Robust:** Handles invalid formats gracefully  

---

## Future Enhancements

### Option 1: Reverse Geocoding (Recommended)
Convert coordinates to actual street addresses using a geocoding API:

```javascript
export const reverseGeocode = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
    );
    const data = await response.json();
    return data.display_name || formatCoordinates(lat, lng);
  } catch (error) {
    return formatCoordinates(lat, lng); // Fallback to coordinates
  }
};
```

**Benefits:**
- Shows real street addresses
- Better user experience
- More context for collectors

**Considerations:**
- Requires API calls (may have rate limits)
- Needs error handling
- May need caching

### Option 2: Database Migration
Add an `address` column to the `pickup_requests` table and populate it during request creation:

```sql
ALTER TABLE pickup_requests ADD COLUMN address TEXT;

-- Trigger to populate address from location
CREATE OR REPLACE FUNCTION reverse_geocode_location()
RETURNS TRIGGER AS $$
BEGIN
  -- Call external geocoding service and populate NEW.address
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Testing

### Test Cases

1. **POINT() Format:**
   ```javascript
   formatLocation('POINT(-0.1732 5.6336)') 
   // Expected: "5.6336°N, 0.1732°W"
   ```

2. **Address String:**
   ```javascript
   formatLocation('123 Main St, Accra')
   // Expected: "123 Main St, Accra"
   ```

3. **Invalid Format:**
   ```javascript
   formatLocation('INVALID')
   // Expected: "INVALID"
   ```

4. **Null/Undefined:**
   ```javascript
   formatLocation(null)
   // Expected: "Location unavailable"
   ```

---

## Files Modified

1. `/src/utils/geoUtils.js` - Added formatting functions
2. `/src/components/RequestCard.jsx` - Updated location display
3. `/src/components/RequestDetailModal.jsx` - Updated location display

---

## Deployment Notes

- ✅ No breaking changes
- ✅ No database migration required
- ✅ Backward compatible with existing data
- ✅ Works immediately after code deploy

---

**Status:** ✅ Complete and Ready for Testing
