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

## Reproducible builds

`package.json` pins Capacitor to an exact version, but `esbuild` is a range (`^0.25.0`) and transitive dependencies float, so builds are
only reproducible once a lockfile is committed. To create it, run this once on a machine with network access and commit the result:

```
cd android-wrapper
npm install
git add package-lock.json
```

From then on the workflow runs `npm ci` automatically. Until the file exists, the workflow prints a warning and falls back to `npm install`.
The repository root has no dependencies, so it needs no lockfile.

## Included behavior

- HTML, CSS, and JavaScript are bundled in the APK.
- Project data remains in the app's local WebView storage.
- Import uses Android's file picker; export uses the **Save to** picker.
- Launcher icons: adaptive foreground kept inside the safe zone, legacy icons at the correct densities (48–192 px).
  The adaptive foreground is named `melkicad_launcher_foreground` on purpose: `npx cap add android` generates its own
  `ic_launcher_foreground` / `ic_launcher_background` resources (the Capacitor logo), and reusing those names can let the
  default win on the device. `node tools/check.js` and the build workflow fail if that name clash comes back.
- Splash screen: `native/res/drawable/splash.xml` (white background, the MelkiCAD icon centred at a fixed 192dp, never stretched)
  with its image in `drawable-nodpi/melkicad_splash_logo.png`. The Capacitor template points to `@drawable/splash`, so the workflow
  first deletes the template's `splash.png` files (every density, port and land) and then copies ours; a leftover `splash.png`
  next to `splash.xml` would be a duplicate-resource build error. To change the splash, edit those two files.
