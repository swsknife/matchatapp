@echo off
echo Metro Connection Diagnostics
echo ============================

echo 1. Checking ADB connection...
adb devices

echo.
echo 2. Checking installed apps...
adb shell pm list packages | findstr matchchatapp

echo.
echo 3. Checking port forwarding...
adb reverse --list

echo.
echo 4. Setting up port forwarding...
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8082 tcp:8082

echo.
echo 5. Checking if ports are in use...
netstat -an | findstr :8081
netstat -an | findstr :8082

echo.
echo 6. Checking React Native cache...
echo Cache location: %APPDATA%\npm-cache\_npx
dir "%APPDATA%\npm-cache\_npx" 2>nul

echo.
echo 7. Testing Metro connection from device...
adb shell "curl -s http://localhost:8081/status || echo 'Metro not reachable'"

echo.
echo Diagnostics complete!
echo.
echo If Metro is not reachable:
echo 1. Make sure device is connected via USB
echo 2. Enable USB debugging
echo 3. Run: adb reverse tcp:8081 tcp:8081
echo 4. Clear React Native cache: npx react-native start --reset-cache
pause