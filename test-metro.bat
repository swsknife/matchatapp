@echo off
echo Testing Metro bundler...

REM Set up port forwarding
adb reverse tcp:8081 tcp:8081

REM Clear Metro cache
echo Clearing Metro cache...
npx react-native start --reset-cache --port 8081