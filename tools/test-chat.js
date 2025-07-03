const io = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected to ElizaOS:', socket.id);
  
  // Send a test message
  socket.emit('message', {
    text: 'Hello, are you working?',
    userId: 'test-user',
    userName: 'Test User'
  });
  
  console.log('Test message sent');
});

socket.on('message', (data) => {
  console.log('Received message:', data);
  process.exit(0);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('Test timed out - no response received');
  process.exit(1);
}, 10000); 