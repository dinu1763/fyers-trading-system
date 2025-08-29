# FYERS Algorithmic Trading System Setup Guide - Node.js

## Table of Contents
1. [Prerequisites and Environment Setup](#prerequisites-and-environment-setup)
2. [FYERS API Integration](#fyers-api-integration)
3. [Project Structure and Dependencies](#project-structure-and-dependencies)
4. [Core Implementation Components](#core-implementation-components)
5. [Configuration and Security](#configuration-and-security)
6. [Testing and Deployment](#testing-and-deployment)
7. [Sample Code Examples](#sample-code-examples)

## 1. Prerequisites and Environment Setup

### Required Node.js Version
- **Node.js v12.0.0+** (Recommended: v18.x or v20.x LTS)
- **npm v6.0.0+** or **yarn v1.22.0+**

### Installation Commands
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# If Node.js is not installed, download from https://nodejs.org/
# Or use nvm (Node Version Manager)
nvm install 20
nvm use 20
```

### Development Environment Configuration
```bash
# Create project directory
mkdir fyers-trading-system
cd fyers-trading-system

# Initialize npm project
npm init -y

# Install FYERS API v3 (already installed in your project)
npm install fyers-api-v3@latest

# Install additional required dependencies
npm install dotenv axios winston moment-timezone lodash
npm install --save-dev jest nodemon eslint
```

### System Dependencies
- **Windows**: No additional system dependencies required
- **Linux/macOS**: Ensure build tools are available
```bash
# Ubuntu/Debian
sudo apt-get install build-essential

# macOS (with Homebrew)
xcode-select --install
```

## 2. FYERS API Integration

### Account Setup Process
1. **Create FYERS Account**: Visit [https://fyers.in](https://fyers.in)
2. **Complete KYC**: Submit required documents
3. **API Access**: Navigate to [https://myapi.fyers.in](https://myapi.fyers.in)
4. **Create App**: 
   - Login to API portal
   - Click "Create App"
   - Fill app details:
     - App Name: Your trading system name
     - Redirect URL: `https://www.google.com` (for testing)
     - App Type: Web App
   - Note down **App ID** and **Secret Key**

### Authentication Flow Implementation
The FYERS API uses OAuth 2.0 flow:
1. Generate authorization URL
2. User authorizes and gets auth code
3. Exchange auth code for access token
4. Use access token for API calls

### API Endpoint Configuration
- **Production API**: `https://api.fyers.in/api/v2`
- **Sync API**: `https://api-t1.fyers.in/api/v3`
- **Data API**: `https://api.fyers.in/data-rest/v2`
- **WebSocket**: `wss://socket.fyers.in/hsm/v1-5/prod`

## 3. Project Structure and Dependencies

### Recommended Folder Structure
```
fyers-trading-system/
├── src/
│   ├── config/
│   │   ├── config.js
│   │   └── constants.js
│   ├── services/
│   │   ├── fyersService.js
│   │   ├── orderService.js
│   │   ├── marketDataService.js
│   │   └── portfolioService.js
│   ├── strategies/
│   │   ├── baseStrategy.js
│   │   └── sampleStrategy.js
│   ├── utils/
│   │   ├── logger.js
│   │   ├── helpers.js
│   │   └── validators.js
│   └── app.js
├── tests/
│   ├── unit/
│   └── integration/
├── logs/
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

### Essential npm Packages
```json
{
  "dependencies": {
    "fyers-api-v3": "^1.4.2",
    "dotenv": "^16.3.1",
    "axios": "^1.6.0",
    "winston": "^3.11.0",
    "moment-timezone": "^0.5.43",
    "lodash": "^4.17.21",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.0.1",
    "eslint": "^8.52.0",
    "@types/node": "^20.8.0"
  }
}
```

### Package.json Configuration
```json
{
  "name": "fyers-trading-system",
  "version": "1.0.0",
  "description": "Algorithmic trading system using FYERS API",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix"
  },
  "keywords": ["fyers", "trading", "algorithmic", "nodejs"],
  "author": "Your Name",
  "license": "MIT"
}
```

## 4. Core Implementation Components

### Market Data Connection and Real-time Feeds
- **Data WebSocket**: Real-time market data streaming
- **Quote API**: Get current market quotes
- **Market Depth**: Order book data
- **Historical Data**: OHLCV data for backtesting

### Order Placement and Management System
- **Order Types**: Market, Limit, Stop-Loss, Stop-Limit
- **Order Modifications**: Modify price, quantity, order type
- **Order Cancellation**: Cancel pending orders
- **Multi-leg Orders**: Complex option strategies

### Portfolio Tracking and Position Management
- **Holdings**: Long-term equity positions
- **Positions**: Intraday and overnight positions
- **Funds**: Available margin and cash
- **P&L Tracking**: Real-time profit/loss calculation

### Risk Management and Error Handling
- **Position Sizing**: Calculate appropriate position sizes
- **Stop-Loss Management**: Automatic stop-loss placement
- **Exposure Limits**: Maximum exposure per stock/sector
- **Error Recovery**: Handle API failures gracefully

## 5. Configuration and Security

### Environment Variables Setup
Create `.env` file in project root:
```env
# FYERS API Configuration
FYERS_APP_ID=your_app_id_here
FYERS_SECRET_KEY=your_secret_key_here
FYERS_REDIRECT_URL=https://www.google.com
FYERS_ACCESS_TOKEN=your_access_token_here

# Trading Configuration
MAX_POSITION_SIZE=100000
RISK_PERCENTAGE=2
STOP_LOSS_PERCENTAGE=5

# Environment
NODE_ENV=development
LOG_LEVEL=info
```

### Security Best Practices
1. **Never commit API keys** to version control
2. **Use environment variables** for sensitive data
3. **Implement token refresh** mechanism
4. **Use HTTPS** for all API communications
5. **Validate all inputs** before API calls
6. **Implement rate limiting** to avoid API limits

### Configuration File Structure
```javascript
// src/config/config.js
const config = {
  fyers: {
    appId: process.env.FYERS_APP_ID,
    secretKey: process.env.FYERS_SECRET_KEY,
    redirectUrl: process.env.FYERS_REDIRECT_URL,
    accessToken: process.env.FYERS_ACCESS_TOKEN
  },
  trading: {
    maxPositionSize: parseInt(process.env.MAX_POSITION_SIZE) || 100000,
    riskPercentage: parseFloat(process.env.RISK_PERCENTAGE) || 2,
    stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE) || 5
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: './logs/trading.log'
  }
};

module.exports = config;
```

## 6. Testing and Deployment

### Unit Testing Setup
```bash
# Install testing dependencies
npm install --save-dev jest supertest

# Create test configuration
# jest.config.js
module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testMatch: ['**/tests/**/*.test.js']
};
```

### Integration Testing with FYERS Sandbox
1. **Use Demo Account**: Create demo trading account
2. **Test Environment**: Use sandbox API endpoints
3. **Mock Data**: Create mock market data for testing
4. **Automated Tests**: Test all trading functions

### Production Deployment Considerations
1. **Server Requirements**:
   - Minimum 2GB RAM
   - Stable internet connection
   - 24/7 uptime capability
2. **Monitoring**: Implement health checks and alerts
3. **Backup**: Regular backup of trading logs and configurations
4. **Scaling**: Consider load balancing for high-frequency trading

## 7. Sample Code Examples

### Basic Connection Establishment
```javascript
// src/services/fyersService.js
const { fyersModel } = require("fyers-api-v3");
const config = require('../config/config');

class FyersService {
  constructor() {
    this.fyers = new fyersModel({
      path: "./logs",
      enableLogging: true
    });

    this.fyers.setAppId(config.fyers.appId);
    this.fyers.setRedirectUrl(config.fyers.redirectUrl);

    if (config.fyers.accessToken) {
      this.fyers.setAccessToken(config.fyers.accessToken);
    }
  }

  async generateAuthUrl() {
    return this.fyers.generateAuthCode();
  }

  async generateAccessToken(authCode) {
    try {
      const response = await this.fyers.generate_access_token({
        client_id: config.fyers.appId,
        secret_key: config.fyers.secretKey,
        auth_code: authCode
      });

      if (response.s === 'ok') {
        this.fyers.setAccessToken(response.access_token);
        return response.access_token;
      } else {
        throw new Error(`Token generation failed: ${response.message}`);
      }
    } catch (error) {
      throw new Error(`Authentication error: ${error.message}`);
    }
  }

  async getProfile() {
    try {
      return await this.fyers.get_profile();
    } catch (error) {
      throw new Error(`Profile fetch error: ${error.message}`);
    }
  }

  async getFunds() {
    try {
      return await this.fyers.get_funds();
    } catch (error) {
      throw new Error(`Funds fetch error: ${error.message}`);
    }
  }
}

module.exports = FyersService;
```

### Simple Buy/Sell Order Implementation
```javascript
// src/services/orderService.js
const FyersService = require('./fyersService');
const logger = require('../utils/logger');

class OrderService extends FyersService {
  constructor() {
    super();
  }

  async placeOrder(orderData) {
    try {
      const order = {
        symbol: orderData.symbol,
        qty: orderData.quantity,
        type: orderData.type || 2, // 1: Limit, 2: Market, 3: SL, 4: SL-M
        side: orderData.side, // 1: Buy, -1: Sell
        productType: orderData.productType || "CNC", // CNC, INTRADAY, MARGIN, CO, BO
        limitPrice: orderData.limitPrice || 0,
        stopPrice: orderData.stopPrice || 0,
        validity: orderData.validity || "DAY", // DAY, IOC
        disclosedQty: orderData.disclosedQty || 0,
        offlineOrder: false
      };

      logger.info(`Placing order: ${JSON.stringify(order)}`);
      const response = await this.fyers.place_order(order);

      if (response.s === 'ok') {
        logger.info(`Order placed successfully: ${response.id}`);
        return response;
      } else {
        throw new Error(`Order placement failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Order placement error: ${error.message}`);
      throw error;
    }
  }

  async modifyOrder(orderId, modifications) {
    try {
      const modifyData = {
        id: orderId,
        ...modifications
      };

      logger.info(`Modifying order ${orderId}: ${JSON.stringify(modifications)}`);
      const response = await this.fyers.modify_order(modifyData);

      if (response.s === 'ok') {
        logger.info(`Order modified successfully: ${orderId}`);
        return response;
      } else {
        throw new Error(`Order modification failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Order modification error: ${error.message}`);
      throw error;
    }
  }

  async cancelOrder(orderId) {
    try {
      logger.info(`Cancelling order: ${orderId}`);
      const response = await this.fyers.cancel_order({ id: orderId });

      if (response.s === 'ok') {
        logger.info(`Order cancelled successfully: ${orderId}`);
        return response;
      } else {
        throw new Error(`Order cancellation failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Order cancellation error: ${error.message}`);
      throw error;
    }
  }

  async getOrders() {
    try {
      return await this.fyers.get_orders();
    } catch (error) {
      logger.error(`Get orders error: ${error.message}`);
      throw error;
    }
  }

  async getPositions() {
    try {
      return await this.fyers.get_positions();
    } catch (error) {
      logger.error(`Get positions error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = OrderService;
```

### Market Data Subscription Example
```javascript
// src/services/marketDataService.js
const { fyersDataSocket } = require("fyers-api-v3");
const logger = require('../utils/logger');
const config = require('../config/config');

class MarketDataService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.subscriptions = new Set();
  }

  connect() {
    try {
      this.socket = fyersDataSocket.getInstance(
        config.fyers.accessToken,
        "./logs",
        true // Enable logging
      );

      this.socket.on("connect", () => {
        logger.info("Market data socket connected");
        this.isConnected = true;
        this.socket.mode(this.socket.FullMode);
      });

      this.socket.on("message", (message) => {
        this.handleMarketData(message);
      });

      this.socket.on("error", (error) => {
        logger.error(`Market data socket error: ${error}`);
        this.isConnected = false;
      });

      this.socket.on("close", () => {
        logger.info("Market data socket closed");
        this.isConnected = false;
      });

      this.socket.connect();
      this.socket.autoReconnect(5); // Auto-reconnect with 5 retries

    } catch (error) {
      logger.error(`Market data connection error: ${error.message}`);
      throw error;
    }
  }

  subscribe(symbols) {
    if (!this.isConnected) {
      throw new Error("Socket not connected");
    }

    try {
      const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
      this.socket.subscribe(symbolArray);

      symbolArray.forEach(symbol => this.subscriptions.add(symbol));
      logger.info(`Subscribed to symbols: ${symbolArray.join(', ')}`);

    } catch (error) {
      logger.error(`Subscription error: ${error.message}`);
      throw error;
    }
  }

  unsubscribe(symbols) {
    if (!this.isConnected) {
      throw new Error("Socket not connected");
    }

    try {
      const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
      this.socket.unsubscribe(symbolArray);

      symbolArray.forEach(symbol => this.subscriptions.delete(symbol));
      logger.info(`Unsubscribed from symbols: ${symbolArray.join(', ')}`);

    } catch (error) {
      logger.error(`Unsubscription error: ${error.message}`);
      throw error;
    }
  }

  handleMarketData(data) {
    // Process incoming market data
    // Implement your trading logic here
    logger.debug(`Market data received: ${JSON.stringify(data)}`);

    // Example: Check for price alerts, trigger strategies, etc.
    this.processTickData(data);
  }

  processTickData(tickData) {
    // Implement your tick processing logic
    // This is where you can add your trading strategies

    if (tickData && tickData.symbol) {
      const { symbol, ltp, volume, timestamp } = tickData;

      // Example: Log significant price movements
      if (tickData.change_percentage && Math.abs(tickData.change_percentage) > 2) {
        logger.info(`Significant movement in ${symbol}: ${tickData.change_percentage}%`);
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.isConnected = false;
      this.subscriptions.clear();
      logger.info("Market data socket disconnected");
    }
  }
}

module.exports = MarketDataService;
```

### Complete Trading Application Example
```javascript
// src/app.js
require('dotenv').config();
const FyersService = require('./services/fyersService');
const OrderService = require('./services/orderService');
const MarketDataService = require('./services/marketDataService');
const logger = require('./utils/logger');

class TradingApp {
  constructor() {
    this.fyersService = new FyersService();
    this.orderService = new OrderService();
    this.marketDataService = new MarketDataService();
    this.isRunning = false;
  }

  async initialize() {
    try {
      logger.info("Initializing trading application...");

      // Check if access token is available
      if (!process.env.FYERS_ACCESS_TOKEN) {
        logger.warn("No access token found. Please generate one first.");
        await this.generateAccessToken();
        return;
      }

      // Verify connection
      const profile = await this.fyersService.getProfile();
      logger.info(`Connected as: ${profile.data.name} (${profile.data.email})`);

      // Get account funds
      const funds = await this.fyersService.getFunds();
      logger.info(`Available funds: ₹${funds.data.fund_limit}`);

      this.isRunning = true;
      logger.info("Trading application initialized successfully");

    } catch (error) {
      logger.error(`Initialization error: ${error.message}`);
      throw error;
    }
  }

  async generateAccessToken() {
    try {
      const authUrl = await this.fyersService.generateAuthUrl();
      logger.info(`Please visit this URL to authorize: ${authUrl}`);
      logger.info("After authorization, extract the auth_code from the redirect URL and set it in your environment");

      // In a real application, you would handle the redirect and extract the auth_code
      // For now, this is a manual process

    } catch (error) {
      logger.error(`Auth URL generation error: ${error.message}`);
      throw error;
    }
  }

  async startMarketDataFeed() {
    try {
      this.marketDataService.connect();

      // Subscribe to some popular stocks for demo
      const symbols = [
        "NSE:SBIN-EQ",
        "NSE:TCS-EQ",
        "NSE:RELIANCE-EQ",
        "NSE:INFY-EQ"
      ];

      setTimeout(() => {
        this.marketDataService.subscribe(symbols);
      }, 2000); // Wait for connection to establish

    } catch (error) {
      logger.error(`Market data feed error: ${error.message}`);
      throw error;
    }
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

    } catch (error) {
      logger.error(`Test order error: ${error.message}`);
    }
  }

  async shutdown() {
    logger.info("Shutting down trading application...");

    this.marketDataService.disconnect();
    this.isRunning = false;

    logger.info("Trading application shut down complete");
  }
}

// Application entry point
async function main() {
  const app = new TradingApp();

  try {
    await app.initialize();

    if (app.isRunning) {
      await app.startMarketDataFeed();

      // Uncomment to test order placement
      // await app.placeTestOrder();
    }

  } catch (error) {
    logger.error(`Application error: ${error.message}`);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await app.shutdown();
    process.exit(0);
  });
}

if (require.main === module) {
  main();
}

module.exports = TradingApp;
```

### Utility Files

#### Logger Configuration
```javascript
// src/utils/logger.js
const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'fyers-trading' },
  transports: [
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log')
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
```

#### Environment Configuration Template
```bash
# .env.example
# Copy this file to .env and fill in your actual values

# FYERS API Configuration
FYERS_APP_ID=your_app_id_here
FYERS_SECRET_KEY=your_secret_key_here
FYERS_REDIRECT_URL=https://www.google.com
FYERS_ACCESS_TOKEN=your_access_token_here

# Trading Configuration
MAX_POSITION_SIZE=100000
RISK_PERCENTAGE=2
STOP_LOSS_PERCENTAGE=5

# Environment
NODE_ENV=development
LOG_LEVEL=info
```

## Quick Start Commands

### 1. Initial Setup
```bash
# Clone or create project directory
mkdir fyers-trading-system
cd fyers-trading-system

# Initialize project
npm init -y

# Install dependencies
npm install fyers-api-v3 dotenv winston moment-timezone lodash
npm install --save-dev jest nodemon eslint
```

### 2. Create Project Structure
```bash
# Create directory structure
mkdir -p src/{config,services,strategies,utils} tests/{unit,integration} logs

# Create main files
touch src/app.js src/config/config.js src/services/fyersService.js
touch .env .env.example .gitignore
```

### 3. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your FYERS credentials
# Use your favorite editor to fill in the values
```

### 4. Run the Application
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start

# Run tests
npm test
```

## Important Notes and Best Practices

### 1. API Rate Limits
- **Order APIs**: 10 requests per second
- **Market Data**: 1 request per second for quotes
- **WebSocket**: No specific limits but avoid excessive subscriptions

### 2. Trading Hours
- **Equity**: 9:15 AM to 3:30 PM (IST)
- **Derivatives**: 9:15 AM to 3:30 PM (IST)
- **Currency**: 9:00 AM to 5:00 PM (IST)

### 3. Symbol Format
- **Equity**: `NSE:SYMBOL-EQ` (e.g., `NSE:SBIN-EQ`)
- **Futures**: `NSE:SYMBOL23DECFUT` (e.g., `NSE:NIFTY23DECFUT`)
- **Options**: `NSE:SYMBOL23DEC18000CE` (e.g., `NSE:NIFTY23DEC18000CE`)

### 4. Error Handling
- Always implement try-catch blocks
- Log all errors for debugging
- Implement retry mechanisms for network failures
- Handle API rate limit errors gracefully

### 5. Security Considerations
- Never hardcode API credentials
- Use environment variables for sensitive data
- Implement proper access controls
- Regular security audits of your code

### 6. Testing Strategy
- Test with small quantities first
- Use paper trading/demo account initially
- Implement comprehensive unit tests
- Monitor all trades and performance

This comprehensive guide provides everything needed to set up a robust FYERS algorithmic trading system using Node.js. Start with the basic setup and gradually implement more advanced features as you become comfortable with the system.
