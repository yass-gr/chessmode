# Native builds

Install dependencies with `npm ci`. Capacitor packages are pinned in the lockfile and package manifest.

## Android

Install JDK 21 and the Android SDK, set `ANDROID_HOME` to the SDK directory, then run `npm run android:build`. The debug APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. Run `npm run android:run` to deploy to an attached device or emulator.

## iOS

On a Mac with Xcode 26 or newer, run `npm ci`, `npm run cap:sync`, and `npx cap open ios`. Select a signing team in Xcode and build or run on a simulator or device. iOS builds require macOS.

## Store assets

Prepare store-specific screenshots, descriptions, privacy details, and promotional artwork. Production releases also need signing credentials and store listings. Review launcher and splash images on target devices before submission.
