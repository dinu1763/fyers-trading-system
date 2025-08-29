/**
 * Quick Start Example for FYERS Trading System
 * This example demonstrates basic usage of the trading system
 */

require('dotenv').config();
const TradingApp = require('../src/app');
const SampleStrategy = require('../src/strategies/sampleStrategy');
const logger = require('../src/utils/logger');

async function quickStartExample() {
  logger.info('Starting FYERS Trading System Quick Start Example');
  
  try {
    // Initialize the trading application
    const app = new TradingApp();
    await app.initialize();
    
    if (!app.isRunning) {
      logger.error('Failed to initialize trading app. Please check your configuration.');
      return;
    }
    
    // Get account summary
    const accountSummary = await app.getAccountSummary();
    logger.info(`Account Summary:`);
    logger.info(`- Name: ${accountSummary.profile.name}`);
    logger.info(`- Available Funds: ₹${accountSummary.funds.fund_limit}`);
    logger.info(`- Current Positions: ${accountSummary.positions.netPositions?.length || 0}`);
    
    // Initialize and start a sample strategy
    const strategy = new SampleStrategy({
      shortPeriod: 5,
      longPeriod: 20,
      symbols: ['NSE:SBIN-EQ', 'NSE:TCS-EQ'],
      maxPositionSize: 50000,
      riskPercentage: 1,
      stopLossPercentage: 3
    });
    
    // Set up strategy event handlers
    strategy.on('signal', async (signal) => {
      logger.info(`Trading Signal Received: ${JSON.stringify(signal)}`);
      
      // In a real implementation, you would execute the trade here
      // For this example, we'll just log the signal
      
      if (signal.type === 'BUY') {
        logger.info(`Would place BUY order: ${signal.quantity} shares of ${signal.symbol} at ₹${signal.price}`);
        // await app.orderService.placeOrder({
        //   symbol: signal.symbol,
        //   quantity: signal.quantity,
        //   side: 1,
        //   type: 2, // Market order
        //   productType: 'INTRADAY'
        // });
      } else if (signal.type === 'SELL') {
        logger.info(`Would place SELL order: ${signal.quantity} shares of ${signal.symbol} at ₹${signal.price}`);
        // await app.orderService.placeOrder({
        //   symbol: signal.symbol,
        //   quantity: signal.quantity,
        //   side: -1,
        //   type: 2, // Market order
        //   productType: 'INTRADAY'
        // });
      }
    });
    
    // Start the strategy
    strategy.start();
    
    // Start market data feed
    await app.startMarketDataFeed();
    
    // Connect strategy to market data
    app.marketDataService.on('tick', (data) => {
      strategy.onTick(data);
    });
    
    // Subscribe to strategy symbols
    app.marketDataService.subscribe(strategy.config.symbols);
    
    logger.info('Quick start example is running. Market data will be processed by the strategy.');
    logger.info('Press Ctrl+C to stop the application.');
    
    // Keep the application running
    process.on('SIGINT', async () => {
      logger.info('Shutting down quick start example...');
      strategy.stop();
      await app.shutdown();
      process.exit(0);
    });
    
    // Display strategy stats every 30 seconds
    setInterval(() => {
      const stats = strategy.getStrategyStats();
      logger.info(`Strategy Stats: Active=${stats.isActive}, Positions=${stats.positionsCount}`);
    }, 30000);
    
  } catch (error) {
    logger.error(`Quick start example error: ${error.message}`);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  quickStartExample();
}

module.exports = quickStartExample;
