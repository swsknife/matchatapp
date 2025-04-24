// path-debug.js
const fs = require('fs');
const path = require('path');

// Check if files exist
const checkPaths = [
  './src/screens/HomeScreen.js',
  './src/screens/ChatScreen.js',
  './src/utils/network.js',
];

console.log('Current working directory:', process.cwd());

checkPaths.forEach(p => {
  try {
    const absolutePath = path.resolve(p);
    const exists = fs.existsSync(absolutePath);
    console.log(`Path ${p} (${absolutePath}): ${exists ? 'EXISTS' : 'DOES NOT EXIST'}`);
  } catch (err) {
    console.error(`Error checking ${p}:`, err);
  }
});