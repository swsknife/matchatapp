@echo off
echo Building and installing User2 Debug variant...
cd android
call gradlew clean
call gradlew installUser2Debug
cd ..
echo Done! Now run "npx react-native start --port 8082" in a separate terminal and use the app.