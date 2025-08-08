@echo off
echo Starting MatchChatApp User1 Test...

REM Clean Metro cache
echo Cleaning Metro cache...
rmdir /s /q "%TEMP%\metro-cache"
rmdir /s /q "%TEMP%\metro-bundler-cache"
rmdir /s /q "%TEMP%\react-native-packager-cache"

REM Uninstall previous app
echo Uninstalling previous installation...
adb uninstall com.matchchatapp.user1

REM Set up port forwarding
echo Setting up port forwarding...
adb reverse tcp:8081 tcp:8081

REM Install User1 app
echo Installing User1 app...
cd android
call gradlew clean
call gradlew installUser1Debug --no-daemon
cd ..

REM Start Metro server
echo Starting Metro server...
npx react-native start --port 8081 --reset-cache

REM Launch the app
echo Launching User1 app...
adb shell am start -n com.matchchatapp.user1/com.matchchatapp.MainActivity