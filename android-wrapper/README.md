# MelkiCAD for Android

This folder packages the published MelkiCAD website as an offline Android application using Capacitor.

## Build

The GitHub Actions workflow bundles the current published `gh-pages` site into the Android app and builds a debug APK. Download `MelkiCAD-Android-APK` from the workflow run's Artifacts section.

## Included behavior

- The HTML, CSS, and JavaScript are bundled in the APK and work offline.
- Project data remains in the app's local WebView storage.
- Import uses Android's file picker.
- JSON, DXF, PNG, and PDF exports are handed to Android's share sheet.
- A debug APK is for testing; public distribution requires a separately signed release build.
