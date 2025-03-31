import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Button,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  initializeSocket, onMatchFound, onConnectionError, startSearch, leaveMatch,
} from '../utils/network';
import { v4 as uuidv4 } from 'uuid';
import { useDispatch, useSelector } from 'react-redux';
import {
  setCity, setTime, setGame, setLoading, setIsSearching, setCurrentMatch,
} from '../store/actions';
import { REACT_APP_SERVER_URL } from '@env';

// Selectors
const selectCity = (state) => state.city;
const selectTime = (state) => state.time;
const selectGame = (state) => state.game;
const selectLoading = (state) => state.loading;
const selectIsSearching = (state) => state.isSearching;
const selectCurrentMatch = (state) => state.currentMatch;

const HomeScreen = ({ navigation }) => {
  const dispatch = useDispatch();

  const city = useSelector(selectCity);
  const time = useSelector(selectTime);
  const game = useSelector(selectGame);
  const loading = useSelector(selectLoading);
  const isSearching = useSelector(selectIsSearching);
  const currentMatch = useSelector(selectCurrentMatch);
  const [userId] = useState(uuidv4());
  const [countdown, setCountdown] = useState(300);

  useEffect(() => {
    const serverUrl = REACT_APP_SERVER_URL;
    initializeSocket(serverUrl);

    onMatchFound((matchData) => {
      dispatch(setLoading(false));
      setCountdown(300);
      dispatch(setIsSearching(false));
      dispatch(setCurrentMatch(matchData));
      navigation.navigate('Chat', { ...matchData, userId });
    });

    onConnectionError((error) => {
      console.error('Connection error:', error);
      Alert.alert('Error', 'Could not connect to the matchmaking server.');
    });

    return () => {
      // Cleanup listeners
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    let timer;
    if (loading) {
      setCountdown(300); // Reset countdown when search starts
      timer = setInterval(() => {
        setCountdown((prevCountdown) => {
          if (prevCountdown <= 1) {
            clearInterval(timer);
            dispatch(setLoading(false));
            dispatch(setIsSearching(false));
            Alert.alert('Search Stopped', 'No player found within 5 minutes.');
            return 300; // Reset countdown to 5 minutes
          }
          return prevCountdown - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [loading, dispatch]);

  const searchMatch = () => {
    if (city === 'choose' || time === 'choose' || game === 'choose') {
      Alert.alert('Error', 'Please choose a city, time, and game type before searching.');
      return;
    }

    const startNewSearch = () => {
      dispatch(setLoading(true));
      dispatch(setIsSearching(true));
      setCountdown(300); // Reset countdown when search starts
      startSearch({ city, time, game, userId });
    };

    if (currentMatch) {
      Alert.alert(
        'Active Match',
        'You are currently matched with someone. Are you sure you want to search for a new match?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            onPress: () => {
              leaveMatch(currentMatch.matchId, userId);
              dispatch(setCurrentMatch(null));
              startNewSearch();
            },
          },
        ]
      );
    } else {
      startNewSearch();
    }
  };

  const cancelSearch = () => {
    if (loading) {
      dispatch(setLoading(false));
      dispatch(setIsSearching(false));
      setCountdown(300);
      Alert.alert('Search Canceled', 'You have canceled the search.');
      console.log('Search canceled');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.userId}>User ID: {userId}</Text>

      {currentMatch && (
        <TouchableOpacity
          style={styles.matchButton}
          onPress={() => navigation.navigate('Chat', { ...currentMatch, userId })}
        >
          <Text style={styles.matchButtonText}>Go to Match</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.label}>City</Text>
      <Picker
        selectedValue={city}
        onValueChange={(value) => dispatch(setCity(value))}
        style={styles.picker}
        enabled={!isSearching}
      >
        <Picker.Item label="Choose City" value="choose" />
        <Picker.Item label="New York" value="newyork" />
        <Picker.Item label="Los Angeles" value="losangeles" />
        <Picker.Item label="Chicago" value="chicago" />
      </Picker>

      <Text style={styles.label}>Time</Text>
      <Picker
        selectedValue={time}
        onValueChange={(value) => dispatch(setTime(value))}
        style={styles.picker}
        enabled={!isSearching}
      >
        <Picker.Item label="Choose Time" value="choose" />
        <Picker.Item label="Morning" value="morning" />
        <Picker.Item label="Afternoon" value="afternoon" />
      </Picker>

      <Text style={styles.label}>Game Type</Text>
      <Picker
        selectedValue={game}
        onValueChange={(value) => dispatch(setGame(value))}
        style={styles.picker}
        enabled={!isSearching}
      >
        <Picker.Item label="Choose Game Type" value="choose" />
        <Picker.Item label="Game 1" value="game1" />
        <Picker.Item label="Game 2" value="game2" />
      </Picker>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Searching for a player...</Text>
          <Text style={styles.loadingText}>
            Time left: {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
          </Text>
          <Button title="Cancel" onPress={cancelSearch} />
        </View>
      ) : (
        <View style={styles.buttonContainer}>
          <Button title="Search" onPress={searchMatch} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  userId: {
    color: 'black',
    fontSize: 16,
    marginBottom: 16,
  },
  matchButton: {
    padding: 10,
    backgroundColor: 'blue',
    marginBottom: 16,
    alignItems: 'center',
  },
  matchButtonText: {
    color: 'white',
  },
  label: {
    color: 'black',
    fontSize: 18,
    marginVertical: 8,
  },
  picker: {
    color: 'black',
    height: 50,
    width: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    color: 'black',
    marginTop: 8,
  },
  buttonContainer: {
    marginTop: 16,
  },
});

export default HomeScreen;
