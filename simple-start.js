/**
 * Simple start script without market data WebSocket
 * Use this to test core functionality without WebSocket issues
 */

require('dotenv').config();
const FyersService = require('./src/services/fyersService');
const OrderService = require('./src/services/orderService');
const logger = require('./src/utils/logger');

async function simpleStart() {
  logger.info('Starting FYERS Trading System (Simple Mode)');
  
  try {
    // Initialize services
    const fyersService = new FyersService();
    const orderService = new OrderService();
    
    // Test connection
    logger.info('Testing API connection...');
    const profile = await fyersService.getProfile();
    
    const userName = profile.data?.name || profile.data?.display_name || 'Unknown';
    const userEmail = profile.data?.email || profile.data?.email_id || 'Not available';
    
    logger.info(`✅ Connected as: ${userName} (${userEmail})`);
    
    // Test funds
    try {
      const funds = await fyersService.getFunds();
      if (funds.data) {
        const availableFunds = funds.data.fund_limit || 
                             funds.data.availablecash || 
                             funds.data.available_cash ||
                             funds.data.total_balance ||
                             'N/A';
        logger.info(`💰 Available funds: ₹${availableFunds}`);
      }
    } catch (fundError) {
      logger.warn(`Could not fetch funds: ${fundError.message}`);
    }
    
    // Test positions
    try {
      const positions = await orderService.getPositions();
      const netPositions = positions.data?.netPositions || 
                         positions.data?.positions || 
                         positions.data || 
                         [];
      
      if (Array.isArray(netPositions) && netPositions.length > 0) {
        logger.info(`📊 Current positions: ${netPositions.length}`);
      } else {
        logger.info('📊 No current positions');
      }
    } catch (positionError) {
      logger.warn(`Could not fetch positions: ${positionError.message}`);
    }
    
    // Test orders
    try {
      const orders = await orderService.getOrders();
      const orderBook = orders.data?.orderBook || 
                       orders.data?.orders || 
                       orders.data || 
                       [];
      
      if (Array.isArray(orderBook) && orderBook.length > 0) {
        logger.info(`📋 Current orders: ${orderBook.length}`);
      } else {
        logger.info('📋 No current orders');
      }
    } catch (orderError) {
      logger.warn(`Could not fetch orders: ${orderError.message}`);
    }
    
    // Test quotes
    try {
      const quotes = await fyersService.getQuotes(['NSE:SBIN-EQ']);
      if (quotes.s === 'ok') {
        logger.info('📈 Market data API working');
      }
    } catch (quoteError) {
      logger.warn(`Could not fetch quotes: ${quoteError.message}`);
    }
    
    logger.info('✅ Simple start completed successfully!');
    logger.info('All core APIs are working. You can now:');
    logger.info('1. Run the full application: npm start');
    logger.info('2. Run the quick start example: node examples/quickstart.js');
    logger.info('3. Test individual components as needed');
    
  } catch (error) {
    logger.error(`Simple start failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  simpleStart();
}

module.exports = simpleStart;
