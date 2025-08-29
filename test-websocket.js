/**
 * Test WebSocket connection to see available methods
 */

require('dotenv').config();
const { fyersDataSocket } = require("fyers-api-v3");

async function testWebSocket() {
  console.log('🔍 Testing FYERS WebSocket Connection\n');
  
  try {
    if (!process.env.FYERS_ACCESS_TOKEN) {
      console.log('❌ No access token found in .env file');
      return;
    }
    
    console.log('Creating WebSocket instance...');
    const socket = fyersDataSocket.getInstance(
      process.env.FYERS_ACCESS_TOKEN,
      "./logs",
      true
    );
    
    console.log('✅ WebSocket instance created');
    console.log('Available methods on socket:');
    
    // List all methods available on the socket
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(socket))
      .filter(name => typeof socket[name] === 'function');
    
    methods.forEach(method => {
      console.log(`  - ${method}`);
    });
    
    console.log('\nAvailable properties on socket:');
    const properties = Object.getOwnPropertyNames(socket);
    properties.forEach(prop => {
      if (typeof socket[prop] !== 'function') {
        console.log(`  - ${prop}: ${typeof socket[prop]}`);
      }
    });
    
    // Test connection
    console.log('\n🔌 Testing connection...');
    
    socket.on("connect", () => {
      console.log('✅ WebSocket connected successfully');
      
      // Test subscription
      try {
        socket.subscribe(['NSE:SBIN-EQ']);
        console.log('✅ Subscription successful');
      } catch (subError) {
        console.log('❌ Subscription failed:', subError.message);
      }
      
      // Disconnect after 5 seconds
      setTimeout(() => {
        socket.close();
        console.log('🔌 Connection closed');
        process.exit(0);
      }, 5000);
    });
    
    socket.on("error", (error) => {
      console.log('❌ WebSocket error:', error);
      process.exit(1);
    });
    
    socket.on("message", (message) => {
      console.log('📨 Message received:', JSON.stringify(message, null, 2));
    });
    
    socket.on("close", () => {
      console.log('🔌 WebSocket closed');
    });
    
    // Connect
    socket.connect();
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    console.log('Stack:', error.stack);
  }
}

if (require.main === module) {
  testWebSocket();
}

module.exports = testWebSocket;
