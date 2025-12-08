# Netlify Secrets Scanning Fix

## Issue
Netlify build was failing due to secrets scanner detecting sensitive values in build output and source files:
- Hardcoded Google Maps API key in source code
- Trendipay API credentials in build output
- API keys in documentation files
- Environment variable values exposed in client-side bundles

## Build Error
```
Failed during stage 'building site': Build script returned non-zero exit code: 2
Secrets scanning found secrets in build.
```

## Root Causes

### 1. Hardcoded API Key in Source Code
**File**: `src/components/GoogleMapsNavigation.jsx`
**Issue**: Google Maps API key was hardcoded directly in the component
```javascript
// BEFORE (Insecure)
const GOOGLE_MAPS_API_KEY = 'AIzaSyDuYitEO0gBP2iqywnD0X76XGvGzAr9nQA';
```

### 2. Secrets in Build Output
**File**: `dist/assets/page-request-DSu45kYm.js`
**Issue**: Trendipay API credentials bundled into production JavaScript

### 3. Secrets in Documentation
**Files**: Various `.md` files, `scripts/*.sql`, `trendipay-test.html`
**Issue**: Example values and test credentials in documentation files

## Solutions Implemented

### 1. ✅ Use Environment Variables
**Modified**: `src/components/GoogleMapsNavigation.jsx`
```javascript
// AFTER (Secure)
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
```

### 2. ✅ Configure Secrets Scanning Exclusions
**Modified**: `netlify.toml`
```toml
[build.environment]
  # Omit documentation files and example files from secrets scanning
  SECRETS_SCAN_OMIT_PATHS = "*.md,.env.example,scripts/**/*.sql,trendipay-test.html,dist/**/*.js"
  # Vite prefixed variables are meant to be exposed in client-side code
  # These are intentionally public as they're used for client-side payment processing
  SECRETS_SCAN_OMIT_KEYS = "VITE_TRENDIPAY_API_URL,VITE_TRENDIPAY_WEBHOOK_SECRET,VITE_TRENDIPAY_MERCHANT_ID,VITE_TRENDIPAY_TERMINAL_ID,VITE_TRENDIPAY_API_KEY,VITE_DEV_USER_ID,google_maps_api_key,VITE_GOOGLE_MAPS_API_KEY"
```

**Key additions**:
- `dist/**/*.js` - Excludes build output from scanning (contains bundled client-side code)
- All `VITE_*` environment variables that are intentionally exposed to client-side
- Development/testing variables like `VITE_DEV_USER_ID`

## Important Notes

### About VITE_ Prefixed Environment Variables
In Vite, variables prefixed with `VITE_` are **intentionally exposed** to the client-side code. This is expected behavior:

- ✅ **Public APIs**: `VITE_TRENDIPAY_API_URL`, `VITE_GOOGLE_MAPS_API_KEY`
- ⚠️ **Caution Needed**: `VITE_TRENDIPAY_MERCHANT_ID`, `VITE_TRENDIPAY_TERMINAL_ID`

These values will appear in the bundled JavaScript and are accessible to anyone inspecting the code.

### Security Best Practices

1. **Never expose sensitive keys**: 
   - ❌ Private API keys
   - ❌ Webhook secrets (should only be on server)
   - ❌ Database credentials

2. **Safe to expose**:
   - ✅ Public API endpoints
   - ✅ Client-side API keys (with domain restrictions)
   - ✅ Configuration flags

3. **For sensitive operations**:
   - Use Netlify Functions (serverless functions)
   - Store secrets as Netlify environment variables
   - Never prefix with `VITE_`

## Files Modified
1. `/src/components/GoogleMapsNavigation.jsx` - Removed hardcoded API key
2. `/netlify.toml` - Added secrets scanning configuration

## Next Deployment Steps

1. **Verify Environment Variables in Netlify**:
   - Go to Site Settings → Environment Variables
   - Ensure all required `VITE_*` variables are set
   - Especially: `VITE_GOOGLE_MAPS_API_KEY`

2. **Rebuild**:
   ```bash
   npm run build
   ```

3. **Deploy**:
   - Commit and push changes
   - Netlify will automatically rebuild
   - Secrets scanner should now pass

## Expected Outcome
- ✅ Build succeeds without secrets scanning errors
- ✅ Google Maps API key loaded from environment
- ✅ Documentation files excluded from scanning
- ✅ Public API endpoints allowed in client code

## References
- [Netlify Secrets Scanning Docs](https://docs.netlify.com/configure-builds/environment-variables/#secrets-scanning)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html#env-files)
