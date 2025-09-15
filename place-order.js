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
// Import the calculator
const { requiredTPpercent, requiredTPpercentShort } = require('./requiredTakeProfit');

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

async function buyWithOptimalTPSL(symbol, quantity, limitPrice, ATR) {
  const price = parseFloat(limitPrice);
  const qty = parseInt(quantity);
  const atrValue = parseFloat(ATR);

  // Parameter validation
  if (!price || price <= 0) {
    throw new Error('Limit price must be a positive number');
  }
  if (!qty || qty <= 0) {
    throw new Error('Quantity must be a positive number');
  }
  if (!ATR || isNaN(atrValue) || atrValue < 0) {
    throw new Error('ATR is required and must be a non-negative number');
  }

  // Use ATR-based calculation only
  const result = requiredTPpercent({
    P: price,
    Q: qty,
    ATR: atrValue
  });

  const actualStopLossPercent = result.calculatedStopLossPercent * 100; // Convert to percentage
  const optimalTPPercent = result.required_g * 100; // Convert back to percentage

  console.log(`📊 Risk-Optimized Trade Setup (ATR-based):`);
  console.log(`   ATR: ${atrValue} | Calculated Stop Loss: ${actualStopLossPercent.toFixed(3)}%`);
  console.log(`   Stop Loss Price: ₹${result.stopLossPrice.toFixed(2)}`);
  console.log(`   Optimal Take Profit: ${optimalTPPercent.toFixed(2)}%`);
  console.log(`   Expected Net Loss if SL hits: ₹${result.netLoss.toFixed(2)}`);
  console.log(`   Target Net Profit if TP hits: ₹${(2 * result.netLoss).toFixed(2)}`);

  // Use calculated optimal percentages
  // await buyWithTPSLAndMonitor(symbol, quantity, limitPrice, optimalTPPercent, actualStopLossPercent);

  // Calculate TP and SL prices
  const takeProfitPrice = price + (price * optimalTPPercent / 100);
  const stopLossPrice = result.stopLossPrice;

  console.log('=========================================');
  console.log(`🛒 Details of Limit Buy Order with TP/SL:`);
  console.log(`   Symbol: ${symbol}`);
  console.log(`   Quantity: ${qty}`);
  console.log(`   Limit Price: ₹${price}`);
  console.log(`   Take Profit: ₹${takeProfitPrice.toFixed(2)} (+${optimalTPPercent.toFixed(2)}%)`);
  console.log(`   Stop Loss: ₹${stopLossPrice.toFixed(2)} (-${actualStopLossPercent.toFixed(3)}%)`);
  console.log(`   Calculation Method: ATR-based`);
  console.log('');
}

async function shortSellWithOptimalTPSL(symbol, quantity, limitPrice, ATR) {
  const price = parseFloat(limitPrice);
  const qty = parseInt(quantity);
  const atrValue = parseFloat(ATR);

  // Parameter validation
  if (!price || price <= 0) {
    throw new Error('Limit price must be a positive number');
  }
  if (!qty || qty <= 0) {
    throw new Error('Quantity must be a positive number');
  }
  if (!ATR || isNaN(atrValue) || atrValue < 0) {
    throw new Error('ATR is required and must be a non-negative number');
  }

  // Use ATR-based calculation for short selling
  const result = requiredTPpercentShort({
    P: price,
    Q: qty,
    ATR: atrValue
  });

  const actualStopLossPercent = result.calculatedStopLossPercent * 100; // Convert to percentage
  const optimalTPPercent = result.required_g * 100; // Convert back to percentage

  console.log(`📊 Risk-Optimized SHORT SELL Setup (ATR-based):`);
  console.log(`   ATR: ${atrValue} | Calculated Stop Loss: ${actualStopLossPercent.toFixed(3)}%`);
  console.log(`   Stop Loss Price: ₹${result.stopLossPrice.toFixed(2)} (buy back ABOVE entry)`);
  console.log(`   Optimal Take Profit: ${optimalTPPercent.toFixed(2)}%`);
  console.log(`   Take Profit Price: ₹${result.takeProfitPrice.toFixed(2)} (buy back BELOW entry)`);
  console.log(`   Expected Net Loss if SL hits: ₹${result.netLoss.toFixed(2)}`);
  console.log(`   Target Net Profit if TP hits: ₹${(2 * result.netLoss).toFixed(2)}`);

  // Use calculated optimal percentages
  // await shortSellWithTPSLAndMonitor(symbol, quantity, limitPrice, optimalTPPercent, actualStopLossPercent);

  // Calculate TP and SL prices for short selling
  const takeProfitPrice = result.takeProfitPrice;  // Buy back at lower price
  const stopLossPrice = result.stopLossPrice;     // Buy back at higher price

  console.log('=========================================');
  console.log(`🛒 Details of SHORT SELL Limit Order with TP/SL:`);
  console.log(`   Symbol: ${symbol}`);
  console.log(`   Quantity: ${qty}`);
  console.log(`   Limit Price: ₹${price} (SHORT SELL)`);
  console.log(`   Take Profit: ₹${takeProfitPrice.toFixed(2)} (-${optimalTPPercent.toFixed(2)}%) [BUY BACK]`);
  console.log(`   Stop Loss: ₹${stopLossPrice.toFixed(2)} (+${actualStopLossPercent.toFixed(3)}%) [BUY BACK]`);
  console.log(`   Calculation Method: ATR-based`);
  console.log('');
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
    console.log('🔍 Fetching positions from API...');
    
    const positions = await orderService.getPositions();
    
    console.log('📊 Raw API Response:');
    console.log(JSON.stringify(positions, null, 2));
    
    console.log('\n🔍 Checking different data paths:');
    console.log('positions.data:', positions.data);
    console.log('positions.data?.netPositions:', positions.data?.netPositions);
    console.log('positions.data?.positions:', positions.data?.positions);
    console.log('positions.data?.overall:', positions.data?.overall);

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
      printInfo('No positions found in expected format');
      
      // Try alternative API call
      console.log('\n🔄 Trying alternative: getHoldings()...');
      try {
        const holdings = await orderService.getHoldings();
        console.log('📊 Holdings Response:');
        console.log(JSON.stringify(holdings, null, 2));
      } catch (holdingsError) {
        console.log(`❌ Holdings failed: ${holdingsError.message}`);
      }
    }

  } catch (error) {
    printError(`Failed to fetch positions: ${error.message}`);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check if you have INTRADAY positions vs CNC positions');
    console.log('2. Try: node place-order.js holdings');
    console.log('3. Verify API token is valid');
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

async function cancelIntradayOrders() {
  try {
    const orderService = new OrderService();
    const orders = await orderService.getOrders();

    if (orders.data && orders.data.orderBook) {
      const intradayPendingOrders = orders.data.orderBook.filter(
        order => (order.status === 'PENDING' || order.status === 'OPEN') &&
                 (order.productType === 'INTRADAY' || order.productType === 'MIS')
      );

      if (intradayPendingOrders.length === 0) {
        printInfo('No pending INTRADAY orders to cancel');
        return;
      }

      console.log(`Found ${intradayPendingOrders.length} pending INTRADAY orders`);

      for (const order of intradayPendingOrders) {
        try {
          await orderService.cancelOrder(order.id);
          printSuccess(`Cancelled INTRADAY order: ${order.symbol} - ${order.id}`);
        } catch (cancelError) {
          printError(`Failed to cancel ${order.id}: ${cancelError.message}`);
        }
      }

      printSuccess('Finished cancelling INTRADAY orders');

    } else {
      printInfo('No orders found');
    }

  } catch (error) {
    printError(`Cancel INTRADAY orders failed: ${error.message}`);
  }
}

async function emergencyClose() {
  printHeader('🚨 EMERGENCY: Closing All INTRADAY Positions');

  try {
    const orderService = new OrderService();

    console.log('🔍 Fetching positions...');
    const positions = await orderService.getPositions();
    
    // Fix: Check the correct path - positions.netPositions (not positions.data.netPositions)
    let allPositions = [];
    
    if (positions.netPositions) {
      allPositions = positions.netPositions;
    } else if (positions.data?.netPositions) {
      allPositions = positions.data.netPositions;
    } else if (positions.data?.positions) {
      allPositions = positions.data.positions;
    }

    // Filter for OPEN INTRADAY positions only (netQty !== 0)
    const intradayPositions = allPositions.filter(pos => 
      pos.netQty !== 0 && 
      (pos.productType === 'INTRADAY' || pos.productType === 'MIS')
    );

    console.log(`📋 Total positions: ${allPositions.length}`);
    console.log(`🎯 OPEN INTRADAY positions: ${intradayPositions.length}`);

    if (intradayPositions.length === 0) {
      printInfo('No open INTRADAY positions found');
    } else {
      // Show positions to be closed
      console.log('\n📊 Positions to close:');
      intradayPositions.forEach(pos => {
        console.log(`   ${pos.symbol}: ${pos.netQty} shares @ ₹${pos.netAvg} (P&L: ₹${pos.pl.toFixed(2)})`);
      });

      console.log(`\n🚨 Closing ${intradayPositions.length} INTRADAY positions...`);

      for (const position of intradayPositions) {
        try {
          console.log(`🔄 Closing ${position.symbol} (${position.netQty} shares)...`);
          
          const closeOrder = await orderService.placeOrder({
            symbol: position.symbol,
            quantity: Math.abs(position.netQty),
            side: position.netQty > 0 ? -1 : 1, // Opposite side
            type: 2, // Market order for immediate execution
            productType: 'INTRADAY'
          });

          if (closeOrder.s === 'ok') {
            printSuccess(`✅ Closed: ${position.symbol} - Order ID: ${closeOrder.id}`);
          } else {
            printError(`❌ Failed to close ${position.symbol}: ${closeOrder.message}`);
          }

        } catch (closeError) {
          printError(`❌ Failed to close ${position.symbol}: ${closeError.message}`);
        }
      }
    }

    // Cancel only INTRADAY pending orders
    console.log('\n🗑️ Cancelling INTRADAY pending orders...');
    await cancelIntradayOrders();

    printSuccess('✅ INTRADAY emergency closure completed');

  } catch (error) {
    printError(`❌ Emergency closure failed: ${error.message}`);
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
    
    // Helper function to round to nearest rupee
    function roundToNearestRupee(price) {
      return Math.round(price);
    }
    
    // Calculate TP and SL prices with rupee rounding
    const rawTakeProfitPrice = price + (price * tpPercent / 100);
    const rawStopLossPrice = price - (price * slPercent / 100);
    
    const takeProfitPrice = roundToNearestRupee(rawTakeProfitPrice);
    const stopLossPrice = roundToNearestRupee(rawStopLossPrice);
    
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
    
    // Wait for buy order execution
    console.log('⏳ Waiting for buy order execution...');
    let buyExecuted = false;
    let attempts = 0;
    const maxAttempts = 3; // 2 minutes
    
    while (!buyExecuted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
      
      try {
        const orders = await orderService.getOrders();
        const buyOrderStatus = orders.data?.orderBook?.find(o => o.id === buyOrder.id);
        
        if (buyOrderStatus && (buyOrderStatus.status === 'COMPLETE' || buyOrderStatus.status === 'FILLED')) {
          buyExecuted = true;
          printSuccess(`✅ Buy order executed at ₹${buyOrderStatus.tradedPrice || price}`);
          break;
        }
        
        console.log(`⏳ Buy order still pending... (${attempts}/${maxAttempts})`);
      } catch (error) {
        console.log(`❌ Error checking order status: ${error.message}`);
      }
    }
    
    if (!buyExecuted) {
      printWarning(`⚠️ Buy order not executed within 2 minutes. Proceeding anyway...`);
    }
    
    // Step 2: Place Take Profit and Stop Loss orders
    let tpOrderId = null;
    let slOrderId = null;
    
    try {
      // Take Profit Order - FIXED: Proper limit order
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
      // Stop Loss Order - Type 3 (Stop-Loss Limit) with correct price structure
      const triggerPrice = stopLossPrice + 0.50; // Trigger 50 paise above limit price
      const limitPrice = stopLossPrice;          // Minimum acceptable sell price
      
      console.log(`DEBUG - Stop Loss Values:`);
      console.log(`   Trigger Price (stopPrice): ₹${triggerPrice}`);
      console.log(`   Limit Price (limitPrice): ₹${limitPrice}`);
      
      const slOrder = await orderService.placeOrder({
        symbol: symbol.toUpperCase(),
        quantity: qty,
        side: -1, // Sell
        type: 3, // Stop-loss limit order
        stopPrice: triggerPrice,  // ₹378.50 - Activates the order
        limitPrice: limitPrice,   // ₹378.00 - Minimum sell price
        productType: 'INTRADAY',
        validity: 'DAY'
      });
      
      if (slOrder.s === 'ok') {
        slOrderId = slOrder.id;
        printSuccess(`✅ Stop Loss limit order placed! Order ID: ${slOrderId}`);
        console.log(`   Trigger: ₹${triggerPrice} | Min Sell: ₹${limitPrice}`);
        console.log(`   ⚠️ Note: Limit order - may not execute in fast-falling market`);
      }
    } catch (slError) {
      printError(`❌ Stop Loss order failed: ${slError.message}`);
      printError(`=.repeat(60)`);
      printError(`Place a Manual Stop-Loss with Limit Price ${limitPrice}`);
      printError(`=.repeat(60)`);

    }

    // Step 3: Start monitoring and auto-cancel
    console.log('');
    printSuccess(`🎯 All orders placed successfully! Starting monitoring...`);
    console.log(`📊 Monitoring will auto-cancel opposite order when TP or SL executes`);
    console.log(`⏹️ Press Ctrl+C to stop monitoring (orders remain active)`);
    console.log('');
    
    let monitoringActive = true;
    let monitorCount = 0;
    const maxMonitorTime = 360; // 6 hours
    
    const monitor = setInterval(async () => {
      if (!monitoringActive) return;
      
      monitorCount++;
      
      try {
        const orders = await orderService.getOrders();
        const tpOrder = orders.data?.orderBook?.find(o => o.id === tpOrderId);
        const slOrder = orders.data?.orderBook?.find(o => o.id === slOrderId);
        
        // Check if TP executed
        if (tpOrder && (tpOrder.status === 'COMPLETE' || tpOrder.status === 'FILLED')) {
          printSuccess(`🎯 Take Profit executed at ₹${tpOrder.tradedPrice || takeProfitPrice}!`);
          
          // Cancel SL order
          try {
            await orderService.cancelOrder(slOrderId);
            printSuccess(`✅ Stop Loss order auto-cancelled`);
          } catch (cancelError) {
            printWarning(`⚠️ Could not cancel SL order: ${cancelError.message}`);
          }
          
          monitoringActive = false;
          clearInterval(monitor);
          printSuccess(`🏆 Trade completed successfully with PROFIT!`);
          return;
        }
        
        // Check if SL executed
        if (slOrder && (slOrder.status === 'COMPLETE' || slOrder.status === 'FILLED')) {
          printWarning(`🛑 Stop Loss executed at ₹${slOrder.tradedPrice || stopLossPrice}!`);
          
          // Cancel TP order
          try {
            await orderService.cancelOrder(tpOrderId);
            printSuccess(`✅ Take Profit order auto-cancelled`);
          } catch (cancelError) {
            printWarning(`⚠️ Could not cancel TP order: ${cancelError.message}`);
          }
          
          monitoringActive = false;
          clearInterval(monitor);
          printWarning(`📉 Trade completed with LOSS. Better luck next time!`);
          return;
        }
        
        // Periodic status update
        if (monitorCount % 5 === 0) { // Every 5 minutes
          console.log(`📊 Monitoring active... TP: ${tpOrder?.status || 'Unknown'} | SL: ${slOrder?.status || 'Unknown'} (${monitorCount}/360)`);
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
    
    // Helper function to round to nearest rupee
    function roundToNearestRupee(price) {
      return Math.round(price);
    }
    
    // Calculate TP and SL prices for SHORT SELLING with rupee rounding
    const rawTakeProfitPrice = price - (price * tpPercent / 100);  // Lower price = profit for short
    const rawStopLossPrice = price + (price * slPercent / 100);    // Higher price = loss for short
    
    const takeProfitPrice = roundToNearestRupee(rawTakeProfitPrice);
    const stopLossPrice = roundToNearestRupee(rawStopLossPrice);
    
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
          const newRawTakeProfitPrice = actualExecutionPrice - (actualExecutionPrice * tpPercent / 100);
          const newRawStopLossPrice = actualExecutionPrice + (actualExecutionPrice * slPercent / 100);
          
          const newTakeProfitPrice = roundToNearestRupee(newRawTakeProfitPrice);
          const newStopLossPrice = roundToNearestRupee(newRawStopLossPrice);
          
          console.log(`🔄 Recalculating TP/SL based on actual execution price:`);
          console.log(`   New Take Profit: ₹${newTakeProfitPrice}`);
          console.log(`   New Stop Loss: ₹${newStopLossPrice}`);
          
          // Update prices for TP/SL orders (use rounded values)
          price = actualExecutionPrice;
          takeProfitPrice = newTakeProfitPrice;
          stopLossPrice = newStopLossPrice;
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
    
// Step 2: Place Take Profit and Stop Loss orders
    let tpOrderId = null;
    let slOrderId = null;
    
    try {
      // Take Profit: Buy back at lower price (profit for short position)
      const tpOrder = await orderService.placeOrder({
        symbol: symbol.toUpperCase(),
        quantity: qty,
        side: 1,  // BUY (to cover short position)
        type: 1,  // Limit order
        limitPrice: takeProfitPrice,
        productType: 'INTRADAY',
        validity: 'DAY'
      });
      
      if (tpOrder.s === 'ok') {
        tpOrderId = tpOrder.id;
        printSuccess(`✅ Take Profit order placed! Order ID: ${tpOrderId} (Buy back at ₹${takeProfitPrice.toFixed(2)})`);
      }
    } catch (tpError) {
      printError(`❌ Take Profit order failed: ${tpError.message}`);
    }
    
    try {
      // Stop Loss: Buy back at higher price (loss for short position)
      // For SHORT positions: trigger when price goes UP (against us)
      const triggerPrice = stopLossPrice - 0.50; // Trigger 50 paise below limit price
      const limitPrice = stopLossPrice;          // Maximum acceptable buy price

      console.log(`DEBUG - Stop Loss Values for SHORT position:`);
      console.log(`   Trigger Price (stopPrice): ₹${triggerPrice} - Activates when market hits this`);
      console.log(`   Limit Price (limitPrice): ₹${limitPrice} - Maximum buy back price`);

      const slOrder = await orderService.placeOrder({
        symbol: symbol.toUpperCase(),
        quantity: qty,
        side: 1,  // BUY (to cover short position)
        type: 3,  // Stop-loss limit order (changed from type 4)
        stopPrice: triggerPrice,  // Trigger price - activates the order
        limitPrice: limitPrice,   // Maximum buy back price
        productType: 'INTRADAY',
        validity: 'DAY'
      });

      if (slOrder.s === 'ok') {
        slOrderId = slOrder.id;
        printSuccess(`✅ Stop Loss trigger order placed! Order ID: ${slOrderId}`);
        console.log(`   Trigger: ₹${triggerPrice} | Max Buy: ₹${limitPrice}`);
        console.log(`   ✅ Order will remain dormant until trigger price is hit`);
      }
    } catch (slError) {
      printError(`❌ Stop Loss trigger order failed: ${slError.message}`);

      // Fallback: Try as stop-loss market order (type 4)
      try {
        console.log(`🔄 Trying fallback: Stop-loss market order...`);
        const slFallbackOrder = await orderService.placeOrder({
          symbol: symbol.toUpperCase(),
          quantity: qty,
          side: 1,  // BUY
          type: 4,  // Stop-loss market order
          stopPrice: stopLossPrice,
          productType: 'INTRADAY',
          validity: 'DAY'
        });

        if (slFallbackOrder.s === 'ok') {
          slOrderId = slFallbackOrder.id;
          printSuccess(`✅ Stop Loss market order placed! Order ID: ${slOrderId}`);
          console.log(`   Trigger: ₹${stopLossPrice} (market order execution)`);
        }
      } catch (fallbackError) {
        printError(`❌ Stop Loss fallback also failed: ${fallbackError.message}`);
        printWarning(`⚠️ Manual stop loss management required!`);
        console.log(`📋 Manually place stop loss: Buy ${qty} shares if price reaches ₹${stopLossPrice}`);
      }
    }
    
    // if (!tpOrderId || !slOrderId) {
    //   printError(`❌ Failed to place both TP and SL orders. Manual management required.`);
    //   return;
    // }
    
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
            console.log(`� ${line}`);
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

// Add these functions after the existing command implementations

async function runTrendingScreener(mode = 'all') {
  printHeader('Trending Stock Screener');

  try {
    const TrendingStockScreener = require('./src/strategies/trendingStockScreener');
    const screener = new TrendingStockScreener();

    console.log('🔍 Analyzing market conditions...');

    // Check if MarketBreadthAnalyzer exists, if not skip market breadth analysis
    let marketBreadth = null;
    try {
      const MarketBreadthAnalyzer = require('./src/services/marketBreadthAnalyzer');
      const analyzer = new MarketBreadthAnalyzer();
      marketBreadth = await analyzer.analyzeMarketBreadth();

      console.log(`📊 Market Bias: ${marketBreadth.overallBias}`);
      console.log(`📈 Trending Probability: ${(marketBreadth.trendingProbability * 100).toFixed(1)}%`);

      if (marketBreadth.trendingProbability < 0.4) {
        printWarning('Low trending probability detected. Consider avoiding directional trades today.');
        return;
      }
    } catch (breadthError) {
      printWarning(`Market breadth analysis unavailable: ${breadthError.message}`);
      console.log('📊 Proceeding with stock screening without market breadth analysis...');
    }

    console.log('\n🎯 Screening trending candidates...');
    const candidates = await screener.screenTrendingStocks();
    
    if (candidates.length === 0) {
      printInfo('No trending candidates found matching criteria');
      return;
    }
    
    console.log(`\n✅ Found ${candidates.length} trending candidates:`);
    console.log('Rank | Symbol           | Score | Direction | Gap%  | Volume | ATR');
    console.log('-'.repeat(70));
    
    candidates.slice(0, 20).forEach((stock, index) => {
      console.log(
        `${(index + 1).toString().padStart(4)} | ` +
        `${stock.symbol.padEnd(15)} | ` +
        `${stock.score.toFixed(2).padStart(5)} | ` +
        `${stock.direction.padEnd(9)} | ` +
        `${stock.gapPercent.toFixed(2).padStart(5)} | ` +
        `${stock.volumeRatio.toFixed(1).padStart(6)} | ` +
        `${stock.atr.toFixed(2)}`
      );
    });
    
    // Save results to file for later use
    const fs = require('fs');
    fs.writeFileSync('./logs/trending-candidates.json', JSON.stringify(candidates, null, 2));
    printSuccess('Results saved to logs/trending-candidates.json');
    
  } catch (error) {
    printError(`Screening failed: ${error.message}`);
  }
}

async function analyzeMarketBreadth() {
  printHeader('Market Breadth Analysis');
  
  try {
    const MarketBreadthAnalyzer = require('./src/services/marketBreadthAnalyzer');
    const analyzer = new MarketBreadthAnalyzer();
    
    const breadth = await analyzer.analyzeMarketBreadth();
    
    console.log('📊 Market Breadth Metrics:');
    console.log(`   Advance/Decline Ratio: ${breadth.advanceDeclineRatio.toFixed(2)}`);
    console.log(`   New Highs/Lows Ratio: ${breadth.newHighsLows.ratio.toFixed(2)}`);
    console.log(`   Leading Sectors: ${breadth.sectorMomentum.leadingSectors}`);
    console.log(`   Overall Bias: ${breadth.overallBias}`);
    console.log(`   Trending Probability: ${(breadth.trendingProbability * 100).toFixed(1)}%`);
    
    if (breadth.trendingProbability > 0.6) {
      printSuccess('🎯 High probability trending day - Good for directional trades');
    } else if (breadth.trendingProbability > 0.4) {
      printWarning('⚠️ Moderate trending probability - Trade with caution');
    } else {
      printError('❌ Low trending probability - Avoid directional trades');
    }
    
  } catch (error) {
    printError(`Market breadth analysis failed: ${error.message}`);
  }
}

async function setupDirectionalTrade(symbol, atr) {
  printHeader(`Directional Trade Setup - ${symbol}`);
  
  try {
    const DirectionalTradingStrategy = require('./src/strategies/directionalTradingStrategy');
    const strategy = new DirectionalTradingStrategy();
    
    console.log('📊 Analyzing directional opportunity...');
    const analysis = await strategy.analyzeDirectionalOpportunity(symbol, atr);
    
    if (analysis.isValid) {
      printSuccess(`✅ Valid directional setup found for ${symbol}!`);

      console.log('\n🎯 Directional Setup Analysis:');
      console.log(`   Direction: ${analysis.direction}`);
      console.log(`   Strength: ${analysis.strength.toFixed(2)}`);
      console.log(`   Confidence: ${analysis.confidence.toFixed(2)}`);
      console.log(`   Entry Price: ₹${analysis.entryPrice}`);
      console.log(`   Stop Loss: ₹${analysis.stopLoss}`);
      console.log(`   Target: ₹${analysis.target}`);
      console.log(`   Risk-Reward Ratio: 1:${analysis.riskRewardRatio.toFixed(2)}`);
      console.log(`   Position Size: ${analysis.recommendedQuantity} shares`);

      console.log('\n📋 Recommended Actions:');
      if (analysis.direction === 'BULLISH') {
        console.log(`   1. Buy: node place-order.js buy ${symbol} ${analysis.recommendedQuantity} ${analysis.entryPrice}`);
        console.log(`   2. Set SL: node place-order.js stop-loss ${symbol} ${analysis.stopLoss}`);
      } else {
        console.log(`   1. Short: node place-order.js short-limit ${symbol} ${analysis.recommendedQuantity} ${analysis.entryPrice}`);
      }
    } else {
      printWarning(`⚠️ No strong directional setup found for ${symbol}`);

      if (analysis.error) {
        printError(`Error: ${analysis.error}`);
      } else {
        console.log('\n📊 Current Analysis (for reference):');
        console.log(`   Direction: ${analysis.direction}`);
        console.log(`   Strength: ${analysis.strength.toFixed(2)} (needs > 0.4)`);
        console.log(`   Confidence: ${analysis.confidence.toFixed(2)}`);
        console.log(`   Entry Price: ₹${analysis.entryPrice}`);
        console.log(`   Stop Loss: ₹${analysis.stopLoss}`);
        console.log(`   Target: ₹${analysis.target}`);
        console.log(`   Risk-Reward Ratio: 1:${analysis.riskRewardRatio.toFixed(2)}`);

        console.log('\n💡 Suggestions:');
        console.log('   • Wait for stronger technical signals');
        console.log('   • Look for RSI > 60 (bullish) or < 40 (bearish)');
        console.log('   • Wait for MACD crossover above signal line');
        console.log('   • Consider other symbols with better setups');
      }
    }
    
  } catch (error) {
    printError(`Directional setup failed: ${error.message}`);
  }
}

async function startTrendingMonitor(intervalMinutes = 30) {
  printHeader('Trending Opportunities Monitor');
  
  try {
    // Load previously screened candidates
    const fs = require('fs');
    let candidates = [];
    
    if (fs.existsSync('./logs/trending-candidates.json')) {
      candidates = JSON.parse(fs.readFileSync('./logs/trending-candidates.json', 'utf8'));
      printSuccess(`Loaded ${candidates.length} trending candidates from previous screening`);
    } else {
      printWarning('No previous screening results found. Run screening first.');
      return;
    }
    
    const EnhancedMarketDataService = require('./src/services/enhancedMarketDataService');
    const marketData = new EnhancedMarketDataService();
    
    // Subscribe to top candidates
    const topSymbols = candidates.slice(0, 10).map(c => c.symbol);
    console.log(`📡 Monitoring ${topSymbols.length} trending candidates...`);
    
    marketData.on('trendingOpportunity', async (opportunity) => {
      console.log(`\n🚨 TRENDING OPPORTUNITY DETECTED:`);
      console.log(`   Symbol: ${opportunity.symbol}`);
      console.log(`   Signals: ${JSON.stringify(opportunity.signals, null, 2)}`);
      console.log(`   Time: ${opportunity.timestamp.toLocaleTimeString()}`);
      
      // Auto-suggest trade setup
      console.log(`\n💡 Suggested Action:`);
      console.log(`   node place-order.js directional-setup ${opportunity.symbol}`);
    });
    
    await marketData.connect();
    await marketData.subscribe(topSymbols);
    
    console.log(`⏰ Monitoring will run for ${intervalMinutes} minutes. Press Ctrl+C to stop.`);
    
    setTimeout(() => {
      console.log('\n⏰ Monitoring period completed');
      marketData.disconnect();
      process.exit(0);
    }, intervalMinutes * 60 * 1000);
    
  } catch (error) {
    printError(`Trending monitor failed: ${error.message}`);
  }
}

async function startAutoDirectionalTrading(riskAmount, maxPositions) {
  printHeader('Auto Directional Trading');
  
  try {
    const risk = parseFloat(riskAmount);
    const maxPos = parseInt(maxPositions);
    
    console.log(`💰 Risk per trade: ₹${risk}`);
    console.log(`📊 Maximum positions: ${maxPos}`);
    console.log('🤖 Starting automated directional trading...');
    
    const AutoDirectionalTrader = require('./src/strategies/autoDirectionalTrader');
    const trader = new AutoDirectionalTrader({
      riskPerTrade: risk,
      maxPositions: maxPos
    });
    
    await trader.initialize();
    await trader.start();
    
    console.log('✅ Auto directional trading started');
    console.log('📋 Monitor with: node place-order.js positions');
    console.log('🛑 Stop with: Ctrl+C');
    
  } catch (error) {
    printError(`Auto directional trading failed: ${error.message}`);
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

      case 'optimal-trade':
      case 'opt':
        if (args.length < 5) {
          printError('Usage: node place-order.js optimal-trade <symbol> <quantity> <limit_price> <atr>');
          console.log('Example: node place-order.js optimal-trade NSE:SBIN-EQ 10 500 2.25');
          console.log('This will calculate optimal TP% and SL% using ATR-based risk-reward calculator');
          console.log('ATR (Average True Range) is required for dynamic stop loss calculation');
          return;
        }
        const atrValue = parseFloat(args[4]);

        if (!isDryRun) {
          await buyWithOptimalTPSL(args[1], args[2], args[3], atrValue);
        } else {
          const price = parseFloat(args[3]);
          const qty = parseInt(args[2]);

          // Use ATR-based calculation for dry run preview
          const result = requiredTPpercent({
            P: price,
            Q: qty,
            ATR: atrValue
          });

          const actualStopLossPercent = result.calculatedStopLossPercent * 100;
          const optimalTPPercent = result.required_g * 100;

          console.log(`Would place OPTIMAL RISK-REWARD trade (ATR-based): ${args[1]} x${args[2]} @₹${price}`);
          console.log(`ATR: ${atrValue} | Calculated Stop Loss: ${actualStopLossPercent.toFixed(3)}%`);
          console.log(`Stop Loss Price: ₹${result.stopLossPrice.toFixed(2)}`);
          console.log(`Calculated Optimal Take Profit: ${optimalTPPercent.toFixed(2)}%`);
          console.log(`Expected Net Loss if SL hits: ₹${result.netLoss.toFixed(2)}`);
          console.log(`Target Net Profit if TP hits: ₹${(2 * result.netLoss).toFixed(2)} (2:1 ratio)`);
        }
        break;

      case 'optimal-short':
      case 'short-optimal':
      case 'short-opt':
        if (args.length < 5) {
          printError('Usage: node place-order.js optimal-short <symbol> <quantity> <limit_price> <atr>');
          console.log('Example: node place-order.js optimal-short NSE:SBIN-EQ 10 500 2.25');
          console.log('This will calculate optimal TP% and SL% for SHORT SELLING using ATR-based risk-reward calculator');
          console.log('ATR (Average True Range) is required for dynamic stop loss calculation');
          return;
        }
        const shortAtrValue = parseFloat(args[4]);

        if (!isDryRun) {
          await shortSellWithOptimalTPSL(args[1], args[2], args[3], shortAtrValue);
        } else {
          const price = parseFloat(args[3]);
          const qty = parseInt(args[2]);

          // Use ATR-based calculation for short sell dry run preview
          const result = requiredTPpercentShort({
            P: price,
            Q: qty,
            ATR: shortAtrValue
          });

          const actualStopLossPercent = result.calculatedStopLossPercent * 100;
          const optimalTPPercent = result.required_g * 100;

          console.log(`Would place OPTIMAL SHORT SELL trade (ATR-based): ${args[1]} x${args[2]} @₹${price}`);
          console.log(`ATR: ${shortAtrValue} | Calculated Stop Loss: ${actualStopLossPercent.toFixed(3)}%`);
          console.log(`Stop Loss Price: ₹${result.stopLossPrice.toFixed(2)} (buy back ABOVE entry)`);
          console.log(`Take Profit Price: ₹${result.takeProfitPrice.toFixed(2)} (buy back BELOW entry)`);
          console.log(`Calculated Optimal Take Profit: ${optimalTPPercent.toFixed(2)}%`);
          console.log(`Expected Net Loss if SL hits: ₹${result.netLoss.toFixed(2)}`);
          console.log(`Target Net Profit if TP hits: ₹${(2 * result.netLoss).toFixed(2)} (2:1 ratio)`);
        }
        break;

      case 'auto-optimal':
      case 'auto-opt':
        if (args.length < 4) {
          printError('Usage: node place-order.js auto-optimal <symbol> <quantity> <limit_price> [risk_reward_ratio]');
          console.log('Example: node place-order.js auto-optimal NSE:SBIN-EQ 10 500 2');
          console.log('This will auto-calculate BOTH optimal SL% and TP% for desired risk-reward ratio');
          console.log('Default ratio is 1:2 (profit is 2x the loss)');
          return;
        }
        const targetRatio = args[4] || 2;
        if (!isDryRun) {
          await buyWithAutoOptimalSL(args[1], args[2], args[3], targetRatio);
        } else {
          const price = parseFloat(args[3]);
          const qty = parseInt(args[2]);
          const ratio = parseFloat(targetRatio);
          
          // Calculate what the optimal SL and TP would be
          const result = optimalStopLossPercent({
            P: price,
            Q: qty,
            targetRatio: ratio
          });
          
          if (result) {
            const optimalSLPercent = result.optimal_l * 100;
            const optimalTPPercent = result.optimal_g * 100;
            
            console.log(`Would place AUTO-OPTIMIZED trade: ${args[1]} x${args[2]} @₹${price}`);
            console.log(`Target Ratio: 1:${ratio} | Calculated SL: ${optimalSLPercent.toFixed(3)}% | Calculated TP: ${optimalTPPercent.toFixed(3)}%`);
            console.log(`Expected Net Loss: ₹${result.netLoss.toFixed(2)} | Expected Net Profit: ₹${result.netProfit.toFixed(2)}`);
            console.log(`Actual Ratio Achieved: 1:${result.actualRatio.toFixed(2)}`);
          } else {
            console.log('Failed to calculate optimal parameters');
          }
        }
        break;
        const volTargetRatio = args[4] || 2;
        const volMultiplier = args[5] || 1.5;
        if (!isDryRun) {
          await buyWithVolatilityOptimalSL(args[1], args[2], args[3], volTargetRatio, volMultiplier);
        } else {
          const price = parseFloat(args[3]);
          const qty = parseInt(args[2]);
          const ratio = parseFloat(volTargetRatio);
          const multiplier = parseFloat(volMultiplier);
          
          const result = optimalStopLossWithVolatility({
            P: price,
            Q: qty,
            symbol: args[1],
            targetRatio: ratio,
            volatilityMultiplier: multiplier
          });
          
          if (result) {
            console.log(`Would place VOLATILITY-OPTIMIZED trade: ${args[1]} x${args[2]} @₹${price}`);
            console.log(`Daily Vol: ${(result.dailyVolatility * 100).toFixed(2)}% | Multiplier: ${multiplier}x`);
            console.log(`SL: ${(result.optimal_l * 100).toFixed(3)}% | TP: ${(result.optimal_g * 100).toFixed(3)}%`);
            console.log(`Risk: ₹${result.netLoss.toFixed(2)} | Reward: ₹${result.netProfit.toFixed(2)} | Ratio: 1:${result.actualRatio.toFixed(2)}`);
          }
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

      case 'screen-trending':
      case 'screen':
        if (!isDryRun) {
          await runTrendingScreener(args[1] || 'all');
        } else {
          console.log('Would run trending stock screener');
        }
        break;

      case 'market-breadth':
      case 'breadth':
        await analyzeMarketBreadth();
        break;

      case 'directional-setup':
      case 'dir-setup':
        if (args.length < 2) {
          printError('Usage: node place-order.js directional-setup <symbol> [atr]');
          console.log('Example: node place-order.js directional-setup NSE:SBIN-EQ 2.5');
          return;
        }
        if (!isDryRun) {
          await setupDirectionalTrade(args[1], args[2]);
        } else {
          console.log(`Would setup directional trade for ${args[1]}`);
        }
        break;

      case 'trending-monitor':
      case 'trend-mon':
        await startTrendingMonitor(args[1] || 30);
        break;

      case 'auto-directional':
      case 'auto-dir':
        if (args.length < 3) {
          printError('Usage: node place-order.js auto-directional <risk_amount> <max_positions>');
          console.log('Example: node place-order.js auto-directional 10000 3');
          return;
        }
        if (!isDryRun) {
          await startAutoDirectionalTrading(args[1], args[2]);
        } else {
          console.log(`Would start auto-directional trading with ₹${args[1]} risk per trade`);
        }
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

