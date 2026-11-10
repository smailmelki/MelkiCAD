# MelkiCAD for Android

This folder packages the MelkiCAD web app (`../src`) as an offline Android application using Capacitor.

## Build

Run the `Build MelkiCAD Android APK` workflow manually (Actions → Run workflow) or push a `v*` tag.
The workflow bundles the current `src/` into the app, so it works offline and does not depend on the website.

- **Without signing secrets:** a debug APK is built (installable for testing) → artifact `MelkiCAD-Android-Debug`.
- **With secrets** `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`:
  a signed release APK is built → artifact `MelkiCAD-Android-Release`.

The service-worker cache version is stamped with the commit SHA during the build, so a new APK never serves stale cached files.

## Android file saving

JSON, DXF, PNG, PDF and CSV exports use Android's system document picker (`SaveFilePlugin`). The user chooses the destination
and filename, and Android writes the original bytes. Cancelling the picker does not report a successful save.

## Included behavior

- HTML, CSS, and JavaScript are bundled in the APK.
- Project data remains in the app's local WebView storage.
- Import uses Android's file picker; export uses the **Save to** picker.
- Launcher icons: adaptive foreground kept inside the safe zone, legacy icons at the correct densities (48–192 px).
