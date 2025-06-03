# MatchChatApp - Quick Reference

## 🚀 Current Working Setup (Metro + Render)

### To Run User1:

```bash
run-user1-simple.bat
```

### To Run User2:

```bash
run-user2-simple.bat
```

### If Issues:

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

---

**Status**: ✅ WORKING
