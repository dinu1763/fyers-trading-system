# 🚀 FYERS Algorithmic Trading System

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![FYERS API](https://img.shields.io/badge/FYERS-API%20v3-orange.svg)](https://myapi.fyers.in/)

A comprehensive, production-ready algorithmic trading system built with Node.js and the FYERS API v3. Features a unified command-line interface, automated order management with take-profit/stop-loss, real-time monitoring, and advanced risk management tools.

## ✨ Key Features

- **🎯 Unified CLI Interface**: Single command-line tool for all trading operations
- **📈 Automated Order Management**: MIS orders with automatic TP/SL and order cancellation
- **📊 Real-time Market Data**: WebSocket-based live market feeds and monitoring
- **💼 Portfolio Management**: Complete portfolio tracking with P&L analysis
- **🛡️ Risk Management**: Position sizing calculator, stop-loss automation, emergency controls
- **📝 Comprehensive Logging**: Detailed audit trails and debugging capabilities
- **🔧 Modular Architecture**: Clean, extensible codebase with event-driven design
- **🧪 Testing Suite**: Unit and integration tests for reliability
- **📚 Complete Documentation**: Step-by-step guides and examples

## Prerequisites

- Node.js v12.0.0+ (Recommended: v18.x or v20.x LTS)
- FYERS Trading Account
- FYERS API credentials (App ID and Secret Key)

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/dinesh-1763/fyers-trading-system.git
cd fyers-trading-system

# Install dependencies
npm install

# Run setup script
node scripts/setup.js
```

### 2. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your FYERS credentials
# Get credentials from: https://myapi.fyers.in
```

### 3. Authentication Setup

```bash
# Generate access token (interactive)
node examples/auth-setup.js

# Test connection
node examples/auth-setup.js test
```

### 4. Start Trading

```bash
# Verify environment
node place-order.js verify

# Check market status
node place-order.js market-status

# Place your first order (1 share for testing)
node place-order.js buy NSE:SBIN-EQ 1

# Monitor your portfolio
node place-order.js monitor
```

## 🎯 Unified CLI Commands

The system provides a comprehensive command-line interface through `place-order.js`:

### Order Operations
```bash
# Place orders
node place-order.js buy NSE:SBIN-EQ 10 500        # Limit buy
node place-order.js sell NSE:TCS-EQ 5             # Market sell
node place-order.js mis-trade NSE:SBIN-EQ 10 500 0.75 0.35  # MIS with TP/SL

# Order management
node place-order.js orders                        # View orders
node place-order.js cancel ORDER_ID               # Cancel order
node place-order.js cancel-all                    # Cancel all orders
```

### Portfolio Management
```bash
node place-order.js positions                     # Current positions
node place-order.js balance                       # Account balance
node place-order.js trades                        # Trade history
```

### Risk Management
```bash
node place-order.js stop-loss NSE:SBIN-EQ 480     # Set stop-loss
node place-order.js emergency-close               # Close all positions
node place-order.js position-size 100000 2 500 485  # Calculate position size
```

### Monitoring & Debugging
```bash
node place-order.js monitor                       # Real-time monitoring
node place-order.js logs error                    # View error logs
node place-order.js test-connection               # Test API connectivity
```

## Project Structure

```
fyers-trading-system/
├── src/
│   ├── config/
│   │   └── config.js              # Configuration management
│   ├── services/
│   │   ├── fyersService.js        # Core FYERS API service
│   │   ├── orderService.js        # Order management
│   │   └── marketDataService.js   # Real-time market data
│   ├── utils/
│   │   └── logger.js              # Logging utility
│   └── app.js                     # Main application
├── tests/
│   ├── unit/                      # Unit tests
│   └── setup.js                   # Test configuration
├── logs/                          # Application logs
├── .env                           # Environment variables
└── package.json                   # Dependencies and scripts
```

## API Usage Examples

### Basic Order Placement

```javascript
const { OrderService } = require('./src/services/orderService');

const orderService = new OrderService();

// Market Buy Order
const buyOrder = await orderService.placeOrder({
  symbol: "NSE:SBIN-EQ",
  quantity: 10,
  side: 1, // Buy
  type: 2, // Market order
  productType: "INTRADAY"
});

// Limit Sell Order
const sellOrder = await orderService.placeOrder({
  symbol: "NSE:SBIN-EQ",
  quantity: 10,
  side: -1, // Sell
  type: 1, // Limit order
  limitPrice: 520,
  productType: "CNC"
});
```

### Market Data Subscription

```javascript
const { MarketDataService } = require('./src/services/marketDataService');

const marketData = new MarketDataService();

marketData.on('tick', (data) => {
  console.log(`${data.symbol}: ${data.ltp}`);
});

marketData.connect();
marketData.subscribe(['NSE:SBIN-EQ', 'NSE:TCS-EQ']);
```

### Portfolio Management

```javascript
const { FyersService } = require('./src/services/fyersService');

const fyers = new FyersService();

// Get account funds
const funds = await fyers.getFunds();
console.log(`Available funds: ₹${funds.data.fund_limit}`);

// Get positions
const positions = await orderService.getPositions();
console.log('Current positions:', positions.data.netPositions);
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FYERS_APP_ID` | Your FYERS App ID | Yes |
| `FYERS_SECRET_KEY` | Your FYERS Secret Key | Yes |
| `FYERS_REDIRECT_URL` | Redirect URL for OAuth | Yes |
| `FYERS_ACCESS_TOKEN` | Generated access token | Yes* |
| `MAX_POSITION_SIZE` | Maximum position size | No |
| `RISK_PERCENTAGE` | Risk percentage per trade | No |
| `STOP_LOSS_PERCENTAGE` | Default stop-loss percentage | No |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | No |

*Access token is generated during the OAuth flow

### Trading Configuration

```javascript
// src/config/config.js
const config = {
  trading: {
    maxPositionSize: 100000,
    riskPercentage: 2,
    stopLossPercentage: 5
  }
};
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/unit/orderService.test.js

# Generate coverage report
npm test -- --coverage
```

## Security Best Practices

1. **Never commit API credentials** to version control
2. **Use environment variables** for sensitive configuration
3. **Implement proper error handling** for all API calls
4. **Monitor API rate limits** to avoid throttling
5. **Use HTTPS** for all communications
6. **Regular security audits** of dependencies

## Trading Hours

- **Equity Markets**: 9:15 AM to 3:30 PM (IST)
- **Derivatives**: 9:15 AM to 3:30 PM (IST)
- **Currency**: 9:00 AM to 5:00 PM (IST)

## Symbol Formats

- **Equity**: `NSE:SYMBOL-EQ` (e.g., `NSE:SBIN-EQ`)
- **Futures**: `NSE:SYMBOL23DECFUT` (e.g., `NSE:NIFTY23DECFUT`)
- **Options**: `NSE:SYMBOL23DEC18000CE` (e.g., `NSE:NIFTY23DEC18000CE`)

## Error Handling

The system implements comprehensive error handling:

- **API Errors**: Proper error messages and retry mechanisms
- **Network Failures**: Automatic reconnection for WebSocket connections
- **Rate Limiting**: Graceful handling of API rate limits
- **Validation Errors**: Input validation for all trading operations

## Logging

Logs are written to the `logs/` directory:

- `combined.log`: All log messages
- `error.log`: Error messages only
- Console output in development mode

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Disclaimer

This software is for educational and research purposes only. Trading in financial markets involves substantial risk of loss. The authors are not responsible for any financial losses incurred through the use of this software.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup
```bash
git clone https://github.com/dinesh-1763/fyers-trading-system.git
cd fyers-trading-system
npm install
npm test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Issues

- **Documentation**: Check the comprehensive guides in this README
- **API Issues**: [FYERS API Documentation](https://myapi.fyers.in/docsv3)
- **Bug Reports**: [Create an issue](https://github.com/dinesh-1763/fyers-trading-system/issues)
- **Feature Requests**: [Open a discussion](https://github.com/dinesh-1763/fyers-trading-system/discussions)

## ⭐ Star History

If this project helped you, please consider giving it a star! ⭐

## 📞 Contact

- **GitHub**: [@dinesh-1763](https://github.com/dinesh-1763)
- **Email**: dineshkumar@adobe.com

---

**⚠️ Risk Disclaimer**: This is a trading system that can place real orders and execute real trades. Always test with small amounts first and understand the risks involved in algorithmic trading.

## Troubleshooting

### Common Issues

1. **Access Token Expired**: Regenerate the access token using the OAuth flow
2. **WebSocket Connection Failed**: Check network connectivity and API credentials
3. **Order Placement Failed**: Verify account funds and market hours
4. **Rate Limit Exceeded**: Implement proper delays between API calls

### Debug Mode

Enable debug logging by setting `LOG_LEVEL=debug` in your `.env` file.
