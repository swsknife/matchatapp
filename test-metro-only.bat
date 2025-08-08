@echo off
echo Testing Metro bundler only...

REM Clean Metro cache
echo Cleaning Metro cache...
rmdir /s /q "%TEMP%\metro-cache"
rmdir /s /q "%TEMP%\metro-bundler-cache"
rmdir /s /q "%TEMP%\react-native-packager-cache"

REM Set up port forwarding
echo Setting up port forwarding...
adb reverse tcp:8081 tcp:8081

REM Start Metro server with verbose logging
echo Starting Metro server with verbose logging...
npx react-native start --port 8081 --reset-cache --verbose