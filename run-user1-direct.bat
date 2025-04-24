@echo off
echo Building User1 Debug APK...
cd android
call gradlew assembleUser1Debug
cd ..

echo Installing APK...
adb install -r android/app/build/outputs/apk/user1/debug/app-user1-debug.apk

echo Starting Metro server on port 8081...
start cmd /k npx react-native start --port 8081

echo Launching app...
adb shell am start -n com.matchchatapp.user1/com.matchchatapp.MainActivity