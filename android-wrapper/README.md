# MelkiCAD for Android

This folder packages the published MelkiCAD website as an offline Android application using Capacitor.

## Build

The GitHub Actions workflow packages the current published `gh-pages` site and builds a debug APK. The APK appears under the workflow's Artifacts section as `MelkiCAD-Android-APK`.

## Android file saving

JSON, DXF, PNG, and PDF exports use Android's system document picker. The user chooses the destination and filename, and Android writes the original file bytes to that location. Cancelling the picker does not report a successful save.

## Included behavior

- HTML, CSS, and JavaScript are bundled in the APK; loading the app does not depend on the website or an internet connection.
- Project data remains in the app's local WebView storage.
- Import uses Android's file picker.
- Export opens Android's **Save to** picker instead of the share sheet.
- A debug APK is for testing. Public distribution requires a separately signed release build.
