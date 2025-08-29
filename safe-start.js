/**
 * Safe start script that handles any API response structure
 * This version will not crash regardless of API response format
 */

require('dotenv').config();
const FyersService = require('./src/services/fyersService');
const OrderService = require('./src/services/orderService');
const logger = require('./src/utils/logger');

// Helper function to safely extract data from any object
function safeExtract(obj, possibleKeys, defaultValue = 'N/A') {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }
  
  for (const key of possibleKeys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  
  return defaultValue;
}

// Helper function to safely get nested data
function safeGet(obj, path, defaultValue = null) {
  try {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  } catch (error) {
    return defaultValue;
  }
}

async function safeStart() {
  logger.info('🚀 Starting FYERS Trading System (Safe Mode)');
  
  try {
    // Initialize services
    const fyersService = new FyersService();
    const orderService = new OrderService();
    
    logger.info('🔌 Testing API connection...');
    
    // Test profile (critical)
    try {
      const profile = await fyersService.getProfile();
      logger.info('✅ Profile API: Success');
      logger.debug('Profile response:', JSON.stringify(profile, null, 2));
      
      const profileData = safeGet(profile, 'data', {});
      const userName = safeExtract(profileData, ['name', 'display_name', 'user_name'], 'Unknown User');
      const userEmail = safeExtract(profileData, ['email', 'email_id', 'user_email'], 'No email');
      
      logger.info(`👤 User: ${userName} (${userEmail})`);
      
    } catch (profileError) {
      logger.error('❌ Profile API: Failed');
      logger.error(`Error: ${profileError.message}`);
      throw new Error('Critical: Cannot connect to FYERS API');
    }
    
    // Test funds (non-critical)
    try {
      const funds = await fyersService.getFunds();
      logger.info('✅ Funds API: Success');
      logger.debug('Funds response:', JSON.stringify(funds, null, 2));
      
      const fundsData = safeGet(funds, 'data', {});
      const availableFunds = safeExtract(fundsData, [
        'fund_limit',
        'availablecash', 
        'available_cash',
        'total_balance',
        'availableBalance',
        'available_balance',
        'cash_available',
        'cashAvailable',
        'balance',
        'cash'
      ], 'N/A');
      
      logger.info(`💰 Available funds: ₹${availableFunds}`);
      
      // Show all available fields for debugging
      if (fundsData && typeof fundsData === 'object') {
        logger.debug('Available fund fields:', Object.keys(fundsData));
      }
      
    } catch (fundsError) {
      logger.warn('⚠️ Funds API: Failed (non-critical)');
      logger.warn(`Error: ${fundsError.message}`);
    }
    
    // Test positions (non-critical)
    try {
      const positions = await orderService.getPositions();
      logger.info('✅ Positions API: Success');
      logger.debug('Positions response:', JSON.stringify(positions, null, 2));
      
      const positionsData = safeGet(positions, 'data', {});
      const netPositions = safeExtract(positionsData, [
        'netPositions',
        'positions',
        'net_positions',
        'position_list'
      ], []);
      
      const positionCount = Array.isArray(netPositions) ? netPositions.length : 0;
      logger.info(`📊 Current positions: ${positionCount}`);
      
    } catch (positionsError) {
      logger.warn('⚠️ Positions API: Failed (non-critical)');
      logger.warn(`Error: ${positionsError.message}`);
    }
    
    // Test orders (non-critical)
    try {
      const orders = await orderService.getOrders();
      logger.info('✅ Orders API: Success');
      logger.debug('Orders response:', JSON.stringify(orders, null, 2));
      
      const ordersData = safeGet(orders, 'data', {});
      const orderBook = safeExtract(ordersData, [
        'orderBook',
        'orders',
        'order_book',
        'order_list'
      ], []);
      
      const orderCount = Array.isArray(orderBook) ? orderBook.length : 0;
      logger.info(`📋 Current orders: ${orderCount}`);
      
    } catch (ordersError) {
      logger.warn('⚠️ Orders API: Failed (non-critical)');
      logger.warn(`Error: ${ordersError.message}`);
    }
    
    // Test quotes (non-critical)
    try {
      const quotes = await fyersService.getQuotes(['NSE:SBIN-EQ']);
      logger.info('✅ Quotes API: Success');
      logger.debug('Quotes response:', JSON.stringify(quotes, null, 2));
      
      const quotesData = safeGet(quotes, 'data', {});
      if (quotesData && Object.keys(quotesData).length > 0) {
        logger.info('📈 Market data is accessible');
      }
      
    } catch (quotesError) {
      logger.warn('⚠️ Quotes API: Failed (non-critical)');
      logger.warn(`Error: ${quotesError.message}`);
    }
    
    logger.info('🎉 Safe start completed successfully!');
    logger.info('');
    logger.info('✅ Core FYERS API connection is working');
    logger.info('📋 Next steps:');
    logger.info('   1. Run full application: npm start');
    logger.info('   2. Run quick start example: node examples/quickstart.js');
    logger.info('   3. Check debug output above for API response structures');
    logger.info('');
    logger.info('💡 If you see any "Failed" APIs above, check the debug output');
    logger.info('   to understand the actual response structure.');
    
  } catch (error) {
    logger.error('❌ Safe start failed');
    logger.error(`Error: ${error.message}`);
    
    if (error.message.includes('Cannot connect to FYERS API')) {
      logger.error('');
      logger.error('🔧 Troubleshooting steps:');
      logger.error('   1. Check your .env file has correct FYERS_ACCESS_TOKEN');
      logger.error('   2. Verify token format: APP_ID:ACCESS_TOKEN');
      logger.error('   3. Generate new token: node examples/auth-setup.js');
      logger.error('   4. Test connection: node examples/auth-setup.js test');
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  safeStart();
}

module.exports = safeStart;
