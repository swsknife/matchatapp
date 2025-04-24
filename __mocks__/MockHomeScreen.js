import React from 'react';
import { View, Text, Button } from 'react-native';

// This is a simplified mock of HomeScreen that doesn't require any external dependencies
const MockHomeScreen = ({ navigation }) => {
  return (
    <View>
      <Text>User ID: test-uuid</Text>
      <Text>City</Text>
      <Text>Time</Text>
      <Text>Game Type</Text>
      <Button 
        title="Search"
        onPress={() => {}}
      />
    </View>
  );
};

export default MockHomeScreen;