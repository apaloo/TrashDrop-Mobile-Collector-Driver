# Deployment Troubleshooting Guide

## Issue: App Stuck on "Loading your dashboard..." Screen

### Symptoms
- App shows splash screen with "Loading your dashboard..." indefinitely
- No error messages visible
- App never progresses to login or main screen

### Root Causes & Solutions

#### 1. **Missing Environment Variables** ⚠️ MOST COMMON
**Problem**: `.env` file not included in deployment or environment variables not set on hosting platform.

**Solution**:
```bash
# Check if .env file exists
ls -la .env

# If missing, copy from example and configure
cp .env.example .env

# Edit .env with your actual values
nano .env
```

**Required Variables**:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**For Netlify/Vercel Deployment**:
1. Go to your project settings
2. Navigate to "Environment Variables" or "Build & Deploy"
3. Add both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. Redeploy the app

---

#### 2. **Service Worker Caching Old Version**
**Problem**: PWA service worker is serving cached old version of the app.

**Solution on Device**:
1. Open the app
2. Wait 10 seconds for error screen
3. Click "Clear Cache & Reload" button
4. App will reload with fresh version

**Manual Cache Clear**:
- **Android Chrome**: Settings → Site Settings → TrashDrop → Clear & Reset
- **iOS Safari**: Settings → Safari → Advanced → Website Data → Remove TrashDrop

---

#### 3. **Supabase Connection Timeout**
**Problem**: App can't connect to Supabase backend (network issue, wrong URL, or API key).

**Check**:
```bash
# Test Supabase connection
curl https://your-project.supabase.co/rest/v1/

# Should return: {"message":"The server is running"}
```

**Solution**:
- Verify `VITE_SUPABASE_URL` is correct
- Verify `VITE_SUPABASE_ANON_KEY` is valid
- Check if Supabase project is paused (free tier auto-pauses after inactivity)
- Ensure device has internet connection

---

#### 4. **JavaScript Bundle Not Loading**
**Problem**: Network error preventing JavaScript from loading.

**Check Browser Console** (if possible):
- Open DevTools (F12 or Inspect)
- Look for red errors in Console tab
- Check Network tab for failed requests

**Common Issues**:
- CORS errors → Check Netlify/hosting CORS settings
- 404 errors → Rebuild and redeploy
- CSP errors → Check Content Security Policy headers

---

#### 5. **Build Configuration Issues**
**Problem**: App built incorrectly or with wrong base path.

**Solution**:
```bash
# Clean rebuild
rm -rf dist node_modules
npm install
npm run build

# Test locally before deploying
npm run preview
```

**Check `vite.config.js`**:
```javascript
export default defineConfig({
  base: '/', // Should be '/' for most deployments
  // ...
})
```

---

## Quick Fixes (Try in Order)

### Fix 1: Clear Cache & Reload
1. Wait 10 seconds on loading screen
2. Click "Clear Cache & Reload" button
3. If that doesn't appear, manually clear browser cache

### Fix 2: Rebuild & Redeploy
```bash
# On your development machine
npm run build
git add dist
git commit -m "Rebuild app"
git push

# Or trigger manual deploy on Netlify/Vercel
```

### Fix 3: Check Environment Variables
```bash
# Verify .env file
cat .env

# Should show:
# VITE_SUPABASE_URL=https://...
# VITE_SUPABASE_ANON_KEY=eyJ...
```

### Fix 4: Test Locally First
```bash
# Run locally to verify it works
npm run dev

# If local works but deployed doesn't:
# → Environment variable issue
# → Build configuration issue
```

---

## Emergency Diagnostic Mode

Access diagnostic page to see detailed error information:
```
https://your-app-url.com/diagnostic
```

This page shows:
- Environment variables status
- Supabase connection status
- Browser capabilities
- Network status
- Service worker status

---

## Prevention

### Before Every Deployment:
1. ✅ Verify `.env` file has correct values
2. ✅ Test locally with `npm run dev`
3. ✅ Test production build with `npm run preview`
4. ✅ Check environment variables on hosting platform
5. ✅ Monitor first deployment for errors

### After Deployment:
1. ✅ Test on actual device (not just desktop)
2. ✅ Check browser console for errors
3. ✅ Verify Supabase connection in diagnostic page
4. ✅ Test login flow completely

---

## Still Not Working?

### Collect Debug Information:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Screenshot any red errors
4. Go to Network tab
5. Screenshot failed requests (red items)
6. Go to Application tab → Service Workers
7. Screenshot service worker status

### Contact Support With:
- Screenshots of errors
- Device type and browser version
- Steps to reproduce
- When the issue started
- Whether it works locally

---

## Common Error Messages

### "Failed to fetch"
- **Cause**: Network issue or CORS problem
- **Fix**: Check internet connection, verify Supabase URL

### "Invalid API key"
- **Cause**: Wrong or missing `VITE_SUPABASE_ANON_KEY`
- **Fix**: Update environment variable with correct key

### "refresh_token_not_found"
- **Cause**: Expired or invalid auth session
- **Fix**: App will auto-clear and redirect to login (fixed in latest version)

### "Module not found"
- **Cause**: Build issue or missing dependency
- **Fix**: Clean rebuild with `rm -rf dist node_modules && npm install && npm run build`
