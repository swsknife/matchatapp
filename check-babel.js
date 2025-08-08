try {
  const preset = require('metro-react-native-babel-preset');
  console.log('metro-react-native-babel-preset is properly installed and accessible');
  console.log('Version:', preset.version || 'Unknown');
} catch (error) {
  console.error('Error loading metro-react-native-babel-preset:');
  console.error(error.message);
  console.error('Stack:', error.stack);
}