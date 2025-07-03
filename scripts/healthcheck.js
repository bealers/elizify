#!/usr/bin/env node

/**
 * ElizaOS Simple Health Check
 * Tests basic connectivity and service availability
 */

const http = require('http');
const net = require('net');

const API_PORT = process.env.API_PORT || 3000;
const HOST = process.env.HOST || 'localhost';

/**
 * Check if port is listening
 */
function checkPort() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 3000);
    
    socket.setTimeout(3000);
    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
    
    socket.on('timeout', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });
    
    socket.connect(API_PORT, HOST);
  });
}

/**
 * Check if HTTP server responds
 */
function checkHTTP() {
  return new Promise((resolve) => {
    const options = {
      hostname: HOST,
      port: API_PORT,
      path: '/',
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'ElizaOS-HealthCheck/1.0',
        'Accept': '*/*'
      }
    };

    const req = http.request(options, (res) => {
      // Any HTTP response means the server is running
      resolve(res.statusCode < 500);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Main health check
 */
async function healthCheck() {
  console.log(`ElizaOS Health Check - ${new Date().toISOString()}`);
  console.log(`Checking ${HOST}:${API_PORT}...`);
  
  // Check if port is listening
  const portOpen = await checkPort();
  if (!portOpen) {
    console.log('FAIL: Port not listening');
    return false;
  }
  console.log('PASS: Port is listening');
  
  // Check if HTTP server responds
  const httpWorking = await checkHTTP();
  if (!httpWorking) {
    console.log('FAIL: HTTP server not responding properly');
    return false;
  }
  console.log('PASS: HTTP server responding');
  
  console.log('HEALTHY: ElizaOS is running');
  return true;
}

// Run health check
if (require.main === module) {
  healthCheck()
    .then(healthy => {
      process.exit(healthy ? 0 : 1);
    })
    .catch(error => {
      console.error('Health check error:', error.message);
      process.exit(1);
    });
}

module.exports = { healthCheck }; 