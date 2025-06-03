@echo off
echo One-Command User1 Build and Run...

REM Stop any existing Metro servers
taskkill /f /im node.exe 2>nul

REM Set up port forwarding
adb reverse tcp:8081 tcp:8081

REM Clean install and run in one command
cd android && call gradlew clean installUser1Debug && cd .. && start "Metro" cmd /k "npx react-native start --port 8081 --reset-cache" && timeout /t 8 /nobreak && adb shell am start -n com.matchchatapp.user1/com.matchchatapp.MainActivity

echo User1 app should be running!