# MelkiCAD for Android

This folder packages the published MelkiCAD website as an offline Android application using Capacitor.

## Add to the repository

Copy the `android-wrapper` folder and `.github/workflows/android-apk.yml` into the root of the MelkiCAD GitHub repository, then push them to `main`.

## Build

The GitHub Actions workflow takes the current published `gh-pages` site, bundles it inside the Android app, and builds a debug APK. The APK appears under the workflow's Artifacts section as `MelkiCAD-Android-APK`.

## Included behavior

- HTML, CSS, and JavaScript are bundled in the APK; loading the app does not depend on the website or an internet connection.
- Project data remains in the app's local WebView storage.
- Import uses Android's file picker.
- JSON, DXF, PNG, and PDF exports are handed to Android's share sheet so the user can save or share them.
- A debug APK is for testing. Public distribution requires a separately signed release build.
