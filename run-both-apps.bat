@echo off
echo Starting MatchChatApp with two different user profiles...

REM First, uninstall both apps to ensure clean installation
echo Uninstalling previous installations...
cd android
call gradlew uninstallBothApps
cd ..

REM Start User1 app in a new terminal window
echo Starting User1 app on port 8081...
start cmd /k "cd %~dp0 && npx react-native run-android --mode user1Debug --port 8081"

REM Wait a bit before starting the second app
timeout /t 5 /nobreak

REM Start User2 app in a new terminal window
echo Starting User2 app on port 8082...
start cmd /k "cd %~dp0 && npx react-native run-android --mode user2Debug --port 8082"

echo Both apps should be starting now. Check the terminal windows for progress.