@echo off
echo Starting MatchChatApp Dual-User Test Environment...

REM First, uninstall both apps to ensure clean installation
echo Uninstalling previous installations...
cd android
call gradlew uninstallBothApps
cd ..

REM Set up port forwarding for both ports
echo Setting up port forwarding...
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8082 tcp:8082

REM Install both apps without starting Metro
echo Installing User1 app...
cd android
call gradlew installUser1Debug
echo Installing User2 app...
call gradlew installUser2Debug
cd ..

REM Start Metro for User1 in a new window
echo Starting Metro for User1 on port 8081...
start "Metro User1" cmd /k "npx react-native start --port 8081 --reset-cache"

REM Start Metro for User2 in a new window
echo Starting Metro for User2 on port 8082...
start "Metro User2" cmd /k "set REACT_NATIVE_PACKAGER_HOSTNAME=localhost && npx react-native start --port 8082 --reset-cache"

REM Wait for Metro servers to initialize
echo Waiting for Metro servers to initialize...
timeout /t 15 /nobreak

REM Launch both apps
echo Launching User1 app...
adb shell am start -n com.matchchatapp.user1/com.matchchatapp.MainActivity

echo Launching User2 app...
adb shell am start -n com.matchchatapp.user2/com.matchchatapp.MainActivity

echo Both apps should now be running!
echo.
echo IMPORTANT TESTING NOTES:
echo - Use the Debug screen in each app to verify socket connections
echo - Test matching by using the same parameters in both apps
echo - Test messaging and verify delivery between apps
echo - Test background/foreground transitions
echo - DO NOT press 'a' in either Metro console
echo.
echo Happy testing!