require('dotenv').config();
const FyersService = require('./services/fyersService');
const OrderService = require('./services/orderService');
const MarketDataService = require('./services/marketDataService');
const logger = require('./utils/logger');
const config = require('./config/config');

class TradingApp {
  constructor() {
    this.fyersService = new FyersService();
    this.orderService = new OrderService();
    this.marketDataService = new MarketDataService();
    this.isRunning = false;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Market data event handlers
    this.marketDataService.on('connected', () => {
      logger.info('Market data feed connected');
    });

    this.marketDataService.on('disconnected', () => {
      logger.warn('Market data feed disconnected');
    });

    this.marketDataService.on('error', (error) => {
      logger.error(`Market data error: ${error}`);
    });

    this.marketDataService.on('tick', (data) => {
      this.handleMarketTick(data);
    });

    this.marketDataService.on('significantMove', (data) => {
      this.handleSignificantMove(data);
    });

    this.marketDataService.on('volumeSpike', (data) => {
      this.handleVolumeSpike(data);
    });
  }

  async initialize() {
    try {
      logger.info("Initializing FYERS trading application...");

      // Check if access token is available
      if (!config.fyers.accessToken) {
        logger.warn("No access token found. Please generate one first.");
        await this.generateAccessToken();
        return;
      }

      // Verify connection and get profile
      try {
        const profile = await this.fyersService.getProfile();
        logger.debug('Profile response:', JSON.stringify(profile, null, 2));

        const userName = profile.data?.name || profile.data?.display_name || 'Unknown';
        const userEmail = profile.data?.email || profile.data?.email_id || 'Not available';

        logger.info(`Connected as: ${userName} (${userEmail})`);
      } catch (profileError) {
        logger.error(`Profile fetch failed: ${profileError.message}`);
        throw profileError; // This is critical, so we should fail
      }

      // Get account funds (non-critical)
      try {
        const funds = await this.fyersService.getFunds();
        logger.debug('Funds response:', JSON.stringify(funds, null, 2));

        if (funds && funds.s === 'ok' && funds.data) {
          // Try multiple possible field names for available funds
          const fundData = funds.data;
          const availableFunds = fundData.fund_limit ||
                               fundData.availablecash ||
                               fundData.available_cash ||
                               fundData.total_balance ||
                               fundData.availableBalance ||
                               fundData.available_balance ||
                               fundData.cash_available ||
                               fundData.cashAvailable ||
                               'N/A';

          logger.info(`Available funds: ₹${availableFunds}`);

          // Log all available fields for debugging
          logger.debug('Available fund fields:', Object.keys(fundData));
        } else {
          logger.warn('Funds API response structure is unexpected');
          logger.warn('Response:', JSON.stringify(funds, null, 2));
        }
      } catch (fundError) {
        logger.warn(`Could not fetch funds (non-critical): ${fundError.message}`);
      }

      // Get current positions (non-critical)
      try {
        const positions = await this.orderService.getPositions();
        logger.debug('Positions response:', JSON.stringify(positions, null, 2));

        const netPositions = positions.data?.netPositions ||
                           positions.data?.positions ||
                           positions.data ||
                           [];

        if (Array.isArray(netPositions) && netPositions.length > 0) {
          logger.info(`Current positions: ${netPositions.length}`);
        } else {
          logger.info('No current positions');
        }
      } catch (positionError) {
        logger.warn(`Could not fetch positions (non-critical): ${positionError.message}`);
      }

      this.isRunning = true;
      logger.info("Trading application initialized successfully");

    } catch (error) {
      logger.error(`Initialization error: ${error.message}`);
      // Only throw if it's a critical error (like profile fetch failure)
      if (error.message.includes('Profile fetch failed')) {
        throw error;
      }
      // For other errors, log but continue
      logger.warn('Some non-critical initialization steps failed, but continuing...');
      this.isRunning = true;
    }
  }

  async generateAccessToken() {
    try {
      const authUrl = await this.fyersService.generateAuthUrl();
      logger.info(`Please visit this URL to authorize: ${authUrl}`);
      logger.info("After authorization, extract the auth_code from the redirect URL");
      logger.info("Then set FYERS_ACCESS_TOKEN in your .env file or call generateAccessToken(authCode)");
      
    } catch (error) {
      logger.error(`Auth URL generation error: ${error.message}`);
      throw error;
    }
  }

  async startMarketDataFeed() {
    try {
      logger.info("Starting market data feed...");
      this.marketDataService.connect();
      
      // Wait for connection to establish
      await new Promise((resolve) => {
        this.marketDataService.once('connected', resolve);
      });

      // Subscribe to popular stocks and indices
      this.marketDataService.subscribeToIndices();
      this.marketDataService.subscribeToTopStocks();
      
      logger.info("Market data feed started successfully");
      
    } catch (error) {
      logger.error(`Market data feed error: ${error.message}`);
      throw error;
    }
  }

  handleMarketTick(data) {
    // Process real-time market data
    // Implement your trading logic here
    logger.debug(`Tick: ${data.symbol} - LTP: ${data.ltp}`);
    
    // Example: Simple moving average crossover strategy
    // You can implement your own strategies here
  }

  handleSignificantMove(data) {
    logger.info(`Significant price movement detected: ${data.symbol} moved ${data.change_percentage}%`);
    
    // Example: Alert or take action on significant moves
    // You can implement momentum strategies here
  }

  handleVolumeSpike(data) {
    logger.info(`Volume spike detected in ${data.symbol}: ${data.volume}`);
    
    // Example: Volume-based trading strategies
    // You can implement breakout strategies here
  }

  async placeTestOrder() {
    try {
      // Example: Place a test buy order for SBIN
      const orderData = {
        symbol: "NSE:SBIN-EQ",
        quantity: 1,
        type: 2, // Market order
        side: 1, // Buy
        productType: "INTRADAY"
      };

      logger.info("Placing test order...");
      const response = await this.orderService.placeOrder(orderData);
      logger.info(`Test order placed: ${JSON.stringify(response)}`);
      
      return response;
      
    } catch (error) {
      logger.error(`Test order error: ${error.message}`);
      throw error;
    }
  }

  async getAccountSummary() {
    try {
      const results = await Promise.allSettled([
        this.fyersService.getProfile(),
        this.fyersService.getFunds(),
        this.orderService.getPositions(),
        this.orderService.getOrders()
      ]);

      const [profileResult, fundsResult, positionsResult, ordersResult] = results;

      const summary = {
        profile: profileResult.status === 'fulfilled' ? profileResult.value.data : null,
        funds: fundsResult.status === 'fulfilled' ? fundsResult.value.data : null,
        positions: positionsResult.status === 'fulfilled' ? positionsResult.value.data : null,
        orders: ordersResult.status === 'fulfilled' ? ordersResult.value.data : null,
        timestamp: new Date().toISOString()
      };

      // Log available funds safely
      if (summary.funds) {
        const availableFunds = summary.funds.fund_limit ||
                             summary.funds.availablecash ||
                             summary.funds.available_cash ||
                             summary.funds.total_balance ||
                             'N/A';

        logger.info(`Account summary retrieved - Available funds: ₹${availableFunds}`);
      } else {
        logger.info('Account summary retrieved - Funds data not available');
      }

      return summary;

    } catch (error) {
      logger.error(`Account summary error: ${error.message}`);
      throw error;
    }
  }

  async shutdown() {
    logger.info("Shutting down trading application...");
    
    this.marketDataService.disconnect();
    this.isRunning = false;
    
    logger.info("Trading application shut down complete");
  }

  // Utility methods
  isMarketOpen() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 100 + minutes;
    
    // Market hours: 9:15 AM to 3:30 PM IST
    return currentTime >= 915 && currentTime <= 1530;
  }

  getMarketStatus() {
    return {
      isOpen: this.isMarketOpen(),
      isRunning: this.isRunning,
      marketDataConnected: this.marketDataService.isConnected,
      subscriptions: this.marketDataService.getSubscriptions()
    };
  }
}

// Application entry point
async function main() {
  const app = new TradingApp();
  
  try {
    await app.initialize();
    
    if (app.isRunning) {
      await app.startMarketDataFeed();
      
      // Get account summary
      try {
        const summary = await app.getAccountSummary();

        // Safely extract funds information
        let fundsInfo = 'N/A';
        if (summary && summary.funds) {
          const fundData = summary.funds;
          fundsInfo = fundData.fund_limit ||
                     fundData.availablecash ||
                     fundData.available_cash ||
                     fundData.total_balance ||
                     fundData.availableBalance ||
                     'N/A';
        }

        logger.info(`Account Summary: Available Funds: ₹${fundsInfo}`);
      } catch (summaryError) {
        logger.warn(`Could not get account summary: ${summaryError.message}`);
      }
      
      // Uncomment to test order placement (be careful in production!)
      // await app.placeTestOrder();
      
      logger.info("Trading application is running. Press Ctrl+C to stop.");
    }
    
  } catch (error) {
    logger.error(`Application error: ${error.message}`);
    process.exit(1);
  }

  // Graceful shutdown handlers
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await app.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await app.shutdown();
    process.exit(0);
  });
}

// Run the application if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = TradingApp;
