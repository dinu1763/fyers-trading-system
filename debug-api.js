/**
 * Debug script to check FYERS API response structures
 */

require('dotenv').config();
const FyersService = require('./src/services/fyersService');
const OrderService = require('./src/services/orderService');

async function debugAPI() {
  console.log('🔍 Debugging FYERS API Response Structures\n');
  
  try {
    const fyersService = new FyersService();
    const orderService = new OrderService();
    
    // Test Profile
    console.log('1. Testing Profile API...');
    try {
      const profile = await fyersService.getProfile();
      console.log('✅ Profile Success');
      console.log('Profile Response:', JSON.stringify(profile, null, 2));
      console.log('---\n');
    } catch (error) {
      console.log('❌ Profile Error:', error.message);
      console.log('---\n');
    }
    
    // Test Funds
    console.log('2. Testing Funds API...');
    try {
      const funds = await fyersService.getFunds();
      console.log('✅ Funds Success');
      console.log('Funds Response:', JSON.stringify(funds, null, 2));
      console.log('---\n');
    } catch (error) {
      console.log('❌ Funds Error:', error.message);
      console.log('---\n');
    }
    
    // Test Positions
    console.log('3. Testing Positions API...');
    try {
      const positions = await orderService.getPositions();
      console.log('✅ Positions Success');
      console.log('Positions Response:', JSON.stringify(positions, null, 2));
      console.log('---\n');
    } catch (error) {
      console.log('❌ Positions Error:', error.message);
      console.log('---\n');
    }
    
    // Test Orders
    console.log('4. Testing Orders API...');
    try {
      const orders = await orderService.getOrders();
      console.log('✅ Orders Success');
      console.log('Orders Response:', JSON.stringify(orders, null, 2));
      console.log('---\n');
    } catch (error) {
      console.log('❌ Orders Error:', error.message);
      console.log('---\n');
    }
    
    // Test Quotes
    console.log('5. Testing Quotes API...');
    try {
      const quotes = await fyersService.getQuotes(['NSE:SBIN-EQ']);
      console.log('✅ Quotes Success');
      console.log('Quotes Response:', JSON.stringify(quotes, null, 2));
      console.log('---\n');
    } catch (error) {
      console.log('❌ Quotes Error:', error.message);
      console.log('---\n');
    }

    // Test Available Methods
    console.log('6. Checking Available Fyers Methods...');
    try {
      console.log('Available methods on fyersService.fyers:');
      const methods = Object.getOwnPropertyNames(fyersService.fyers).filter(name => typeof fyersService.fyers[name] === 'function');
      console.log('Methods:', methods);
      console.log('---\n');
    } catch (error) {
      console.log('❌ Methods Check Error:', error.message);
      console.log('---\n');
    }
    
  } catch (error) {
    console.log('❌ General Error:', error.message);
  }
}

if (require.main === module) {
  debugAPI();
}

module.exports = debugAPI;
