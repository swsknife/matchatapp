@echo off
echo Starting MatchChatApp Fix and Test...

REM Clean Metro cache
echo Cleaning Metro cache...
rmdir /s /q "%TEMP%\metro-cache"
rmdir /s /q "%TEMP%\metro-bundler-cache"
rmdir /s /q "%TEMP%\react-native-packager-cache"
rmdir /s /q "node_modules\.cache"

REM Uninstall previous apps
echo Uninstalling previous installations...
adb uninstall com.matchchatapp.user1
adb uninstall com.matchchatapp.user2

REM Set up port forwarding
echo Setting up port forwarding...
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8082 tcp:8082

REM Install User1 app
echo Installing User1 app...
cd android
call gradlew clean
call gradlew installUser1Debug --no-daemon
cd ..

REM Start Metro server with explicit babel preset
echo Starting Metro server...
set BABEL_ENV=development
npx react-native start --port 8081 --reset-cache