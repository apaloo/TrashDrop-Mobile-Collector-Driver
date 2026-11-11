# TrashDrop Carter — TWA Build Guide (PWABuilder)

A Trusted Web Activity (TWA) wraps your PWA in a real Android app with a
proper `targetSdkVersion`, eliminating the Google Play Protect warning.

---

## Prerequisites

| Item | Value |
|------|-------|
| **Site URL** | `https://trashdrop-mobile-collector.netlify.app` |
| **Package name** | `com.trashdrop.carter` |
| **App name** | TrashDrop Carter |
| **Theme colour** | `#9AE65C` |
| **Icon (512×512)** | `public/icons/icon-512x512.png` |
| **Maskable icon** | `public/icons/maskable_icon.png` |

---

## Step-by-Step

### 1. Open PWABuilder

Go to **https://www.pwabuilder.com** and enter:

```
https://trashdrop-mobile-collector.netlify.app
```

Click **Start**. PWABuilder will analyse your manifest, service worker, and
security headers. Fix any warnings it flags (most should already pass).

### 2. Package for Android

1. Click **"Package for stores"**
2. Select **"Android"**
3. Choose **"Google Play"** (TWA option)

### 3. Configure the TWA

Fill in the form with these values:

| Field | Value |
|-------|-------|
| **Package ID** | `com.trashdrop.carter` |
| **App name** | `TrashDrop Carter` |
| **App version** | `3.2.0` |
| **App version code** | `320` |
| **Host** | `trashdrop-mobile-collector.netlify.app` |
| **Start URL** | `/` |
| **Theme color** | `#9AE65C` |
| **Navigation color** | `#9AE65C` |
| **Background color** | `#ffffff` |
| **Status bar color** | `#9AE65C` |
| **Splash screen fade-out** | `300` ms |
| **Fallback type** | `Custom Tab` |
| **Display mode** | `Standalone` |
| **Notification delegation** | `Enabled` |
| **Location delegation** | `Enabled` |
| **Signing key** | **Generate new** (or upload existing `.keystore`) |
| **Key alias** | `trashdrop` |
| **Key password** | (choose a strong password, **save it securely**) |
| **Store password** | (same as key password, or different — **save it**) |

> **IMPORTANT**: Download and securely back up the generated `.keystore` file.
> You will need it for every future app update. If you lose it, you cannot
> publish updates to the same Play Store listing.

### 4. Download the Package

PWABuilder generates:

| File | Purpose |
|------|---------|
| `app-release-signed.apk` | Sideload-ready APK |
| `app-release-bundle.aab` | Google Play upload bundle |
| `assetlinks.json` | Digital Asset Links (already has your SHA-256) |
| `signing-key-info.txt` | Key details (alias, passwords) |
| `signing.keystore` | Your signing key |

### 5. Update assetlinks.json on Netlify

Open the `assetlinks.json` file PWABuilder generated.  Copy the
`sha256_cert_fingerprints` value and paste it into:

```
public/.well-known/assetlinks.json
```

Replace `"REPLACE_WITH_SHA256_FROM_PWABUILDER"` with the actual fingerprint.

**Example** (your fingerprint will be different):
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.trashdrop.carter",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
      ]
    }
  }
]
```

Then commit, push, and redeploy:
```bash
git add public/.well-known/assetlinks.json
git commit -m "chore: add TWA signing fingerprint to assetlinks.json"
git push origin main
```

### 6. Verify Digital Asset Links

After deployment, confirm the file is accessible:

```
https://trashdrop-mobile-collector.netlify.app/.well-known/assetlinks.json
```

You can also use Google's verification tool:
```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://trashdrop-mobile-collector.netlify.app&relation=delegate_permission/common.handle_all_urls
```

### 7. Test the APK

Install `app-release-signed.apk` on an Android device:

```bash
adb install app-release-signed.apk
```

Or transfer the APK to the device and open it from a file manager.

**Verify:**
- App opens full-screen (no browser chrome)
- No Google Play Protect warning
- URL bar does NOT appear (proves asset links are working)

### 8. Publish to Google Play Store

1. Go to **https://play.google.com/console**
2. Create a new app → fill in listing details
3. Upload `app-release-bundle.aab` to a release track
4. Complete the store listing (screenshots, description, etc.)
5. Submit for review

---

## Updating the App

When you deploy a new version of the PWA:

1. The TWA automatically picks up the changes (it loads your website)
2. **No new APK needed** for web-only changes
3. Only rebuild the APK/AAB if you change:
   - Package name
   - Signing key
   - Android-specific settings (splash screen, colours, etc.)

If you DO rebuild, bump the `versionCode` and `versionName`, re-sign with
the **same keystore**, and upload the new `.aab` to Play Console.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| URL bar appears in TWA | `assetlinks.json` fingerprint doesn't match signing key, or file isn't being served. Verify at `/.well-known/assetlinks.json`. |
| Play Protect still warns | You're running the old WebAPK, not the TWA. Uninstall the old app, install the TWA APK. |
| "App not installed" error | Conflicting signature. Uninstall any previous version first. |
| Asset links not verifying | Check Netlify redirect rules aren't intercepting `/.well-known/`. Confirm `Content-Type: application/json`. |

---

## File Checklist

```
public/.well-known/assetlinks.json  ← SHA-256 fingerprint (UPDATE THIS)
public/manifest.json                ← related_applications → Play Store
vite.config.js                      ← matching related_applications
netlify.toml                        ← headers + redirect for .well-known
```
