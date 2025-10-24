# Reverse Geocoding Issue & Solutions

## Current Issue
The OpenStreetMap Nominatim API is experiencing "Failed to fetch" errors, which typically indicates:
- **CORS restrictions** blocking requests from the browser
- **Network firewall** blocking access to nominatim.openstreetmap.org
- **API rate limiting** or regional blocking

## Circuit Breaker Implementation ✅
We've implemented a circuit breaker pattern that:
- **Stops requests** after 5 consecutive failures
- **Waits 1 minute** before attempting again
- **Reduces console spam** significantly
- **Caches failures** to avoid repeated attempts

## Current Behavior
When geocoding fails:
1. First 5 attempts show error messages
2. Circuit breaker opens after 5 failures
3. All subsequent requests show coordinates instead of addresses
4. After 1 minute, circuit breaker resets and tries again

## Production Solutions

### Option 1: Backend Proxy (Recommended)
Create a backend endpoint that proxies geocoding requests:

```javascript
// Backend API endpoint
app.get('/api/geocode', async (req, res) => {
  const { lat, lng } = req.query;
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    {
      headers: {
        'User-Agent': 'TrashDropCollectorApp/1.0'
      }
    }
  );
  const data = await response.json();
  res.json(data);
});

// Frontend usage
const response = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
```

**Benefits:**
- No CORS issues
- Better control over rate limiting
- Can add caching layer
- Works reliably in production

### Option 2: Use Alternative Geocoding Service
Switch to a service with better CORS support:

**Google Maps Geocoding API:**
```javascript
const response = await fetch(
  `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`
);
```

**Mapbox Geocoding API:**
```javascript
const response = await fetch(
  `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${TOKEN}`
);
```

### Option 3: Use Netlify/Vercel Functions ✅ **IMPLEMENTED**
**Status**: ✅ Fully implemented and ready for deployment

The serverless function has been created at `netlify/functions/geocode.js` with:
- Input validation for coordinates
- Proper error handling
- 24-hour caching headers
- CORS headers configured
- Automatic environment detection (production vs development)

**Files Created**:
- `/netlify/functions/geocode.js` - Serverless function
- `/netlify/functions/README.md` - Documentation and testing guide

**Configuration Updated**:
- `netlify.toml` - Functions directory configured
- `src/utils/geoUtils.js` - Updated to use Netlify function in production

**How it Works**:
- **Production**: Calls `/.netlify/functions/geocode?lat=${lat}&lng=${lng}`
- **Development**: Falls back to direct Nominatim API calls (localhost detection)

**Testing Locally**:
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Run with functions support
netlify dev

# Test the function
curl "http://localhost:8888/.netlify/functions/geocode?lat=5.6336&lng=-0.1732"
```

**Deployment**:
Just push to your Netlify site - functions are automatically deployed!

## Immediate Workaround
The app will continue to work with coordinate display instead of addresses. Users will see:
- `5.6336°N, 0.1732°W` instead of street addresses
- All other functionality remains intact
- No impact on pickup/disposal workflows

## Testing Locally
To test if geocoding works in your environment:
1. Open browser console
2. Run: `fetch('https://nominatim.openstreetmap.org/reverse?lat=5.6&lon=-0.2&format=json').then(r=>r.json()).then(console.log)`
3. If you see CORS errors, geocoding won't work without a proxy

## Implementation Priority
**For Production Deployment:**
1. ✅ **COMPLETED**: Netlify Functions implementation (Option 3)
2. Alternative: Backend proxy (Option 1) 
3. Alternative: Paid geocoding service (Option 2)

**For Development:**
- Current fallback to coordinates works fine
- Circuit breaker prevents console spam
- All core features remain functional

## Deployment Instructions

### Deploying to Netlify

1. **Commit and push your changes**:
   ```bash
   git add netlify/functions/geocode.js
   git add netlify.toml
   git add src/utils/geoUtils.js
   git commit -m "Add Netlify function for reverse geocoding"
   git push
   ```

2. **Netlify will automatically**:
   - Detect the function in `netlify/functions/`
   - Build and deploy it alongside your site
   - Make it available at `/.netlify/functions/geocode`

3. **Verify deployment**:
   - Visit: `https://your-site.netlify.app/.netlify/functions/geocode?lat=5.6&lng=-0.2`
   - Should return geocoding JSON data
   - Check Netlify dashboard → Functions tab to see invocation logs

4. **Monitor usage**:
   - Netlify Functions: 125,000 requests/month on free tier
   - Each geocode request counts as one function invocation
   - Upgrade plan if you exceed free tier limits

### Expected Results After Deployment

✅ **Addresses display instead of coordinates**
- Before: `5.6336°N, 0.1732°W`
- After: `Ring Road, East Legon, Accra`

✅ **No more console errors**
- Circuit breaker still active as backup
- CORS issues completely resolved
- Professional error handling

✅ **Improved performance**
- 24-hour caching on responses
- Reduced client-side API calls
- Faster subsequent lookups

## Troubleshooting Deployment

**Issue**: Function returns 404 in production
- **Solution**: Check `netlify.toml` has `functions = "netlify/functions"` in [build] section
- **Solution**: Verify file is at exact path `netlify/functions/geocode.js`

**Issue**: Still seeing CORS errors
- **Solution**: Clear browser cache and hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
- **Solution**: Verify production URL detection works (check browser console for environment logs)

**Issue**: Function timeout errors
- **Solution**: Nominatim API might be slow, circuit breaker will handle it
- **Solution**: Consider caching strategy or alternative geocoding service

**Issue**: Exceeding function invocation limits
- **Solution**: Increase caching duration in function (currently 24 hours)
- **Solution**: Implement client-side cache in localStorage
- **Solution**: Upgrade Netlify plan or use alternative service
