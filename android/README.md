# TrashDrop Carter: Android app

The installed collector app. It shows the website inside Chrome (a Trusted Web
Activity) and adds one native screen, `TurnOnLocationActivity`, which opens
Google's "Turn on location" dialog. The yellow banner in the web app opens it
through the `trashdropcarter://location` link.

Same package name (`com.trashdrop.carter`) and website address as the version
built with PWABuilder, so it installs over it and collectors stay signed in.
The start address has `?android_layer=1`, which tells the website this version
can open the dialog. Older installs don't, and keep the browser's behaviour.

This project was generated with Bubblewrap and then edited by hand. **Don't run
`bubblewrap update` on it**: that regenerates the files and removes the native
screen and its entries in `AndroidManifest.xml` and `app/build.gradle`.

## Build a release

Never commit the keystore or its password. `.gitignore` excludes them. To
update installed apps, the file must be signed with the same keystore as before
and `versionCode` in `app/build.gradle` must go up.

From this folder, with JDK 17 and the Android SDK:

    ./gradlew assembleRelease
    BT=~/Library/Android/sdk/build-tools/35.0.0
    $BT/zipalign -f -p 4 app/build/outputs/apk/release/app-release-unsigned.apk aligned.apk
    $BT/apksigner sign --ks "<path to signing.keystore>" --out TrashDrop-Carter.apk aligned.apk

`apksigner` asks for the keystore password.
