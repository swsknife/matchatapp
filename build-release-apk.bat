@echo off
echo Building Release APK for MatchChatApp...

rem Copy production environment file
copy .env.production .env

rem Clean the project
cd android
call gradlew clean

rem Build the release APK for user1
call gradlew assembleUser1Release

echo.
echo Release APK built successfully!
echo.
echo APK location: android/app/build/outputs/apk/user1/release/app-user1-release.apk
echo.
echo Note: This APK is configured to connect to https://match-chat-app-server.onrender.com
echo Please deploy your server to Render.com before using this APK.
echo.

cd ..

rem Restore original .env file if needed
rem copy .env.local .env

pause