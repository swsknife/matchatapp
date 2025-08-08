@echo off
echo Starting comprehensive fix for MatchChatApp...

REM Clean project
echo Cleaning project...
rmdir /s /q node_modules
rmdir /s /q android\build
rmdir /s /q android\app\build
rmdir /s /q "%TEMP%\metro-cache"
rmdir /s /q "%TEMP%\metro-bundler-cache"
rmdir /s /q "%TEMP%\react-native-packager-cache"

REM Reinstall dependencies
echo Reinstalling dependencies...
call npm install

REM Install specific metro-react-native-babel-preset version
echo Installing metro-react-native-babel-preset matching React Native version...
call npm install --save-dev metro-react-native-babel-preset@0.74.1

REM Install metro-babel-transformer
echo Installing @react-native/metro-babel-transformer...
call npm install --save-dev @react-native/metro-babel-transformer

REM Clean and rebuild Android project
echo Cleaning and rebuilding Android project...
cd android
call gradlew clean
cd ..

REM Uninstall previous apps
echo Uninstalling previous installations...
adb uninstall com.matchchatapp.user1
adb uninstall com.matchchatapp.user2

REM Set up port forwarding
echo Setting up port forwarding...
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8082 tcp:8082

REM Build and install User1 app
echo Building and installing User1 app...
cd android
call gradlew installUser1Debug --no-daemon
cd ..

echo Fix completed. Now you can run test-user1-only.bat to test the app.