@echo off
echo Fixing Metro Connection Issues...

echo Step 1: Setting up ADB port forwarding for Metro...
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8082 tcp:8082

echo Step 2: Checking device connection...
adb devices

echo Step 3: Checking if Metro ports are accessible...
netstat -an | findstr :8081
netstat -an | findstr :8082

echo Step 4: Clearing React Native cache...
npx react-native start --reset-cache --port 8081

echo Metro connection should now be fixed!
pause