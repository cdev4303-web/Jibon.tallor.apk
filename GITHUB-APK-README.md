# Jibon Ladies Tailor — GitHub APK Build

This project builds the React/Vite app as an Android APK using Capacitor and GitHub Actions.

## GitHub steps
1. Create a GitHub repository.
2. Upload all project files, including `.github/workflows/build-apk.yml`.
3. Push to the `main` branch.
4. Open **Actions** → **Build Jibon Tailor APK**.
5. Select **Run workflow** if needed.
6. Wait for the green check to finish.
7. Open the completed workflow run and download the artifact named **Jibon-Ladies-Tailor-APK**.
8. Extract the downloaded artifact and install `app-debug.apk` on Android.

## Important
The APK is a debug APK for testing/personal use. For Play Store release, a signed release build should be configured separately.
