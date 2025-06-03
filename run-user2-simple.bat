@echo off
echo One-Command User2 Build and Run...

REM Stop any existing Metro servers
taskkill /f /im node.exe 2>nul

REM Set up port forwarding
adb reverse tcp:8082 tcp:8082

REM Clean install and run in one command
cd android && call gradlew clean installUser2Debug && cd .. && start "Metro" cmd /k "npx react-native start --port 8082 --reset-cache" && timeout /t 8 /nobreak && adb shell am start -n com.matchchatapp.user2/com.matchchatapp.MainActivity

echo User2 app should be running!