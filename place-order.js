/**
 * FYERS Trading System - Unified Command Line Interface
 *
 * Usage: node place-order.js <command> [options]
 *
 * Commands:
 *   help                           - Show this help message
 *   verify                         - Verify environment and API connection
 *   start                          - Start the trading application
 *   status                         - Check application status
 *   stop                           - Stop the trading application
 *   buy <symbol> <qty> [price]     - Place buy order (MIS)
 *   sell <symbol> <qty> [price]    - Place sell order (MIS)
 *   orders                         - View current orders
 *   positions                      - View current positions
 *   balance                        - Check account balance
 *   trades                         - View trade history
 *   cancel <order_id>              - Cancel specific order
 *   cancel-all                     - Cancel all pending orders
 *   emergency-close                - Close all positions immediately
 *   stop-loss <symbol> <price>     - Set stop-loss for position
 *   position-size <account> <risk%> <entry> <stop> - Calculate position size
 *   monitor                        - Real-time monitoring
 *   logs [level]                   - View application logs
 *   test-connection                - Test API connectivity
 *   market-status                  - Check if market is open
 *
 * Examples:
 *   node place-order.js buy NSE:SBIN-EQ 1
 *   node place-order.js sell NSE:TCS-EQ 2 3500
 *   node place-order.js stop-loss NSE:SBIN-EQ 480
 *   node place-order.js position-size 100000 2 500 485
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const moment = require('moment-timezone');

// Import services
const OrderService = require('./src/services/orderService');
const FyersService = require('./src/services/fyersService');
const TradingApp = require('./src/app');
const MarketDataService = require('./src/services/marketDataService');

// Utility functions
function formatCurrency(amount) {
  if (typeof amount !== 'number') return 'N/A';
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isMarketOpen() {
  const now = moment().tz('Asia/Kolkata');
  const currentTime = now.format('HHmm');
  const dayOfWeek = now.day();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { open: false, reason: 'Weekend' };
  }

  if (currentTime < '0915') {
    return { open: false, reason: 'Before market hours (opens at 9:15 AM)' };
  } else if (currentTime > '1530') {
    return { open: false, reason: 'After market hours (closes at 3:30 PM)' };
  } else {
    return { open: true, reason: 'Market is open' };
  }
}

function safeExtract(obj, possibleKeys, defaultValue = 'N/A') {
  if (!obj || typeof obj !== 'object') return defaultValue;
  for (const key of possibleKeys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return defaultValue;
}

function printHeader(title) {
  console.log('\n' + '='.repeat(50));
  console.log(`🚀 ${title}`);
  console.log('='.repeat(50));
}

function printSuccess(message) {
  console.log(`✅ ${message}`);
}

function printError(message) {
  console.log(`❌ ${message}`);
}

function printWarning(message) {
  console.log(`⚠️ ${message}`);
}

function printInfo(message) {
  console.log(`ℹ️ ${message}`);
}

// Command implementations
async function showHelp() {
  console.log(`
🚀 FYERS Trading System - Unified CLI

USAGE:
  node place-order.js <command> [options]

COMMANDS:

Environment & Setup:
  help                           Show this help message
  verify                         Verify environment and API connection
  test-connection                Test API connectivity only

Application Management:
  start                          Start the trading application
  status                         Check application status
  stop                           Stop the trading application

Order Operations:
  buy <symbol> <qty> [price]     Place buy order (market if no price)
  sell <symbol> <qty> [price]    Place sell order (market if no price)
  orders                         View current orders
  cancel <order_id>              Cancel specific order
  cancel-all                     Cancel all pending orders

Portfolio Management:
  positions                      View current positions
  balance                        Check account balance and funds
  trades                         View trade history

Risk Management:
  emergency-close                Close all positions immediately
  stop-loss <symbol> <price>     Set stop-loss for existing position
  position-size <account> <risk%> <entry> <stop>  Calculate position size

Monitoring & Debugging:
  monitor                        Real-time monitoring (30 seconds)
  logs [error|info|debug]        View application logs
  market-status                  Check if market is open

EXAMPLES:
  node place-order.js buy NSE:SBIN-EQ 1
  node place-order.js sell NSE:TCS-EQ 2 3500
  node place-order.js stop-loss NSE:SBIN-EQ 480
  node place-order.js position-size 100000 2 500 485
  node place-order.js cancel ORD123456
  node place-order.js logs error

FLAGS:
  --help                         Show help for any command
  --dry-run                      Show what would be done without executing

For detailed help on a specific command:
  node place-order.js <command> --help
`);
}

async function verifyEnvironment() {
  printHeader('Environment Verification');

  try {
    // Check Node.js version
    const nodeVersion = process.version;
    console.log(`Node.js version: ${nodeVersion}`);

    if (parseInt(nodeVersion.slice(1)) < 12) {
      printError('Node.js version 12+ required');
      return false;
    }
    printSuccess('Node.js version OK');

    // Check required files
    const requiredFiles = [
      'src/app.js',
      'src/config/config.js',
      'src/services/fyersService.js',
      'src/services/orderService.js',
      '.env'
    ];

    console.log('\n� Checking project structure:');
    for (const file of requiredFiles) {
      if (fs.existsSync(file)) {
        printSuccess(`${file} exists`);
      } else {
        printError(`${file} missing`);
        return false;
      }
    }

    // Check environment variables
    console.log('\n🔐 Checking environment variables:');
    const required = ['FYERS_APP_ID', 'FYERS_SECRET_KEY', 'FYERS_ACCESS_TOKEN'];
    for (const key of required) {
      if (process.env[key]) {
        printSuccess(`${key} is set`);
      } else {
        printError(`${key} is missing`);
        return false;
      }
    }

    // Test API connection
    console.log('\n🔌 Testing API connection:');
    const fyersService = new FyersService();
    const profile = await fyersService.getProfile();

    if (profile.s === 'ok') {
      printSuccess(`Connected as: ${profile.data.name}`);
      return true;
    } else {
      printError(`API connection failed: ${profile.message}`);
      return false;
    }

  } catch (error) {
    printError(`Verification failed: ${error.message}`);
    return false;
  }
}

// Add this improved function to your place-order.js
async function getCurrentMarketPrice(symbol) {
  try {
    const fyersService = new FyersService();
    
    // Try different symbol formats
    const symbolFormats = [
      symbol.toUpperCase(),
      symbol.replace('NSE:', ''),
      symbol.replace('-EQ', ''),
      `NSE:${symbol.replace('NSE:', '').replace('-EQ', '')}-EQ`
    ];
    
    for (const testSymbol of symbolFormats) {
      try {
        console.log(`🔍 Trying symbol format: ${testSymbol}`);
        const quotes = await fyersService.getQuotes([testSymbol]);
        
        if (quotes && quotes.s === 'ok' && quotes.data) {
          const symbolData = quotes.data[testSymbol] || quotes.data[0] || Object.values(quotes.data)[0];
          
          if (symbolData && symbolData.ltp) {
            console.log(`✅ Found price for ${testSymbol}: ₹${symbolData.ltp}`);
            return {
              price: symbolData.ltp,
              symbol: testSymbol
            };
          }
        }
      } catch (formatError) {
        console.log(`❌ Format ${testSymbol} failed: ${formatError.message}`);
        continue;
      }
    }
    
    throw new Error('Could not fetch price with any symbol format');
    
  } catch (error) {
    console.log('❌ Market price fetch failed:', error.message);
    
    // Fallback: Ask user for manual price
    console.log('');
    console.log('💡 SOLUTIONS:');
    console.log('1. Check if market is open (9:15 AM - 3:30 PM IST)');
    console.log('2. Verify your access token: node examples/auth-setup.js');
    console.log('3. Use manual price: node place-order.js short-m NSE:HDFCBANK-EQ 10 [PRICE] 0.75 0.35');
    console.log('4. Try different symbol: NSE:HDFCBANK-EQ or just HDFCBANK');
    
    throw error;
  }
}

async function getHoldings() {
  try {
    const orderService = new OrderService();
    const holdings = await orderService.getHoldings();
    
    console.log('🏦 HOLDINGS (Long-term):');
    console.log('========================');
    
    if (holdings.data && holdings.data.holdings) {
      let totalInvestment = 0;
      let totalCurrentValue = 0;
      
      holdings.data.holdings.forEach((holding, index) => {
        const investment = holding.qty * holding.avgPrice;
        const currentValue = holding.qty * (holding.ltp || holding.avgPrice);
        const pnl = currentValue - investment;
        const pnlPercent = ((pnl / investment) * 100);
        
        totalInvestment += investment;
        totalCurrentValue += currentValue;
        
        console.log(`${index + 1}. ${holding.symbol}`);
        console.log(`   Quantity: ${holding.qty}`);
        console.log(`   Avg Price: ₹${holding.avgPrice}`);
        console.log(`   Current Price: ₹${holding.ltp || 'N/A'}`);
        console.log(`   Investment: ₹${investment.toFixed(2)}`);
        console.log(`   Current Value: ₹${currentValue.toFixed(2)}`);
        console.log(`   P&L: ${pnl >= 0 ? '🟢' : '🔴'} ₹${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
        console.log('   ================');
      });
      
      const totalPnL = totalCurrentValue - totalInvestment;
      const totalPnLPercent = ((totalPnL / totalInvestment) * 100);
      
      console.log(`\\n📊 HOLDINGS SUMMARY:`);
      console.log(`Total Investment: ₹${totalInvestment.toFixed(2)}`);
      console.log(`Current Value: ₹${totalCurrentValue.toFixed(2)}`);
      console.log(`Total P&L: ${totalPnL >= 0 ? '🟢' : '🔴'} ₹${totalPnL.toFixed(2)} (${totalPnLPercent.toFixed(2)}%)`);
      
    } else {
      console.log('No holdings found');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function testConnection() {
  printHeader('API Connection Test');

  try {
    const fyersService = new FyersService();
    const orderService = new OrderService();

    // Test profile
    console.log('Testing profile API...');
    const profile = await fyersService.getProfile();
    if (profile.s === 'ok') {
      printSuccess(`Profile: ${profile.data.name} (${profile.data.email})`);
    } else {
      printError(`Profile failed: ${profile.message}`);
      return;
    }

    // Test funds
    console.log('Testing funds API...');
    try {
      const funds = await fyersService.getFunds();
      if (funds.s === 'ok') {
        const available = safeExtract(funds.data, ['fund_limit', 'availablecash', 'available_cash']);
        printSuccess(`Funds: ${formatCurrency(parseFloat(available))}`);
      }
    } catch (fundError) {
      printWarning(`Funds API: ${fundError.message}`);
    }

    // Test positions
    console.log('Testing positions API...');
    try {
      const positions = await orderService.getPositions();
      if (positions.s === 'ok') {
        const posCount = positions.data?.netPositions?.length || 0;
        printSuccess(`Positions: ${posCount} found`);
      }
    } catch (posError) {
      printWarning(`Positions API: ${posError.message}`);
    }

    printSuccess('API connection test completed');

  } catch (error) {
    printError(`Connection test failed: ${error.message}`);
  }
}

async function buyOrder(symbol, quantity, price = null) {
  try {
    const orderService = new OrderService();

    const orderData = {
      symbol: symbol.toUpperCase(),
      quantity: parseInt(quantity),
      side: 1, // Buy
      type: price ? 1 : 2, // Limit if price provided, otherwise Market
      productType: 'INTRADAY',
      validity: 'DAY'
    };

    if (price) {
      orderData.limitPrice = parseFloat(price);
    }

    console.log(`🛒 Placing ${price ? 'LIMIT' : 'MARKET'} BUY order:`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Quantity: ${quantity}`);
    if (price) console.log(`   Price: ₹${price}`);
    console.log(`   Product: INTRADAY (MIS)`);

    const result = await orderService.placeOrder(orderData);

    if (result.s === 'ok') {
      printSuccess(`Buy order placed successfully!`);
      console.log(`   Order ID: ${result.id}`);
      console.log(`   Status: ${result.s}`);
    } else {
      printError(`Order failed: ${result.message}`);
    }

  } catch (error) {
    printError(`Buy order failed: ${error.message}`);
  }
}

async function sellOrder(symbol, quantity, price = null) {
  try {
    const orderService = new OrderService();

    const orderData = {
      symbol: symbol.toUpperCase(),
      quantity: parseInt(quantity),
      side: -1, // Sell
      type: price ? 1 : 2, // Limit if price provided, otherwise Market
      productType: 'INTRADAY',
      validity: 'DAY'
    };

    if (price) {
      orderData.limitPrice = parseFloat(price);
    }

    console.log(`💰 Placing ${price ? 'LIMIT' : 'MARKET'} SELL order:`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Quantity: ${quantity}`);
    if (price) console.log(`   Price: ₹${price}`);
    console.log(`   Product: INTRADAY (MIS)`);

    const result = await orderService.placeOrder(orderData);

    if (result.s === 'ok') {
      printSuccess(`Sell order placed successfully!`);
      console.log(`   Order ID: ${result.id}`);
      console.log(`   Status: ${result.s}`);
    } else {
      printError(`Order failed: ${result.message}`);
    }

  } catch (error) {
    printError(`Sell order failed: ${error.message}`);
  }
}

async function viewOrders() {
  printHeader('Current Orders');

  try {
    const orderService = new OrderService();
    const orders = await orderService.getOrders();

    if (orders.data && orders.data.orderBook && orders.data.orderBook.length > 0) {
      orders.data.orderBook.forEach((order, index) => {
        console.log(`${index + 1}. ${order.symbol}`);
        console.log(`   ID: ${order.id}`);
        console.log(`   Side: ${order.side === 1 ? 'BUY' : 'SELL'}`);
        console.log(`   Quantity: ${order.qty}`);
        console.log(`   Type: ${order.type === 1 ? 'LIMIT' : 'MARKET'}`);
        console.log(`   Price: ${order.limitPrice ? '₹' + order.limitPrice : 'MARKET'}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Product: ${order.productType}`);
        console.log('   ---');
      });
    } else {
      printInfo('No orders found');
    }

  } catch (error) {
    printError(`Failed to fetch orders: ${error.message}`);
  }
}

async function viewPositions() {
  printHeader('Current Positions');

  try {
    const orderService = new OrderService();
    const positions = await orderService.getPositions();

    if (positions.data && positions.data.netPositions && positions.data.netPositions.length > 0) {
      positions.data.netPositions.forEach((pos, index) => {
        const pnl = parseFloat(pos.pl || 0);
        const pnlColor = pnl >= 0 ? '🟢' : '🔴';

        console.log(`${index + 1}. ${pos.symbol}`);
        console.log(`   Quantity: ${pos.netQty}`);
        console.log(`   Avg Price: ₹${pos.avgPrice}`);
        console.log(`   Current Price: ₹${pos.ltp || 'N/A'}`);
        console.log(`   P&L: ${pnlColor} ₹${pnl.toFixed(2)}`);
        console.log(`   Product: ${pos.productType}`);
        console.log('   ---');
      });
    } else {
      printInfo('No positions found');
    }

  } catch (error) {
    printError(`Failed to fetch positions: ${error.message}`);
  }
}

async function checkBalance() {
  printHeader('Account Balance');

  try {
    const fyersService = new FyersService();
    const funds = await fyersService.getFunds();

    if (funds.s === 'ok' && funds.data) {
      console.log('💰 Account Funds:');

      // Try different possible field names
      const fundData = funds.data;
      const availableFunds = safeExtract(fundData, [
        'fund_limit', 'availablecash', 'available_cash', 'total_balance'
      ]);

      if (availableFunds !== 'N/A') {
        console.log(`   Available: ${formatCurrency(parseFloat(availableFunds))}`);
      }

      // Show all available fields
      console.log('\n📊 All fund details:');
      Object.keys(fundData).forEach(key => {
        if (typeof fundData[key] === 'number') {
          console.log(`   ${key}: ${formatCurrency(fundData[key])}`);
        }
      });

    } else {
      printError(`Failed to fetch funds: ${funds.message}`);
    }

  } catch (error) {
    printError(`Balance check failed: ${error.message}`);
  }
}

async function viewTrades() {
  printHeader('Trade History');

  try {
    const orderService = new OrderService();
    const trades = await orderService.getTradebook();

    if (trades.data && trades.data.tradeBook && trades.data.tradeBook.length > 0) {
      trades.data.tradeBook.forEach((trade, index) => {
        console.log(`${index + 1}. ${trade.symbol}`);
        console.log(`   Side: ${trade.side === 1 ? 'BUY' : 'SELL'}`);
        console.log(`   Quantity: ${trade.qty}`);
        console.log(`   Price: ₹${trade.tradePrice}`);
        console.log(`   Time: ${trade.tradeTime}`);
        console.log(`   Order ID: ${trade.orderNumber}`);
        console.log('   ---');
      });
    } else {
      printInfo('No trades found');
    }

  } catch (error) {
    printError(`Failed to fetch trades: ${error.message}`);
  }
}

async function cancelOrder(orderId) {
  try {
    const orderService = new OrderService();

    console.log(`🗑️ Cancelling order: ${orderId}`);
    const result = await orderService.cancelOrder(orderId);

    if (result.s === 'ok') {
      printSuccess(`Order ${orderId} cancelled successfully`);
    } else {
      printError(`Failed to cancel order: ${result.message}`);
    }

  } catch (error) {
    printError(`Cancel order failed: ${error.message}`);
  }
}

async function cancelAllOrders() {
  printHeader('Cancel All Orders');

  try {
    const orderService = new OrderService();
    const orders = await orderService.getOrders();

    if (orders.data && orders.data.orderBook) {
      const pendingOrders = orders.data.orderBook.filter(
        order => order.status === 'PENDING' || order.status === 'OPEN'
      );

      if (pendingOrders.length === 0) {
        printInfo('No pending orders to cancel');
        return;
      }

      console.log(`Found ${pendingOrders.length} pending orders`);

      for (const order of pendingOrders) {
        try {
          await orderService.cancelOrder(order.id);
          printSuccess(`Cancelled: ${order.symbol} - ${order.id}`);
        } catch (cancelError) {
          printError(`Failed to cancel ${order.id}: ${cancelError.message}`);
        }
      }

      printSuccess('Finished cancelling orders');

    } else {
      printInfo('No orders found');
    }

  } catch (error) {
    printError(`Cancel all failed: ${error.message}`);
  }
}

async function emergencyClose() {
  printHeader('🚨 EMERGENCY: Closing All Positions');

  try {
    const orderService = new OrderService();

    // Get all positions
    const positions = await orderService.getPositions();

    if (positions.data && positions.data.netPositions) {
      const openPositions = positions.data.netPositions.filter(pos => pos.netQty !== 0);

      if (openPositions.length === 0) {
        printInfo('No open positions to close');
        return;
      }

      console.log(`🚨 Closing ${openPositions.length} positions...`);

      for (const position of openPositions) {
        try {
          const closeOrder = await orderService.placeOrder({
            symbol: position.symbol,
            quantity: Math.abs(position.netQty),
            side: position.netQty > 0 ? -1 : 1, // Opposite side
            type: 2, // Market order for immediate execution
            productType: position.productType
          });

          printSuccess(`Closed: ${position.symbol} - Order ID: ${closeOrder.id}`);

        } catch (closeError) {
          printError(`Failed to close ${position.symbol}: ${closeError.message}`);
        }
      }
    }

    // Also cancel all pending orders
    await cancelAllOrders();

    printSuccess('Emergency closure completed');

  } catch (error) {
    printError(`Emergency closure failed: ${error.message}`);
  }
}

async function setStopLoss(symbol, stopPrice) {
  try {
    const orderService = new OrderService();

    // First check if we have a position in this symbol
    const positions = await orderService.getPositions();
    let position = null;

    if (positions.data && positions.data.netPositions) {
      position = positions.data.netPositions.find(pos =>
        pos.symbol.toUpperCase() === symbol.toUpperCase() && pos.netQty !== 0
      );
    }

    if (!position) {
      printError(`No position found for ${symbol}`);
      return;
    }

    console.log(`🛑 Setting stop-loss for ${symbol}:`);
    console.log(`   Current position: ${position.netQty} shares`);
    console.log(`   Stop price: ₹${stopPrice}`);

    const stopOrder = await orderService.placeOrder({
      symbol: symbol.toUpperCase(),
      quantity: Math.abs(position.netQty),
      side: position.netQty > 0 ? -1 : 1, // Opposite side to close position
      type: 4, // Stop-loss market order
      stopPrice: parseFloat(stopPrice),
      productType: position.productType
    });

    if (stopOrder.s === 'ok') {
      printSuccess(`Stop-loss order placed successfully!`);
      console.log(`   Order ID: ${stopOrder.id}`);
    } else {
      printError(`Stop-loss failed: ${stopOrder.message}`);
    }

  } catch (error) {
    printError(`Stop-loss setup failed: ${error.message}`);
  }
}

function calculatePositionSize(accountSize, riskPercent, entryPrice, stopPrice) {
  try {
    const account = parseFloat(accountSize);
    const risk = parseFloat(riskPercent);
    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopPrice);

    if (stop >= entry) {
      printError('Stop price must be below entry price for long positions');
      return;
    }

    const riskAmount = account * (risk / 100);
    const riskPerShare = entry - stop;
    const maxShares = Math.floor(riskAmount / riskPerShare);
    const positionValue = maxShares * entry;

    printHeader('Position Size Calculator');
    console.log(`Account Size: ${formatCurrency(account)}`);
    console.log(`Risk Percentage: ${risk}%`);
    console.log(`Entry Price: ₹${entry}`);
    console.log(`Stop Loss Price: ₹${stop}`);
    console.log('');
    console.log('📈 Results:');
    console.log(`Max Shares: ${maxShares}`);
    console.log(`Position Value: ${formatCurrency(positionValue)}`);
    console.log(`Risk Amount: ${formatCurrency(riskAmount)}`);
    console.log(`Risk Per Share: ₹${riskPerShare.toFixed(2)}`);

  } catch (error) {
    printError(`Position size calculation failed: ${error.message}`);
  }
}

async function startApplication() {
  printHeader('Starting Trading Application');

  try {
    const app = new TradingApp();
    await app.initialize();

    if (app.isRunning) {
      printSuccess('Trading application started successfully');
      console.log('📊 Market Status:', app.getMarketStatus());

      // Start market data feed
      try {
        await app.startMarketDataFeed();
        printSuccess('Market data feed connected');
      } catch (mdError) {
        printWarning(`Market data feed failed: ${mdError.message}`);
      }

      printInfo('Application is running. Use Ctrl+C to stop.');

      // Keep the process running
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down...');
        await app.shutdown();
        process.exit(0);
      });

    } else {
      printError('Failed to start trading application');
    }

  } catch (error) {
    printError(`Application startup failed: ${error.message}`);
  }
}

async function checkApplicationStatus() {
  printHeader('Application Status');

  try {
    // Check if process is running
    const { exec } = require('child_process');
    exec('ps aux | grep "node src/app.js"', (error, stdout) => {
      if (stdout && stdout.includes('src/app.js') && !stdout.includes('grep')) {
        printSuccess('Trading application is running');
      } else {
        printInfo('Trading application is not running');
      }
    });

    // Test API connectivity
    const fyersService = new FyersService();
    const profile = await fyersService.getProfile();

    if (profile.s === 'ok') {
      printSuccess('API connection is healthy');
    } else {
      printError('API connection issues detected');
    }

  } catch (error) {
    printError(`Status check failed: ${error.message}`);
  }
}

function checkMarketStatus() {
  printHeader('Market Status');

  const marketStatus = isMarketOpen();
  const now = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss IST');

  console.log(`🕐 Current Time: ${now}`);
  console.log(`📊 Market Status: ${marketStatus.open ? '🟢 OPEN' : '🔴 CLOSED'}`);
  console.log(`📝 Reason: ${marketStatus.reason}`);

  if (!marketStatus.open) {
    printWarning('Market is closed. Orders may not execute immediately.');
  }
}

async function buyWithTPSLAndMonitor(symbol, quantity, limitPrice, takeProfitPercent = 0.75, stopLossPercent = 0.35) {
  try {
    const orderService = new OrderService();
    
    const price = parseFloat(limitPrice);
    const qty = parseInt(quantity);
    const tpPercent = parseFloat(takeProfitPercent);
    const slPercent = parseFloat(stopLossPercent);
    
    // Calculate TP and SL prices
    const takeProfitPrice = price + (price * tpPercent / 100);
    const stopLossPrice = price - (price * slPercent / 100);
    
    console.log(`🛒 Placing MIS Limit Buy Order with TP/SL + Auto-Cancel:`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Quantity: ${qty}`);
    console.log(`   Limit Price: ₹${price}`);
    console.log(`   Take Profit: ₹${takeProfitPrice.toFixed(2)} (+${tpPercent}%)`);
    console.log(`   Stop Loss: ₹${stopLossPrice.toFixed(2)} (-${slPercent}%)`);
    console.log('');
    
    // Step 1: Place the main buy order
    const buyOrder = await orderService.placeOrder({
      symbol: symbol.toUpperCase(),
      quantity: qty,
      side: 1, // Buy
      type: 1, // Limit order
      limitPrice: price,
      productType: 'INTRADAY',
      validity: 'DAY'
    });
    
    if (buyOrder.s !== 'ok') {
      printError(`❌ Buy order failed: ${buyOrder.message}`);
      return;
    }
    
    printSuccess(`✅ Buy order placed! Order ID: ${buyOrder.id}`);
    
    // Wait for buy order to execute
    console.log('⏳ Waiting for buy order execution...');
    let buyExecuted = false;
    let attempts = 0;
    const maxAttempts = 12; // 2 minutes
    
    while (!buyExecuted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
      
      try {
        const orders = await orderService.getOrders();
        const buyOrderStatus = orders.data?.orderBook?.find(order => order.id === buyOrder.id);
        
        if (buyOrderStatus && (buyOrderStatus.status === 'COMPLETE' || buyOrderStatus.status === 'FILLED')) {
          buyExecuted = true;
          printSuccess(`✅ Buy order executed!`);
          break;
        } else if (buyOrderStatus && buyOrderStatus.status === 'CANCELLED') {
          printError(`❌ Buy order was cancelled`);
          return;
        }
        
        console.log(`⏳ Attempt ${attempts}/${maxAttempts}: Buy order status: ${buyOrderStatus?.status || 'Unknown'}`);
      } catch (error) {
        console.log(`⚠️ Error checking order status: ${error.message}`);
      }
    }
    
    if (!buyExecuted) {
      printWarning(`⚠️ Buy order not executed within 2 minutes. Proceeding anyway...`);
    }
    
    // Step 2: Place Take Profit and Stop Loss orders
    let tpOrderId = null;
    let slOrderId = null;
    
    try {
      const tpOrder = await orderService.placeOrder({
        symbol: symbol.toUpperCase(),
        quantity: qty,
        side: -1, // Sell
        type: 1, // Limit order
        limitPrice: takeProfitPrice,
        productType: 'INTRADAY',
        validity: 'DAY'
      });
      
      if (tpOrder.s === 'ok') {
        tpOrderId = tpOrder.id;
        printSuccess(`✅ Take Profit order placed! Order ID: ${tpOrderId}`);
      }
    } catch (tpError) {
      printError(`❌ Take Profit order failed: ${tpError.message}`);
    }
    
    try {
      const slOrder = await orderService.placeOrder({
        symbol: symbol.toUpperCase(),
        quantity: qty,
        side: -1, // Sell
        type: 4, // Stop-loss market order
        stopPrice: stopLossPrice,
        productType: 'INTRADAY',
        validity: 'DAY'
      });
      
      if (slOrder.s === 'ok') {
        slOrderId = slOrder.id;
        printSuccess(`✅ Stop Loss order placed! Order ID: ${slOrderId}`);
      }
    } catch (slError) {
      printError(`❌ Stop Loss order failed: ${slError.message}`);
    }
    
    if (!tpOrderId || !slOrderId) {
      printError(`❌ Failed to place both TP and SL orders. Manual management required.`);
      return;
    }
    
    // Step 3: Monitor TP and SL orders for execution
    console.log('');
    printSuccess('🎯 Complete order setup finished!');
    console.log('👁️ Starting order monitoring for auto-cancel...');
    console.log('📋 Press Ctrl+C to stop monitoring');
    
    let monitoringActive = true;
    let monitorCount = 0;
    const maxMonitorTime = 360; // 6 hours in 1-minute intervals
    
    const monitor = setInterval(async () => {
      if (!monitoringActive) return;
      
      monitorCount++;
      console.log(`\n🔍 Monitor check ${monitorCount}/${maxMonitorTime} - ${new Date().toLocaleTimeString()}`);
      
      try {
        const orders = await orderService.getOrders();
        const tpOrder = orders.data?.orderBook?.find(order => order.id === tpOrderId);
        const slOrder = orders.data?.orderBook?.find(order => order.id === slOrderId);
        
        // Check if Take Profit was executed
        if (tpOrder && (tpOrder.status === 'COMPLETE' || tpOrder.status === 'FILLED')) {
          printSuccess(`🎯 TAKE PROFIT HIT! Cancelling Stop Loss order...`);
          
          try {
            await orderService.cancelOrder(slOrderId);
            printSuccess(`✅ Stop Loss order cancelled successfully!`);
          } catch (cancelError) {
            printError(`❌ Failed to cancel Stop Loss: ${cancelError.message}`);
          }
          
          monitoringActive = false;
          clearInterval(monitor);
          printSuccess(`🏁 Trade completed with PROFIT! 🎉`);
          return;
        }
        
        // Check if Stop Loss was executed
        if (slOrder && (slOrder.status === 'COMPLETE' || slOrder.status === 'FILLED')) {
          printWarning(`🛑 STOP LOSS HIT! Cancelling Take Profit order...`);
          
          try {
            await orderService.cancelOrder(tpOrderId);
            printSuccess(`✅ Take Profit order cancelled successfully!`);
          } catch (cancelError) {
            printError(`❌ Failed to cancel Take Profit: ${cancelError.message}`);
          }
          
          monitoringActive = false;
          clearInterval(monitor);
          printWarning(`🏁 Trade completed with LOSS. Better luck next time! 💪`);
          return;
        }
        
        // Show current status
        console.log(`   TP Status: ${tpOrder?.status || 'Unknown'}`);
        console.log(`   SL Status: ${slOrder?.status || 'Unknown'}`);
        
        // Stop monitoring after max time
        if (monitorCount >= maxMonitorTime) {
          monitoringActive = false;
          clearInterval(monitor);
          printInfo(`⏰ Monitoring stopped after 6 hours. Orders still active.`);
        }
        
      } catch (error) {
        console.log(`❌ Monitoring error: ${error.message}`);
      }
    }, 60000); // Check every 1 minute
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping monitoring...');
      monitoringActive = false;
      clearInterval(monitor);
      console.log('📋 Orders are still active. Check manually with: node place-order.js orders');
      process.exit(0);
    });
    
  } catch (error) {
    printError(`❌ Order setup failed: ${error.message}`);
  }
}

async function shortSellWithTPSLAndMonitor(symbol, quantity, marketPrice = null, takeProfitPercent = 0.75, stopLossPercent = 0.35) {
  try {
    const orderService = new OrderService();
    
    let price;
    const qty = parseInt(quantity);
    const tpPercent = parseFloat(takeProfitPercent);
    const slPercent = parseFloat(stopLossPercent);
    
    // If marketPrice is provided, use it for calculations, otherwise get current market price
    if (marketPrice) {
      price = parseFloat(marketPrice);
    } else {
      // Get current market price with multiple attempts
      try {
        const fyersService = new FyersService();

        // Try different symbol formats
        const symbolFormats = [
          symbol.toUpperCase(),
          symbol.replace('NSE:', ''),
          `NSE:${symbol.replace('NSE:', '').replace('-EQ', '')}-EQ`
        ];

        let priceFound = false;
        for (const testSymbol of symbolFormats) {
          try {
            console.log(`🔍 Trying to fetch price for: ${testSymbol}`);
            const quotes = await fyersService.getQuotes([testSymbol]);

            if (quotes && quotes.s === 'ok' && quotes.data) {
              const symbolData = quotes.data[testSymbol] || quotes.data[0] || Object.values(quotes.data)[0];
              if (symbolData && symbolData.ltp) {
                price = symbolData.ltp;
                console.log(`📈 Current market price for ${testSymbol}: ₹${price}`);
                priceFound = true;
                break;
              }
            }
          } catch (formatError) {
            console.log(`❌ Format ${testSymbol} failed: ${formatError.message}`);
            continue;
          }
        }

        if (!priceFound) {
          throw new Error('Could not fetch price with any symbol format');
        }
      } catch (priceError) {
        printError(`❌ Could not fetch market price: ${priceError.message}`);
        console.log('');
        console.log('💡 SOLUTIONS:');
        console.log('1. Check if market is open (9:15 AM - 3:30 PM IST)');
        console.log('2. Verify authentication: node examples/auth-setup.js');
        console.log('3. Use manual price instead:');
        console.log(`   node place-order.js short NSE:HDFCBANK-EQ 10 [PRICE] ${tpPercent} ${slPercent}`);
        console.log('4. Try limit order: node place-order.js short NSE:HDFCBANK-EQ 10 1650');
        console.log('');
        printError('Please provide market price manually or fix authentication');
        return;
      }
    }
    
    // Calculate TP and SL prices for SHORT SELLING
    const takeProfitPrice = price - (price * tpPercent / 100);  // Lower price = profit for short
    const stopLossPrice = price + (price * slPercent / 100);    // Higher price = loss for short
    
    console.log(`🔻 Placing SHORT SELL MIS Order at MARKET PRICE with TP/SL + Auto-Cancel:`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Quantity: ${qty}`);
    console.log(`   Market Price (Reference): ₹${price}`);
    console.log(`   Order Type: MARKET ORDER`);
    console.log(`   Take Profit (Buy Back): ₹${takeProfitPrice.toFixed(2)} (-${tpPercent}%) = Profit: ₹${(price - takeProfitPrice).toFixed(2)} per share`);
    console.log(`   Stop Loss (Buy Back): ₹${stopLossPrice.toFixed(2)} (+${slPercent}%) = Loss: ₹${(stopLossPrice - price).toFixed(2)} per share`);
    console.log('');
    
    // Step 1: Place the SHORT SELL MARKET order
    const shortOrder = await orderService.placeOrder({
      symbol: symbol.toUpperCase(),
      quantity: qty,
      side: -1, // SELL (Short position)
      type: 2,  // MARKET order (changed from limit)
      productType: 'INTRADAY',
      validity: 'DAY'
    });
    
    if (shortOrder.s !== 'ok') {
      printError(`❌ Short sell market order failed: ${shortOrder.message}`);
      return;
    }
    
    printSuccess(`✅ Short sell MARKET order placed! Order ID: ${shortOrder.id}`);
    
    // Wait for short order to execute (market orders usually execute immediately)
    console.log('⏳ Waiting for short sell market order execution...');
    let shortExecuted = false;
    let actualExecutionPrice = price; // Default to reference price
    let attempts = 0;
    const maxAttempts = 6; // 1 minute for market orders
    
    while (!shortExecuted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
      
      try {
        const orders = await orderService.getOrders();
        const shortOrderStatus = orders.data?.orderBook?.find(order => order.id === shortOrder.id);
        
        if (shortOrderStatus && (shortOrderStatus.status === 'COMPLETE' || shortOrderStatus.status === 'FILLED')) {
          shortExecuted = true;
          // Try to get actual execution price
          actualExecutionPrice = shortOrderStatus.tradedPrice || shortOrderStatus.avgPrice || price;
          
          printSuccess(`✅ Short sell market order executed at ₹${actualExecutionPrice}!`);
          printSuccess(`📊 You are now SHORT ${qty} shares`);
          
          // Recalculate TP/SL based on actual execution price
          const newTakeProfitPrice = actualExecutionPrice - (actualExecutionPrice * tpPercent / 100);
          const newStopLossPrice = actualExecutionPrice + (actualExecutionPrice * slPercent / 100);
          
          console.log(`🔄 Recalculating TP/SL based on actual execution price:`);
          console.log(`   New Take Profit: ₹${newTakeProfitPrice.toFixed(2)}`);
          console.log(`   New Stop Loss: ₹${newStopLossPrice.toFixed(2)}`);
          
          // Update prices for TP/SL orders
          price = actualExecutionPrice;
          break;
        } else if (shortOrderStatus && shortOrderStatus.status === 'CANCELLED') {
          printError(`❌ Short sell market order was cancelled`);
          return;
        }
        
        console.log(`⏳ Attempt ${attempts}/${maxAttempts}: Market order status: ${shortOrderStatus?.status || 'Unknown'}`);
      } catch (error) {
        console.log(`⚠️ Error checking order status: ${error.message}`);
      }
    }
    
    if (!shortExecuted) {
      printWarning(`⚠️ Market order status unclear. Proceeding with TP/SL placement...`);
    }
    
    // Recalculate TP/SL based on final execution price
    const finalTakeProfitPrice = price - (price * tpPercent / 100);
    const finalStopLossPrice = price + (price * slPercent / 100);
    
    // Step 2: Place Take Profit and Stop Loss orders (Both are BUY orders to cover the short)
    let tpOrderId = null;
    let slOrderId = null;
    
    try {
      // Take Profit: Buy back at lower price (profit for short position)
      const tpOrder = await orderService.placeOrder({
        symbol: symbol.toUpperCase(),
        quantity: qty,
        side: 1,  // BUY (to cover short position)
        type: 1,  // Limit order
        limitPrice: finalTakeProfitPrice,
        productType: 'INTRADAY',
        validity: 'DAY'
      });
      
      if (tpOrder.s === 'ok') {
        tpOrderId = tpOrder.id;
        printSuccess(`✅ Take Profit order placed! Order ID: ${tpOrderId} (Buy back at ₹${finalTakeProfitPrice.toFixed(2)})`);
      }
    } catch (tpError) {
      printError(`❌ Take Profit order failed: ${tpError.message}`);
    }
    
    try {
      // Stop Loss: Buy back at higher price (loss for short position)
      const slOrder = await orderService.placeOrder({
        symbol: symbol.toUpperCase(),
        quantity: qty,
        side: 1,  // BUY (to cover short position)
        type: 4,  // Stop-loss market order
        stopPrice: finalStopLossPrice,
        productType: 'INTRADAY',
        validity: 'DAY'
      });
      
      if (slOrder.s === 'ok') {
        slOrderId = slOrder.id;
        printSuccess(`✅ Stop Loss order placed! Order ID: ${slOrderId} (Buy back at ₹${finalStopLossPrice.toFixed(2)})`);
      }
    } catch (slError) {
      printError(`❌ Stop Loss order failed: ${slError.message}`);
    }
    
    if (!tpOrderId || !slOrderId) {
      printError(`❌ Failed to place both TP and SL orders. Manual management required.`);
      return;
    }
    
    // Step 3: Monitor TP and SL orders for execution and auto-cancel
    console.log('');
    printSuccess('🎯 Complete SHORT SELL MARKET ORDER setup finished!');
    console.log('👁️ Starting order monitoring for auto-cancel...');
    console.log('📋 Press Ctrl+C to stop monitoring');
    console.log('');
    console.log('📊 SHORT POSITION SUMMARY:');
    console.log(`   Entry: SHORT ${qty} shares at ₹${price} (MARKET ORDER)`);
    console.log(`   Target Profit: ₹${(price - finalTakeProfitPrice).toFixed(2)} per share = ₹${((price - finalTakeProfitPrice) * qty).toFixed(2)} total`);
    console.log(`   Maximum Loss: ₹${(finalStopLossPrice - price).toFixed(2)} per share = ₹${((finalStopLossPrice - price) * qty).toFixed(2)} total`);
    console.log('');
    
    // Continue with the same monitoring logic as before...
    let monitoringActive = true;
    let monitorCount = 0;
    const maxMonitorTime = 360; // 6 hours in 1-minute intervals
    
    const monitor = setInterval(async () => {
      if (!monitoringActive) return;
      
      monitorCount++;
      console.log(`\n🔍 Monitor check ${monitorCount}/${maxMonitorTime} - ${new Date().toLocaleTimeString()}`);
      
      try {
        const orders = await orderService.getOrders();
        const tpOrder = orders.data?.orderBook?.find(order => order.id === tpOrderId);
        const slOrder = orders.data?.orderBook?.find(order => order.id === slOrderId);
        
        // Check if Take Profit was executed
        if (tpOrder && (tpOrder.status === 'COMPLETE' || tpOrder.status === 'FILLED')) {
          const profit = (price - finalTakeProfitPrice) * qty;
          printSuccess(`🎯 TAKE PROFIT HIT! Short covered at ₹${finalTakeProfitPrice.toFixed(2)}`);
          printSuccess(`💰 PROFIT REALIZED: ₹${profit.toFixed(2)} (₹${(price - finalTakeProfitPrice).toFixed(2)} per share)`);
          
          console.log('🗑️ Cancelling Stop Loss order...');
          try {
            await orderService.cancelOrder(slOrderId);
            printSuccess(`✅ Stop Loss order cancelled successfully!`);
          } catch (cancelError) {
            printError(`❌ Failed to cancel Stop Loss: ${cancelError.message}`);
          }
          
          monitoringActive = false;
          clearInterval(monitor);
          printSuccess(`🏁 SHORT TRADE COMPLETED WITH PROFIT! 🎉💰`);
          return;
        }
        
        // Check if Stop Loss was executed
        if (slOrder && (slOrder.status === 'COMPLETE' || slOrder.status === 'FILLED')) {
          const loss = (finalStopLossPrice - price) * qty;
          printWarning(`🛑 STOP LOSS HIT! Short covered at ₹${finalStopLossPrice.toFixed(2)}`);
          printWarning(`📉 LOSS REALIZED: ₹${loss.toFixed(2)} (₹${(finalStopLossPrice - price).toFixed(2)} per share)`);
          
          console.log('🗑️ Cancelling Take Profit order...');
          try {
            await orderService.cancelOrder(tpOrderId);
            printSuccess(`✅ Take Profit order cancelled successfully!`);
          } catch (cancelError) {
            printError(`❌ Failed to cancel Take Profit: ${cancelError.message}`);
          }
          
          monitoringActive = false;
          clearInterval(monitor);
          printWarning(`🏁 SHORT TRADE COMPLETED WITH LOSS. Risk managed! 💪`);
          return;
        }
        
        // Show current status
        console.log(`   TP Status: ${tpOrder?.status || 'Unknown'} (Buy at ₹${finalTakeProfitPrice.toFixed(2)})`);
        console.log(`   SL Status: ${slOrder?.status || 'Unknown'} (Buy at ₹${finalStopLossPrice.toFixed(2)})`);
        
        // Show current position P&L if possible
        try {
          const positions = await orderService.getPositions();
          const currentPosition = positions.data?.netPositions?.find(pos => 
            pos.symbol.toUpperCase() === symbol.toUpperCase() && pos.netQty < 0
          );
          
          if (currentPosition) {
            const currentPrice = currentPosition.ltp || price;
            const unrealizedPnL = (price - currentPrice) * Math.abs(currentPosition.netQty);
            const pnlColor = unrealizedPnL >= 0 ? '🟢' : '🔴';
            console.log(`   Current Price: ₹${currentPrice} | Unrealized P&L: ${pnlColor} ₹${unrealizedPnL.toFixed(2)}`);
          }
        } catch (posError) {
          // Ignore position fetch errors
        }
        
        // Stop monitoring after max time
        if (monitorCount >= maxMonitorTime) {
          monitoringActive = false;
          clearInterval(monitor);
          printInfo(`⏰ Monitoring stopped after 6 hours. Orders still active.`);
        }
        
      } catch (error) {
        console.log(`❌ Monitoring error: ${error.message}`);
      }
    }, 60000); // Check every 1 minute
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping monitoring...');
      monitoringActive = false;
      clearInterval(monitor);
      console.log('📋 Orders are still active. Check manually with: node place-order.js orders');
      console.log('📊 Check positions with: node place-order.js positions');
      process.exit(0);
    });
    
  } catch (error) {
    printError(`❌ Short sell setup failed: ${error.message}`);
  }
}

async function monitorSystem() {
  printHeader('Real-time Monitoring (30 seconds)');

  let count = 0;
  const maxCount = 6; // 6 iterations = 3 minutes

  const monitor = setInterval(async () => {
    try {
      console.log(`\n📊 Update ${++count}/${maxCount} - ${new Date().toLocaleTimeString()}`);

      // Check positions
      const orderService = new OrderService();
      const positions = await orderService.getPositions();

      if (positions.data && positions.data.netPositions) {
        const openPositions = positions.data.netPositions.filter(pos => pos.netQty !== 0);
        console.log(`📈 Open Positions: ${openPositions.length}`);

        openPositions.forEach(pos => {
          const pnl = parseFloat(pos.pl || 0);
          const pnlColor = pnl >= 0 ? '🟢' : '🔴';
          console.log(`   ${pos.symbol}: ${pos.netQty} @ ₹${pos.avgPrice} ${pnlColor} ₹${pnl.toFixed(2)}`);
        });
      }

      // Check orders
      const orders = await orderService.getOrders();
      if (orders.data && orders.data.orderBook) {
        const pendingOrders = orders.data.orderBook.filter(
          order => order.status === 'PENDING' || order.status === 'OPEN'
        );
        console.log(`📋 Pending Orders: ${pendingOrders.length}`);
      }

      if (count >= maxCount) {
        clearInterval(monitor);
        printInfo('Monitoring completed');
      }

    } catch (error) {
      printError(`Monitoring error: ${error.message}`);
    }
  }, 30000); // 30 seconds

  printInfo('Monitoring started... Press Ctrl+C to stop early');
}

function viewLogs(level = 'all') {
  printHeader(`Application Logs (${level})`);

  try {
    const logFile = level === 'error' ? 'logs/error.log' : 'logs/combined.log';

    if (!fs.existsSync(logFile)) {
      printError(`Log file ${logFile} not found`);
      return;
    }

    const { spawn } = require('child_process');
    const tail = spawn('tail', ['-50', logFile]);

    tail.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          if (level === 'error' && line.includes('error')) {
            console.log(`❌ ${line}`);
          } else if (level === 'info' && line.includes('info')) {
            console.log(`ℹ️ ${line}`);
          } else if (level === 'debug' && line.includes('debug')) {
            console.log(`🔍 ${line}`);
          } else if (level === 'all') {
            console.log(line);
          }
        }
      });
    });

    tail.on('close', () => {
      printInfo('Log viewing completed');
    });

  } catch (error) {
    printError(`Log viewing failed: ${error.message}`);
  }
}

// Main execution logic
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const isDryRun = args.includes('--dry-run');
  const isHelp = args.includes('--help');

  if (!command || command === 'help' || isHelp) {
    await showHelp();
    return;
  }

  if (isDryRun) {
    console.log('🧪 DRY RUN MODE - No actual orders will be placed\n');
  }

  try {
    switch (command.toLowerCase()) {
      case 'verify':
        await verifyEnvironment();
        break;

      case 'holdings':
        await getHoldings();
        break;

      case 'test-connection':
        await testConnection();
        break;

      case 'start':
        await startApplication();
        break;

      case 'status':
        await checkApplicationStatus();
        break;

      case 'stop':
        console.log('🛑 Stopping application...');
        exec('pkill -f "node src/app.js"', (error, stdout, stderr) => {
          if (error) {
            printError('Failed to stop application');
          } else {
            printSuccess('Application stopped');
          }
        });
        break;

      case 'buy':
        if (args.length < 3) {
          printError('Usage: node place-order.js buy <symbol> <quantity> [price]');
          console.log('Example: node place-order.js buy NSE:SBIN-EQ 1');
          console.log('Example: node place-order.js buy NSE:TCS-EQ 2 3500');
          return;
        }
        if (!isDryRun) {
          await buyOrder(args[1], args[2], args[3]);
        } else {
          console.log(`Would place BUY order: ${args[1]} x${args[2]} ${args[3] ? '@₹' + args[3] : '(MARKET)'}`);
        }
        break;

      case 'mis-trade':
        if (args.length < 4) {
          printError('Usage: node place-order.js mis-trade <symbol> <quantity> <limit_price> [tp_percent] [sl_percent]');
          console.log('Example: node place-order.js mis-trade NSE:SBIN-EQ 10 500 0.75 0.35');
          console.log('This will place MIS order with auto-cancel when TP or SL hits');
          return;
        }
        const tpPercent = args[4] || 0.75;
        const slPercent = args[5] || 0.35;
        if (!isDryRun) {
          await buyWithTPSLAndMonitor(args[1], args[2], args[3], tpPercent, slPercent);
        } else {
          const price = parseFloat(args[3]);
          const tp = price + (price * parseFloat(tpPercent) / 100);
          const sl = price - (price * parseFloat(slPercent) / 100);
          console.log(`Would place complete MIS trade: ${args[1]} x${args[2]} @₹${price}`);
          console.log(`Take Profit: ₹${tp.toFixed(2)} (+${tpPercent}%)`);
          console.log(`Stop Loss: ₹${sl.toFixed(2)} (-${slPercent}%)`);
          console.log(`With auto-cancel monitoring enabled`);
        }
        break;

      case 'short-market':
      case 'short-m':
        if (args.length < 3) {
          printError('Usage: node place-order.js short-market <symbol> <quantity> [tp_percent] [sl_percent]');
          console.log('Example: node place-order.js short-market NSE:SBIN-EQ 10 0.75 0.35');
          return;
        }
        const marketTpPercent = args[3] || 0.75;
        const marketSlPercent = args[4] || 0.35;
        if (!isDryRun) {
          await shortSellWithTPSLAndMonitor(args[1], args[2], null, marketTpPercent, marketSlPercent);
        } else {
          console.log(`Would place SHORT SELL MARKET ORDER: ${args[1]} x${args[2]}`);
          console.log(`TP: -${marketTpPercent}% | SL: +${marketSlPercent}%`);
        }
        break;

      case 'short-limit':
      case 'short-l':
        if (args.length < 4) {
          printError('Usage: node place-order.js short-limit <symbol> <quantity> <limit_price> [tp_percent] [sl_percent]');
          console.log('Example: node place-order.js short-limit NSE:SBIN-EQ 10 500 0.75 0.35');
          return;
        }
        const limitTpPercent = args[4] || 0.75;
        const limitSlPercent = args[5] || 0.35;
        if (!isDryRun) {
          await shortSellWithTPSLAndMonitor(args[1], args[2], args[3], limitTpPercent, limitSlPercent);
        } else {
          const price = parseFloat(args[3]);
          const tp = price - (price * parseFloat(limitTpPercent) / 100);
          const sl = price + (price * parseFloat(limitSlPercent) / 100);
          console.log(`Would place SHORT SELL LIMIT ORDER: ${args[1]} x${args[2]} @₹${price}`);
          console.log(`Take Profit: ₹${tp.toFixed(2)} | Stop Loss: ₹${sl.toFixed(2)}`);
        }
        break;

      case 'sell':
        if (args.length < 3) {
          printError('Usage: node place-order.js sell <symbol> <quantity> [price]');
          console.log('Example: node place-order.js sell NSE:SBIN-EQ 1');
          console.log('Example: node place-order.js sell NSE:TCS-EQ 2 3500');
          return;
        }
        if (!isDryRun) {
          await sellOrder(args[1], args[2], args[3]);
        } else {
          console.log(`Would place SELL order: ${args[1]} x${args[2]} ${args[3] ? '@₹' + args[3] : '(MARKET)'}`);
        }
        break;

      case 'orders':
        await viewOrders();
        break;

      case 'positions':
        await viewPositions();
        break;

      case 'balance':
        await checkBalance();
        break;

      case 'trades':
        await viewTrades();
        break;

      case 'cancel':
        if (args.length < 2) {
          printError('Usage: node place-order.js cancel <order_id>');
          console.log('Example: node place-order.js cancel ORD123456');
          return;
        }
        if (!isDryRun) {
          await cancelOrder(args[1]);
        } else {
          console.log(`Would cancel order: ${args[1]}`);
        }
        break;

      case 'cancel-all':
        if (!isDryRun) {
          await cancelAllOrders();
        } else {
          console.log('Would cancel all pending orders');
        }
        break;

      case 'emergency-close':
        if (!isDryRun) {
          console.log('⚠️ This will close ALL positions immediately!');
          console.log('Press Ctrl+C within 5 seconds to cancel...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          await emergencyClose();
        } else {
          console.log('Would close all positions immediately');
        }
        break;

      case 'stop-loss':
        if (args.length < 3) {
          printError('Usage: node place-order.js stop-loss <symbol> <price>');
          console.log('Example: node place-order.js stop-loss NSE:SBIN-EQ 480');
          return;
        }
        if (!isDryRun) {
          await setStopLoss(args[1], args[2]);
        } else {
          console.log(`Would set stop-loss for ${args[1]} at ₹${args[2]}`);
        }
        break;

      case 'position-size':
        if (args.length < 5) {
          printError('Usage: node place-order.js position-size <account_size> <risk_percent> <entry_price> <stop_price>');
          console.log('Example: node place-order.js position-size 100000 2 500 485');
          return;
        }
        calculatePositionSize(args[1], args[2], args[3], args[4]);
        break;

      case 'monitor':
        await monitorSystem();
        break;

      case 'logs':
        const logLevel = args[1] || 'all';
        viewLogs(logLevel);
        break;

      case 'market-status':
        checkMarketStatus();
        break;

      default:
        printError(`Unknown command: ${command}`);
        console.log('Run "node place-order.js help" for available commands');
        break;
    }

  } catch (error) {
    printError(`Command execution failed: ${error.message}`);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your .env file has correct FYERS_ACCESS_TOKEN');
    console.log('2. Verify market is open (9:15 AM - 3:30 PM IST)');
    console.log('3. Ensure sufficient funds in account');
    console.log('4. Run "node place-order.js verify" to check setup');
  }
}

// Execute main function if this file is run directly
if (require.main === module) {
  main().catch(error => {
    printError(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  showHelp,
  verifyEnvironment,
  testConnection,
  buyOrder,
  sellOrder,
  viewOrders,
  viewPositions,
  checkBalance,
  viewTrades,
  cancelOrder,
  cancelAllOrders,
  emergencyClose,
  setStopLoss,
  calculatePositionSize,
  startApplication,
  checkApplicationStatus,
  checkMarketStatus,
  monitorSystem,
  viewLogs,
  getHoldings
};
