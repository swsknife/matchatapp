@echo off
echo Testing simplified setup...

REM Set up port forwarding
adb reverse tcp:8081 tcp:8081

REM Uninstall previous app
adb uninstall com.matchchatapp.user1

REM Install User1 app
cd android
call gradlew installUser1Debug --no-daemon
cd ..

REM Start Metro server
npx react-native start --port 8081 --reset-cache