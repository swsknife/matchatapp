@echo off
echo Building and installing User1 Debug variant...
cd android
call gradlew clean
call gradlew installUser1Debug
cd ..
echo Done! Now run "npx react-native start --port 8081" in a separate terminal and use the app.