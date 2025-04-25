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
echo IMPORTANT: When deploying to Render.com:
echo 1. Do NOT set a custom PORT environment variable
echo 2. Let Render.com automatically assign and manage the port
echo 3. Make sure your server code uses process.env.PORT
echo.

cd ..

rem Restore original .env file if needed
rem copy .env.local .env

pause