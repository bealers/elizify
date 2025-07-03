const io = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected to ElizaOS:', socket.id);
  
  // Try joining a room first
  socket.emit('ROOM_JOINING', {
    roomId: 'default',
    userId: 'test-user'
  });
  
  console.log('Room join attempted');
  
  // Wait a moment then send a message
  setTimeout(() => {
    socket.emit('SEND_MESSAGE', {
      text: 'Hello Server Bod, are you working?',
      userId: 'test-user',
      userName: 'Test User',
      roomId: 'default'
    });
    
    console.log('Test message sent via SEND_MESSAGE');
  }, 1000);
});

socket.on('MESSAGE', (data) => {
  console.log('Received MESSAGE:', data);
  process.exit(0);
});

socket.on('ROOM_JOINED', (data) => {
  console.log('Room joined:', data);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Timeout after 15 seconds
setTimeout(() => {
  console.log('Test timed out - no response received');
  process.exit(1);
}, 15000); 