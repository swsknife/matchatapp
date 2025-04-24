import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
  Dimensions,
  NativeModules,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { REACT_APP_SERVER_URL } from '@env';
import NetInfo from '@react-native-community/netinfo';
import { useSelector } from 'react-redux';
import apiLogger from '../utils/apiLogger';

/**
 * Custom Debug Screen for the app
 * This screen provides debugging tools and information about the app
 */
const DebugScreen = ({ navigation }) => {
  const [hermesEnabled, setHermesEnabled] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({});
  const [networkInfo, setNetworkInfo] = useState({ status: 'Unknown' });
  const [logs, setLogs] = useState([]);
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [useCustomEndpoint, setUseCustomEndpoint] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    jsThreadFPS: 0,
    uiThreadFPS: 0,
    memoryUsage: 0,
  });
  const [serverStatus, setServerStatus] = useState(null);
  const [isLoadingServerStatus, setIsLoadingServerStatus] = useState(false);
  const [socketPingResult, setSocketPingResult] = useState(null);
  const [showApiLogModal, setShowApiLogModal] = useState(false);
  const [selectedApiLog, setSelectedApiLog] = useState(null);
  const [apiLogs, setApiLogs] = useState([]);
  
  // Initialize API logging
  useEffect(() => {
    apiLogger.initApiLogging();
    return () => apiLogger.restoreFetch();
  }, []);
  
  // Refresh API logs periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setApiLogs(apiLogger.getLogs());
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Check if Hermes is enabled
  useEffect(() => {
    const isHermesEnabled = () => !!global.HermesInternal;
    setHermesEnabled(isHermesEnabled());
  }, []);

  // Get device information
  useEffect(() => {
    const getDeviceInfo = () => {
      return {
        platform: Platform.OS,
        version: Platform.Version,
        isEmulator: Platform.constants?.isEmulator || false,
        dimensions: {
          width: Dimensions.get('window').width,
          height: Dimensions.get('window').height,
        },
        brand: Platform.OS === 'android' ? NativeModules?.PlatformConstants?.Brand : 'Apple',
        model: Platform.OS === 'android' ? NativeModules?.PlatformConstants?.Model : 'iOS Device',
      };
    };
    setDeviceInfo(getDeviceInfo());
  }, []);

  // Check network and server status
  const checkNetwork = async () => {
    try {
      // Check server connection
      const response = await fetch(`${REACT_APP_SERVER_URL}/ping`);
      const status = response.status === 200 ? 'Connected' : 'Limited';
      
      setNetworkInfo({
        status: status,
        type: 'wifi',
        timestamp: new Date().toISOString(),
        serverResponse: response.status
      });
      
      addLog(`Network check: ${status} (Server response: ${response.status})`);
    } catch (error) {
      setNetworkInfo({
        status: 'Disconnected',
        type: 'unknown',
        timestamp: new Date().toISOString(),
        error: error.message
      });
      
      addLog(`Network check failed: ${error.message}`);
    }
  };
  
  // Fetch server status from debug endpoint
  const fetchServerStatus = async () => {
    try {
      setIsLoadingServerStatus(true);
      addLog('Fetching server status...');
      
      const response = await fetch(`${REACT_APP_SERVER_URL}/debug/status`);
      const data = await response.json();
      
      setServerStatus(data);
      addLog('Server status fetched successfully');
    } catch (error) {
      addLog(`Failed to fetch server status: ${error.message}`);
      setServerStatus({ error: error.message });
    } finally {
      setIsLoadingServerStatus(false);
    }
  };
  
  // Perform socket ping test
  const performSocketPing = () => {
    try {
      addLog('Performing socket ping test...');
      
      // Import socket utilities
      const { getSocketInstance } = require('../utils/network');
      const socket = getSocketInstance();
      
      if (!socket) {
        addLog('Socket not initialized');
        setSocketPingResult({ error: 'Socket not initialized' });
        return;
      }
      
      const startTime = Date.now();
      
      socket.emit('ping', { clientTime: startTime }, (response) => {
        const endTime = Date.now();
        const pingTime = endTime - startTime;
        
        setSocketPingResult({
          pingTime,
          serverTime: response.serverTime,
          success: response.success,
          timestamp: new Date().toISOString()
        });
        
        addLog(`Socket ping: ${pingTime}ms`);
      });
    } catch (error) {
      addLog(`Socket ping failed: ${error.message}`);
      setSocketPingResult({ error: error.message });
    }
  };

  // Add a log entry
  const addLog = (message) => {
    const timestamp = new Date().toISOString();
    setLogs((prevLogs) => [{ timestamp, message }, ...prevLogs.slice(0, 19)]);
  };

  // Simulate performance metrics
  const updatePerformanceMetrics = () => {
    setPerformanceMetrics({
      jsThreadFPS: Math.floor(Math.random() * 60),
      uiThreadFPS: Math.floor(Math.random() * 60),
      memoryUsage: Math.floor(Math.random() * 500),
    });
    addLog('Updated performance metrics');
  };

  // Clear all logs
  const clearLogs = () => {
    setLogs([]);
    addLog('Logs cleared');
  };

  // Toggle custom endpoint
  const toggleCustomEndpoint = (value) => {
    setUseCustomEndpoint(value);
    addLog(`Custom endpoint ${value ? 'enabled' : 'disabled'}: ${customEndpoint}`);
  };

  // Render a section with a title
  const renderSection = (title, content) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {content}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Debug Console</Text>
        
        {/* JavaScript Engine Info */}
        {renderSection('JavaScript Engine', (
          <View>
            <Text style={styles.infoText}>
              Engine: {hermesEnabled ? 'Hermes' : 'JSC'}
            </Text>
            <Text style={styles.infoText}>
              Status: {hermesEnabled ? 'Optimized for React Native' : 'Standard JavaScript Engine'}
            </Text>
          </View>
        ))}
        
        {/* Device Info */}
        {renderSection('Device Information', (
          <View>
            <Text style={styles.infoText}>Platform: {deviceInfo.platform}</Text>
            <Text style={styles.infoText}>Version: {deviceInfo.version}</Text>
            <Text style={styles.infoText}>
              Dimensions: {deviceInfo.dimensions?.width} x {deviceInfo.dimensions?.height}
            </Text>
            <Text style={styles.infoText}>
              Device: {deviceInfo.brand} {deviceInfo.model}
            </Text>
            <Text style={styles.infoText}>
              Emulator: {deviceInfo.isEmulator ? 'Yes' : 'No'}
            </Text>
          </View>
        ))}
        
        {/* Network Info */}
        {renderSection('Network', (
          <View>
            <Text style={styles.infoText}>Status: {networkInfo.status}</Text>
            <Text style={styles.infoText}>Type: {networkInfo.type || 'Unknown'}</Text>
            <Text style={styles.infoText}>Last Check: {networkInfo.timestamp || 'Never'}</Text>
            <TouchableOpacity style={styles.button} onPress={checkNetwork}>
              <Text style={styles.buttonText}>Check Network</Text>
            </TouchableOpacity>
          </View>
        ))}
        
        {/* Performance Metrics */}
        {renderSection('Performance Metrics', (
          <View>
            <Text style={styles.infoText}>JS Thread FPS: {performanceMetrics.jsThreadFPS}</Text>
            <Text style={styles.infoText}>UI Thread FPS: {performanceMetrics.uiThreadFPS}</Text>
            <Text style={styles.infoText}>Memory Usage: {performanceMetrics.memoryUsage} MB</Text>
            <TouchableOpacity style={styles.button} onPress={updatePerformanceMetrics}>
              <Text style={styles.buttonText}>Update Metrics</Text>
            </TouchableOpacity>
          </View>
        ))}
        
        {/* Server Status */}
        {renderSection('Server Status', (
          <View>
            {isLoadingServerStatus ? (
              <ActivityIndicator size="small" color="#2196F3" />
            ) : serverStatus ? (
              <View>
                {serverStatus.error ? (
                  <Text style={styles.errorText}>Error: {serverStatus.error}</Text>
                ) : (
                  <>
                    <Text style={styles.infoText}>Server Uptime: {serverStatus.server?.uptime.toFixed(2)} seconds</Text>
                    <Text style={styles.infoText}>Node Version: {serverStatus.server?.nodeVersion}</Text>
                    <Text style={styles.infoText}>Connected Sockets: {serverStatus.sockets?.connected}</Text>
                    <Text style={styles.infoText}>Active Matches: {serverStatus.state?.activeMatches}</Text>
                    <Text style={styles.infoText}>Waiting Rooms: {serverStatus.state?.waitingRooms}</Text>
                    <Text style={styles.infoText}>Memory Usage: {
                      serverStatus.server?.memoryUsage?.heapUsed 
                        ? (serverStatus.server.memoryUsage.heapUsed / (1024 * 1024)).toFixed(2) + ' MB' 
                        : 'Unknown'
                    }</Text>
                  </>
                )}
              </View>
            ) : (
              <Text style={styles.infoText}>Click the button to fetch server status</Text>
            )}
            
            <TouchableOpacity style={styles.button} onPress={fetchServerStatus}>
              <Text style={styles.buttonText}>Fetch Server Status</Text>
            </TouchableOpacity>
            
            <View style={styles.separator} />
            
            <Text style={styles.subSectionTitle}>Socket Ping Test</Text>
            {socketPingResult ? (
              <View>
                {socketPingResult.error ? (
                  <Text style={styles.errorText}>Error: {socketPingResult.error}</Text>
                ) : (
                  <>
                    <Text style={styles.infoText}>Ping Time: {socketPingResult.pingTime} ms</Text>
                    <Text style={styles.infoText}>Server Time: {socketPingResult.serverTime}</Text>
                    <Text style={styles.infoText}>Status: {socketPingResult.success ? 'Success' : 'Failed'}</Text>
                  </>
                )}
              </View>
            ) : (
              <Text style={styles.infoText}>Click the button to test socket connection</Text>
            )}
            
            <TouchableOpacity style={styles.button} onPress={performSocketPing}>
              <Text style={styles.buttonText}>Test Socket Connection</Text>
            </TouchableOpacity>
          </View>
        ))}
        
        {/* Custom Endpoint Configuration */}
        {renderSection('API Configuration', (
          <View>
            <View style={styles.row}>
              <Text style={styles.label}>Use Custom Endpoint:</Text>
              <Switch
                value={useCustomEndpoint}
                onValueChange={toggleCustomEndpoint}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Enter custom API endpoint"
              value={customEndpoint}
              onChangeText={setCustomEndpoint}
              editable={useCustomEndpoint}
            />
          </View>
        ))}
        
        {/* API Logs */}
        {renderSection('API Logs', (
          <View>
            <View style={styles.logHeader}>
              <Text style={styles.logHeaderText}>Network Requests</Text>
              <TouchableOpacity onPress={() => apiLogger.clearLogs()}>
                <Text style={styles.clearButton}>Clear</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.logContainer}>
              {apiLogs.length === 0 ? (
                <Text style={styles.emptyLogText}>No API logs yet</Text>
              ) : (
                apiLogs.map((log, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={[
                      styles.logEntry, 
                      { backgroundColor: log.error ? '#FFEBEE' : log.status >= 400 ? '#FFF8E1' : '#F1F8E9' }
                    ]}
                    onPress={() => {
                      setSelectedApiLog(log);
                      setShowApiLogModal(true);
                    }}
                  >
                    <Text style={styles.logTimestamp}>
                      {new Date(log.startTime).toLocaleTimeString()}
                    </Text>
                    <Text style={styles.logMethod}>{log.method}</Text>
                    <Text style={styles.logUrl} numberOfLines={1} ellipsizeMode="tail">
                      {log.url.replace(REACT_APP_SERVER_URL, '')}
                    </Text>
                    <Text style={[
                      styles.logStatus, 
                      { color: log.error ? '#D32F2F' : log.status >= 400 ? '#FF8F00' : '#388E3C' }
                    ]}>
                      {log.error ? 'ERR' : log.status || (log.pending ? '...' : 'OK')}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => {
                setApiLogs(apiLogger.getLogs());
                addLog('Refreshed API logs');
              }}
            >
              <Text style={styles.buttonText}>Refresh API Logs</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Debug Logs */}
        {renderSection('Debug Logs', (
          <View>
            <View style={styles.logHeader}>
              <Text style={styles.logHeaderText}>Recent Activity</Text>
              <TouchableOpacity onPress={clearLogs}>
                <Text style={styles.clearButton}>Clear</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.logContainer}>
              {logs.length === 0 ? (
                <Text style={styles.emptyLogText}>No logs yet</Text>
              ) : (
                logs.map((log, index) => (
                  <View key={index} style={styles.logEntry}>
                    <Text style={styles.logTimestamp}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                    <Text style={styles.logMessage}>{log.message}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        ))}
        
        {/* Navigation Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.buttonWide]}
            onPress={() => {
              addLog('Navigated to Home Screen');
              navigation.navigate('Home');
            }}
          >
            <Text style={styles.buttonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* API Logs Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showApiLogModal}
        onRequestClose={() => {
          setShowApiLogModal(false);
          setSelectedApiLog(null);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedApiLog ? `Request Details` : 'API Logs'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowApiLogModal(false);
                  setSelectedApiLog(null);
                }}
              >
                <Text style={styles.modalCloseButton}>Close</Text>
              </TouchableOpacity>
            </View>
            
            {selectedApiLog && (
              <ScrollView style={styles.modalScrollView}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>Request</Text>
                  <Text style={styles.detailItem}>URL: {selectedApiLog.url}</Text>
                  <Text style={styles.detailItem}>Method: {selectedApiLog.method}</Text>
                  <Text style={styles.detailItem}>
                    Time: {new Date(selectedApiLog.startTime).toLocaleTimeString()}
                  </Text>
                  
                  <Text style={styles.detailSubtitle}>Headers</Text>
                  {Object.entries(selectedApiLog.requestHeaders || {}).map(([key, value], index) => (
                    <Text key={index} style={styles.detailItem}>
                      {key}: {value}
                    </Text>
                  ))}
                  
                  {selectedApiLog.requestBody && (
                    <>
                      <Text style={styles.detailSubtitle}>Body</Text>
                      <Text style={styles.detailItem}>
                        {typeof selectedApiLog.requestBody === 'string' 
                          ? selectedApiLog.requestBody 
                          : JSON.stringify(selectedApiLog.requestBody, null, 2)}
                      </Text>
                    </>
                  )}
                </View>
                
                {selectedApiLog.status && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailTitle}>Response</Text>
                    <Text style={styles.detailItem}>
                      Status: {selectedApiLog.status} {selectedApiLog.statusText}
                    </Text>
                    <Text style={styles.detailItem}>
                      Duration: {selectedApiLog.duration}ms
                    </Text>
                    
                    {selectedApiLog.responseHeaders && (
                      <>
                        <Text style={styles.detailSubtitle}>Headers</Text>
                        {Object.entries(selectedApiLog.responseHeaders || {}).map(([key, value], index) => (
                          <Text key={index} style={styles.detailItem}>
                            {key}: {value}
                          </Text>
                        ))}
                      </>
                    )}
                    
                    {selectedApiLog.responseBody && (
                      <>
                        <Text style={styles.detailSubtitle}>Body</Text>
                        <Text style={styles.detailItem}>
                          {typeof selectedApiLog.responseBody === 'string' 
                            ? selectedApiLog.responseBody 
                            : JSON.stringify(selectedApiLog.responseBody, null, 2)}
                        </Text>
                      </>
                    )}
                  </View>
                )}
                
                {selectedApiLog.error && (
                  <View style={[styles.detailSection, { backgroundColor: '#FFEBEE' }]}>
                    <Text style={[styles.detailTitle, { color: '#D32F2F' }]}>Error</Text>
                    <Text style={[styles.detailItem, { color: '#D32F2F' }]}>
                      {selectedApiLog.error}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    marginBottom: 8,
    color: '#555',
  },
  errorText: {
    fontSize: 14,
    marginBottom: 8,
    color: '#D32F2F',
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    color: '#555',
  },
  separator: {
    height: 1,
    backgroundColor: '#DDD',
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
    backgroundColor: '#FAFAFA',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  button: {
    backgroundColor: '#2196F3',
    borderRadius: 4,
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonWide: {
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  clearButton: {
    color: '#2196F3',
    fontSize: 14,
  },
  logContainer: {
    backgroundColor: '#FAFAFA',
    borderRadius: 4,
    padding: 8,
    maxHeight: 200,
  },
  emptyLogText: {
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  logEntry: {
    flexDirection: 'row',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    paddingBottom: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  logTimestamp: {
    fontSize: 12,
    color: '#999',
    marginRight: 8,
    width: 60,
  },
  logMessage: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  logMethod: {
    fontSize: 12,
    fontWeight: 'bold',
    width: 50,
    color: '#555',
  },
  logUrl: {
    fontSize: 12,
    flex: 1,
    color: '#333',
    marginRight: 8,
  },
  logStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    width: 40,
    textAlign: 'right',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    color: '#2196F3',
    fontSize: 16,
  },
  modalScrollView: {
    maxHeight: '90%',
  },
  detailSection: {
    backgroundColor: '#FAFAFA',
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  detailSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    color: '#555',
  },
  detailItem: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
  },
});

export default DebugScreen;