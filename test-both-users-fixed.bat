@echo off
echo Starting MatchChatApp Dual-User Test Environment...

REM Uninstall previous apps
echo Uninstalling previous installations...
adb uninstall com.matchchatapp.user1
adb uninstall com.matchchatapp.user2

REM Set up port forwarding
echo Setting up port forwarding...
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8082 tcp:8082

REM Install both apps
echo Installing User1 app...
cd android
call gradlew installUser1Debug --no-daemon
echo Installing User2 app...
call gradlew installUser2Debug --no-daemon
cd ..

REM Clean Metro cache
echo Cleaning Metro cache...
rmdir /s /q "%TEMP%\metro-cache"
rmdir /s /q "%TEMP%\metro-bundler-cache"
rmdir /s /q "%TEMP%\react-native-packager-cache"

REM Start Metro for User1 in a new window
echo Starting Metro for User1 on port 8081...
start "Metro User1" cmd /k "npx react-native start --port 8081 --reset-cache"

REM Wait for Metro to start
echo Waiting for Metro to start...
timeout /t 15 /nobreak

REM Start Metro for User2 in a new window
echo Starting Metro for User2 on port 8082...
start "Metro User2" cmd /k "npx react-native start --port 8082 --reset-cache"

REM Launch both apps
echo Launching User1 app...
adb shell am start -n com.matchchatapp.user1/com.matchchatapp.MainActivity
echo Launching User2 app...
adb shell am start -n com.matchchatapp.user2/com.matchchatapp.MainActivity

echo Both apps should now be running. Check the Metro windows for any errors.