@echo off
echo Uninstalling existing apps...
adb uninstall com.matchchatapp.user1
adb uninstall com.matchchatapp

echo Running User1 Debug Build...
npx react-native run-android --variant user1Debug --port 8081