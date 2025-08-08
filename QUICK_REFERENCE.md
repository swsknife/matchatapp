# MatchChatApp - Quick Reference

## 🚀 **RECOMMENDED: Release APK Method (December 2024)**

### Build & Test User1 (No Metro Required):
```bash
.\build-release-apk.bat
adb install android/app/build/outputs/apk/user1/release/app-user1-release.apk
```

**Benefits:**
- ✅ No Metro server needed
- ✅ Production-like testing
- ✅ No connection issues
- ✅ Works on any device
- ✅ ~6 minute build time

## 🔧 Legacy Metro Method (Development Only)

### To Run User1:
```bash
run-user1-simple.bat
```

### To Run User2:
```bash
run-user2-simple.bat
```

### To Run Both Users Simultaneously:
```bash
.\test-both-users.bat
```

### If Metro Issues:
```bash
diagnose-metro.bat
fix-metro-connection.bat
```

## ⚠️ CRITICAL RULES

- **NEVER press 'a' in Metro console** (causes "installDebug is ambiguous" error)
- Use 'r' to reload, 'd' for dev menu
- Scripts handle everything automatically

## 📱 App Architecture

- **User1**: com.matchchatapp.user1 (Port 8081)
- **User2**: com.matchchatapp.user2 (Port 8082)
- **Server**: https://match-chat-app-server.onrender.com

## 🔧 Package.json Scripts

```json
"android:user1": "react-native run-android --mode user1Debug --port 8081"
"android:user2": "react-native run-android --mode user2Debug --port 8082"
```

## 📋 Success Indicators

- Metro starts without errors
- "transform cache was reset" (good - clears corruption)
- Socket connects to server
- No "Unable to load script" error

## 🆘 Common Issues

| Issue                       | Solution                          |
| --------------------------- | --------------------------------- |
| "Unable to load script"     | Use batch scripts (proper timing) |
| "installDebug is ambiguous" | Don't press 'a' in Metro          |
| Metro connection failed     | Run `fix-metro-connection.bat`    |
| Cache corruption            | Scripts include `--reset-cache`   |
| JavaScript syntax errors    | Check for missing braces `{}`     |
| TypeScript type errors      | Install missing `@types/*` packages |

## 🔧 Recent Fixes

### Performance Optimization (Latest)
- **Issue**: HomeScreen component re-rendering too frequently, causing "Setting up socket listeners" log spam
- **Location**: `src/screens/HomeScreen.js`
- **Fix**: 
  - Separated socket initialization from state updates
  - Implemented memoized event handlers with useCallback
  - Split AppState listener and stuck search detection into separate effects
  - Added proper cleanup for socket retry timeouts
- **Impact**: 
  - Significantly reduced unnecessary re-renders
  - Improved app performance and battery usage
  - Enhanced socket connection stability
  - Better memory management with proper cleanup
  - Created new `test-both-users.bat` for dual-user testing

### Socket Initialization & Background Timer (Previous)
- **Issue 1**: Socket initialization timing issues causing "Socket is not initialized yet" warnings
- **Issue 2**: Countdown timer lagging when app goes to background/foreground
- **Location**: `App.js`, `src/screens/HomeScreen.js`, `src/utils/network.js`
- **Fix**: 
  - Moved socket initialization to app startup in `App.js`
  - Replaced timer-based countdown with timestamp-based calculation
  - Added AppState listener for background/foreground handling
- **Impact**: 
  - Instant search capability without socket warnings
  - Accurate countdown timer regardless of app state
  - Better user experience and app reliability

### TypeScript Configuration (Previous)
- **Issue**: Missing type definitions for `use-sync-external-store`, `yargs`, `yargs-parser`
- **Location**: `tsconfig.json` and missing type packages
- **Fix**: Installed missing type packages and updated TypeScript configuration
- **Impact**: Resolved all TypeScript errors, enabled proper type checking

### Network.js Syntax Error (Previous)
- **Issue**: Missing closing brace `}` in `queueReadStatus` function
- **Location**: `src/utils/network.js` line 1021
- **Fix**: Added missing `}` after the inner `if` statement for queue capacity check
- **Impact**: Resolved JavaScript parsing errors preventing app compilation

## 🏗️ Core Architecture

### Frontend (React Native)
- **Screens**: HomeScreen, ChatScreen, DebugScreen
- **State Management**: Redux store with actions/reducers
- **Networking**: Socket.io client with singleton pattern
- **Utils**: Session management, error handling, storage cleanup

### Backend (Node.js + Express)
- **Server**: Hosted on Render.com
- **Real-time**: Socket.io for chat communication
- **Features**: User matching, message handling, connection management

### Key Files
- `src/utils/network.js` - Socket.io connection management
- `src/utils/sessionManager.js` - User session handling
- `src/store/store.js` - Redux store configuration
- `server/server.js` - Backend server implementation

---

**Status**: ✅ WORKING - All issues resolved, performance optimized, dual-user testing script added
