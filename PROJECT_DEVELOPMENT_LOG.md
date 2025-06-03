# MatchChatApp Development Log & Configuration Guide

## Project Overview

- **App Name**: MatchChatApp
- **Type**: React Native chat application with dual-user support
- **Server**: Render.com hosted backend
- **Development**: Metro bundler for debugging, APK builds for release

## Current Working Configuration (As of Latest Session)

### ✅ WORKING SETUP

The app is currently working with these files:

- `diagnose-metro.bat` - Diagnostics tool
- `run-user1-simple.bat` - One-command User1 build & run
- `run-user2-simple.bat` - One-command User2 build & run
- `fix-metro-connection.bat` - Metro connection troubleshooting

### 🏗️ App Architecture

```
MatchChatApp/
├── android/app/src/
│   ├── main/ (base configuration)
│   ├── user1/ (User1 variant)
│   └── user2/ (User2 variant)
├── src/
│   ├── screens/ (HomeScreen, ChatScreen, DebugScreen)
│   ├── store/ (Redux store)
│   └── utils/ (network, sessionManager, etc.)
└── Build Scripts (*.bat files)
```

### 🔧 Key Configuration Files

#### package.json Scripts (WORKING)

```json
"android:user1": "react-native run-android --mode user1Debug --port 8081"
"android:user2": "react-native run-android --mode user2Debug --port 8082"
```

**Note**: Uses `--mode` (works) NOT `--variant` (doesn't work)

#### Environment Configuration

- `.env` - Contains `REACT_APP_SERVER_URL=https://match-chat-app-server.onrender.com`
- `babel.config.js` - Configured for react-native-dotenv

#### Android Build Variants

- `user1Debug` - Package: com.matchchatapp.user1, Port: 8081
- `user2Debug` - Package: com.matchchatapp.user2, Port: 8082

## 🔄 Development Modes & Transitions

### Current Mode: METRO + RENDER SERVER (WORKING)

- **Purpose**: Active development with hot reload
- **Metro**: Local bundler on ports 8081/8082
- **Server**: Remote Render.com server
- **Status**: ✅ Working perfectly

### Previous Mode: APK + RENDER SERVER

- **Purpose**: Testing release builds
- **Build**: Standalone APK files
- **Server**: Remote Render.com server
- **Status**: Used for testing, not current

### Transition Issues Encountered

When switching from APK testing back to Metro development:

1. **Cache corruption** - Metro/React Native caches got corrupted
2. **Missing ADB forwarding** - Device couldn't reach Metro
3. **Environment drift** - Configuration inconsistencies

## 🚨 Critical Issues & Solutions

### Issue: "Unable to load script" Error

**Cause**: App launches before Metro is ready
**Solution**: Use the working batch scripts that ensure proper timing

### Issue: "installDebug is ambiguous" Error

**Cause**: Pressing 'a' in Metro console triggers generic build
**Solution**: NEVER press 'a' in Metro - use batch scripts instead

### Issue: Metro Connection Problems

**Cause**: Missing ADB port forwarding
**Solution**: `adb reverse tcp:8081 tcp:8081` in scripts

## 📋 Standard Operating Procedures

### For Development (Current Working Method)

1. Run `diagnose-metro.bat` (if issues)
2. Run `run-user1-simple.bat` OR `run-user2-simple.bat`
3. **NEVER press 'a' in Metro console**
4. Use 'r' to reload, 'd' for dev menu

### For Release Testing

1. Build APK: `cd android && gradlew assembleUser1Release`
2. Install: `adb install app-user1-release.apk`
3. Test with production server

### For Troubleshooting

1. Run `diagnose-metro.bat`
2. Run `fix-metro-connection.bat`
3. Check ADB connection: `adb devices`
4. Clear caches if needed

## 🔍 Debug Information

### Last Successful Run Log

```
info Welcome to React Native v0.74
warning: the transform cache was reset.
info Dev server ready
LOG Running "MatchChatApp" with {"rootTag":11}
LOG Socket connected: UtMcHPthBT3yNK4nAAAB
LOG Socket connected in initializeSocket promise
```

### Key Success Indicators

- ✅ Metro starts on correct port (8081/8082)
- ✅ Transform cache resets (clears corruption)
- ✅ Socket connects to Render server
- ✅ App launches without "Unable to load script" error

## 🚧 Development vs Production Differences

### Development-Only Files (DO NOT DEPLOY)

- `diagnose-metro.bat`
- `run-user1-simple.bat`
- `run-user2-simple.bat`
- `fix-metro-connection.bat`
- `run-user1-complete.bat`
- `run-user2-complete.bat`

### Production Considerations

- Remove development batch scripts
- Use release APK builds
- Ensure proper environment variables
- Test with production server endpoints

## 📝 Change Log

### Latest Session Changes

- ✅ Fixed Metro connection issues
- ✅ Created working batch scripts
- ✅ Resolved cache corruption
- ✅ Established working development workflow
- ✅ Fixed ErrorUtils.getGlobalHandler undefined error (non-critical logging issue)

### Previous Sessions

- Implemented dual-user architecture
- Set up Render.com server integration
- Created Android build variants
- Implemented Redux store and socket.io

## 🎯 Quick Start for New Chat Sessions

When starting a new chat, provide this context:

1. **Current Status**: Metro + Render server development mode working
2. **Working Scripts**: `run-user1-simple.bat`, `run-user2-simple.bat`
3. **Key Rule**: Never press 'a' in Metro console
4. **Architecture**: Dual-user React Native app with socket.io
5. **Server**: https://match-chat-app-server.onrender.com

## 🔮 Future Considerations

- Monitor React Native version updates (currently 0.74.1, latest 0.79.2)
- Consider upgrading when stable
- Maintain separation between development and production configurations
- Keep batch scripts for development efficiency

---

**Last Updated**: Current Session
**Status**: ✅ WORKING - Metro + Render Server Development Mode
