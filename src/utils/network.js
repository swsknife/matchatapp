import { io } from "socket.io-client";
import store from '../store/store'; // Import the store

let socketInstance = null;

// Function to initialize and get the Socket.io instance
export const initializeSocket = (serverUrl) => {
  return new Promise((resolve, reject) => {
    if (!socketInstance) {
      console.log("Initializing socket...");
      socketInstance = io(serverUrl, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketInstance.on('connect', () => {
        console.log("Socket connected:", socketInstance.id);
        store.dispatch(setConnectionStatus('connected'));
        resolve(socketInstance);
      });

      socketInstance.on('connect_error', (error) => {
        console.error("Connection error:", error);
        reject(error);
      });

      ocketInstance.on('disconnect', () => {
        store.dispatch(setConnectionStatus('disconnected'));
      });

      socketInstance.on('reconnect_attempt', () => {
        store.dispatch(setConnectionStatus('reconnecting'));
      });
    } else {
      resolve(socketInstance);
    }
  });
};

// Function to emit messages
export const sendMessage = (message, matchId, callback) => {
  if (socketInstance) {
    console.log("Sending message:", message);
    socketInstance.emit("sendMessage", { message, matchId }, callback);
  } else {
    const errorMsg = "Socket is not initialized. Call initializeSocket first.";
    console.error(errorMsg);
    if (callback) callback({ error: errorMsg });
  }
};

// Function to join a match
export const joinMatch = (matchId, userId, callback) => {
  if (socketInstance) {
    console.log(`Joining match: ${matchId} for user: ${userId}`);
    socketInstance.emit("joinMatch", { matchId, userId }, callback);
  } else {
    const errorMsg = "Socket is not initialized. Call initializeSocket first.";
    console.error(errorMsg);
    if (callback) callback({ error: errorMsg });
  }
};

// Listener for receiving messages
export const onReceiveMessage = (callback) => {
  if (socketInstance) {
    const handler = (message) => {
      console.log("Message received:", message);
      callback(message);
    };
    socketInstance.on("receiveMessage", handler);
    return () => socketInstance.off("receiveMessage", handler);
  } else {
    console.error("Socket is not initialized. Call initializeSocket first.");
    return () => {};
  }
};

// Listener for opponent leaving the match
export const onOpponentLeftMatch = (callback) => {
  if (socketInstance) {
    const handler = () => {
      console.log("Opponent left the match.");
      callback();
    };
    socketInstance.on("opponentLeftMatch", handler);
    return () => socketInstance.off("opponentLeftMatch", handler);
  } else {
    console.error("Socket is not initialized. Call initializeSocket first.");
    return () => {};
  }
};

// Listener for connection error
export const onConnectionError = (callback) => {
  if (socketInstance) {
    const handler = (error) => {
      console.error("Connection error:", error);
      callback(error);
    };
    socketInstance.on("connect_error", handler);
    return () => socketInstance.off("connect_error", handler);
  } else {
    console.error("Socket is not initialized. Call initializeSocket first.");
    return () => {};
  }
};

// Listener for match found
export const onMatchFound = (callback) => {
  if (socketInstance) {
    const handler = (match) => {
      console.log("Match found:", match);
      callback(match);
    };
    socketInstance.on("matchFound", handler);
    return () => socketInstance.off("matchFound", handler);
  } else {
    console.error("Socket is not initialized. Call initializeSocket first.");
    return () => {};
  }
};

// Listener for disconnect event
export const onDisconnect = (callback) => {
  if (socketInstance) {
    const handler = () => {
      console.log("Socket disconnected.");
      callback();
    };
    socketInstance.on("disconnect", handler);
    return () => socketInstance.off("disconnect", handler);
  } else {
    console.error("Socket is not initialized. Call initializeSocket first.");
    return () => {};
  }
};

// Function to leave a match
export const leaveMatch = (matchId, userId, callback) => {
  if (socketInstance) {
    console.log(`Leaving match: ${matchId} for user: ${userId}`);
    socketInstance.emit("leaveMatch", { matchId, userId }, callback);
  } else {
    const errorMsg = "Socket is not initialized. Call initializeSocket first.";
    console.error(errorMsg);
    if (callback) callback({ error: errorMsg });
  }
};

// Function to start searching for a match
export const startSearch = (data, callback) => {
  if (socketInstance) {
    console.log("Starting search with data:", data);
    socketInstance.emit("startSearch", data, callback);
  } else {
    const errorMsg = "Socket is not initialized. Call initializeSocket first.";
    console.error(errorMsg);
    if (callback) callback({ error: errorMsg });
  }
};

// Disconnect socket
export const disconnectSocket = () => {
  if (socketInstance) {
    console.log("Disconnecting socket...");
    socketInstance.disconnect();
    socketInstance = null;
  }
};

// Listener for message delivered
export const onMessageDelivered = (callback) => {
  if (socketInstance) {
    const handler = (messageId) => {
      console.log("Message delivered:", messageId);
      callback(messageId);
    };
    socketInstance.on('messageDelivered', handler);
    return () => socketInstance.off('messageDelivered', handler);
  } else {
    console.error('Socket is not initialized. Call initializeSocket first.');
    return () => {};
  }
};

// Listener for message read
export const onMessageRead = (callback) => {
  if (socketInstance) {
    const handler = (messageId) => {
      console.log("Message read:", messageId);
      callback(messageId);
    };
    socketInstance.on('messageRead', handler);
    return () => socketInstance.off('messageRead', handler);
  } else {
    console.error('Socket is not initialized. Call initializeSocket first.');
    return () => {};
  }
};
