/**
 * SessionInfoModal.js
 * 
 * This component displays information about session management rules
 * to help users understand when they might be automatically logged out.
 */

import React from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView 
} from 'react-native';
import { getSessionTimeouts } from '../utils/sessionManager';

const SessionInfoModal = ({ visible, onClose }) => {
  // Add useState to handle potential errors
  const [timeouts, setTimeouts] = React.useState({
    inactivityTimeout: 'a few hours',
    backgroundSearchTimeout: 'a few minutes'
  });
  
  // Use useEffect to safely get timeouts
  React.useEffect(() => {
    try {
      const sessionTimeouts = getSessionTimeouts();
      setTimeouts(sessionTimeouts);
    } catch (error) {
      console.error('Error getting session timeouts:', error);
      // Default values are already set in useState
    }
  }, []);
  
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Session Information</Text>
          
          <ScrollView style={styles.scrollView}>
            <Text style={styles.sectionTitle}>Automatic Session Management</Text>
            <Text style={styles.paragraph}>
              This app uses automatic session management to provide a seamless experience.
              Here's when your session might be automatically ended:
            </Text>
            
            <View style={styles.ruleContainer}>
              <Text style={styles.ruleTitle}>• Inactivity Timeout</Text>
              <Text style={styles.ruleDescription}>
                If you don't use the app for {timeouts.inactivityTimeout}, your session will end automatically. This applies to all activities including searches and matches.
              </Text>
            </View>
            
            <View style={styles.ruleContainer}>
              <Text style={styles.ruleTitle}>• App in Background</Text>
              <Text style={styles.ruleDescription}>
                If the app is in the background for {timeouts.backgroundSearchTimeout}, the connection to the server will be temporarily disconnected to save resources. Your search will continue when you return to the app.
              </Text>
            </View>
            
            <Text style={styles.paragraph}>
              These rules help ensure the app runs efficiently and matches are made between currently active users.
            </Text>
            
            <Text style={styles.sectionTitle}>Privacy Note</Text>
            <Text style={styles.paragraph}>
              When your session ends, your temporary user ID is discarded. A new ID will be generated the next time you use the app.
            </Text>
          </ScrollView>
          
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '85%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  scrollView: {
    width: '100%',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 16,
    marginBottom: 15,
    lineHeight: 22,
  },
  ruleContainer: {
    marginBottom: 15,
    paddingLeft: 10,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  ruleDescription: {
    fontSize: 15,
    lineHeight: 20,
    paddingLeft: 15,
  },
  closeButton: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    width: '50%',
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default SessionInfoModal;