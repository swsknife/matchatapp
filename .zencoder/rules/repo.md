---
description: Repository Information Overview
alwaysApply: true
---

# MatchChatApp Information

## Summary
MatchChatApp is a React Native mobile application with a Node.js backend server. The app appears to be a chat application that allows multiple users to communicate. It's designed to support running two separate instances of the app simultaneously (User1 and User2) for testing and development purposes.

## Structure
- **android/**: Android platform-specific code and configuration
- **ios/**: iOS platform-specific code and configuration
- **server/**: Backend Node.js server with Express and Socket.IO
- **src/**: Main application source code
  - **components/**: React components
  - **screens/**: Application screens
  - **services/**: Service modules
  - **store/**: Redux store configuration
  - **utils/**: Utility functions
- **__tests__/**: Test files for the application
- **__mocks__/**: Mock files for testing

## Language & Runtime
**Language**: JavaScript/TypeScript
**Version**: React Native 0.74.1, React 18.2.0, Node.js >=18
**Build System**: Gradle (Android), Xcode (iOS)
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- React Native 0.74.1
- React Navigation 6.x
- Redux/Redux Toolkit
- Socket.IO Client 4.7.5
- Expo modules (notifications, blur, linear-gradient)
- AsyncStorage

**Development Dependencies**:
- Jest 29.6.3
- Testing Library (React Native)
- TypeScript 5.0.4
- Babel 7.x

**Server Dependencies**:
- Express 4.19.2
- Socket.IO 4.7.5
- CORS 2.8.5

## Build & Installation
**Mobile App**:
```bash
# Install dependencies
npm install

# Run for Android (User 1)
npm run android:user1
# OR
npm run build:user1

# Run for Android (User 2)
npm run android:user2
# OR
npm run build:user2

# Start Metro bundler (User 1)
npm run start:user1

# Start Metro bundler (User 2)
npm run start:user2

# Run for iOS
npm run ios
```

**Server**:
```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Start server
npm start
```

## Testing
**Framework**: Jest
**Test Location**: `__tests__/` directory
**Naming Convention**: `.test.js` and `.test.tsx` files
**Configuration**: `jest.config.js`
**Run Command**:
```bash
# Run tests
npm test
```

## Android Configuration
**Build Variants**:
- User1 (applicationIdSuffix: ".user1")
- User2 (applicationIdSuffix: ".user2")

**Minimum SDK**: 23
**Target SDK**: 34
**Build Tools**: 34.0.0

## Server Deployment
**Platform**: Render.com
**Configuration**: 
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variables:
  - PORT: Server port (default: 3000)
  - NODE_ENV: Environment (development/production)