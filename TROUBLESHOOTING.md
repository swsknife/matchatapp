# Troubleshooting Guide for MatchChatApp

## Issues Fixed

1. **Metro Bundler Issues**
   - Installed the correct version of `metro-react-native-babel-preset` (0.74.1) to match React Native version
   - Installed `@react-native/metro-babel-transformer` for proper transformation
   - Created a more robust metro.config.js with explicit transformer configuration
   - Added a .babelrc file as an alternative to babel.config.js

2. **Gradle Task Issues**
   - Fixed the `uninstallBothApps` task in android/app/build.gradle
   - Created separate tasks for uninstalling each app variant
   - Added `ignoreExitValue true` to prevent task failures if apps aren't installed

3. **Dual-User Testing**
   - Created improved scripts for testing both user variants
   - Added proper port forwarding for both Metro instances
   - Improved app launching process

4. **JavaScript Syntax Errors (December 2024)**
   - Fixed duplicate `</TouchableOpacity>` tag in HomeScreen.js
   - Fixed missing closing braces and parentheses in network.js
   - Fixed Redux store imports - updated from individual reducer files to single reducers.js export
   - All syntax errors resolved for successful release builds

5. **Release APK Testing Method (December 2024)**
   - Successfully implemented standalone APK testing that doesn't require Metro
   - Fixed all build issues preventing release APK generation
   - APK builds in ~6 minutes and works independently on any device
   - Eliminates Metro connection issues, port conflicts, and development server dependencies

## Testing Methods (Updated December 2024)

### Method 1: Release APK (Recommended - No Metro Required)
```bash
# Build standalone release APK
.\build-release-apk.bat

# Install on device/emulator
adb install android/app/build/outputs/apk/user1/release/app-user1-release.apk
```
**Benefits:**
- ✅ No Metro server dependency
- ✅ Production-like environment  
- ✅ Better performance (optimized build)
- ✅ No port conflicts or connection issues
- ✅ Works on any device without development setup
- ✅ Build time: ~6 minutes
- ✅ APK location: `android/app/build/outputs/apk/user1/release/app-user1-release.apk`

### Method 2: Debug Build with Metro (Development Only)
```bash
# Terminal 1: Start Metro for User1
npm run start:user1

# Terminal 2: Install and run User1  
npm run android:user1
```
**Note:** Only use this method if you need live reloading for development.

### Method 3: Dual User Testing
```bash
# Build User1 APK
.\build-release-apk.bat

# TODO: Build User2 APK (script to be created)
# Install both APKs for testing user-to-user communication
```

## How to Fix and Test (Legacy Methods)

1. **Complete Reset and Fix**
   Run the `fix-all-issues.bat` script to:
   - Clean the project
   - Reinstall dependencies
   - Install the correct metro-react-native-babel-preset version
   - Install @react-native/metro-babel-transformer
   - Clean and rebuild the Android project
   - Uninstall previous app installations
   - Set up port forwarding
   - Build and install the User1 app

2. **Testing Metro Bundler Only**
   If you want to test just the Metro bundler without installing apps, run `test-metro-only.bat` to:
   - Clean Metro cache
   - Set up port forwarding
   - Start Metro server with verbose logging to diagnose any issues

3. **Testing Single User**
   After running the fix script, run `test-user1-only.bat` to:
   - Clean Metro cache
   - Uninstall previous app
   - Set up port forwarding
   - Install User1 app
   - Start Metro server
   - Launch the app

4. **Testing Both Users**
   After confirming single user works, run `test-both-users-fixed.bat` to:
   - Uninstall previous apps
   - Set up port forwarding
   - Install both app variants
   - Start Metro for User1 on port 8081
   - Start Metro for User2 on port 8082
   - Launch both apps

## Troubleshooting Tips

- If Metro fails to start, try clearing the cache manually:
  ```
  rmdir /s /q "%TEMP%\metro-cache"
  rmdir /s /q "%TEMP%\metro-bundler-cache"
  rmdir /s /q "%TEMP%\react-native-packager-cache"
  ```

- If Gradle tasks fail, try running with the `--info` flag for more details:
  ```
  cd android
  gradlew installUser1Debug --info
  ```

- If port forwarding fails, check if ADB is connected properly:
  ```
  adb devices
  ```

- If apps crash on launch, check the Metro logs for JavaScript errors