# FYERS Trading System - Quick Start Commands

This file contains all the essential commands to get your FYERS algorithmic trading system up and running quickly.

## 🚀 Initial Setup (One-time)

### 1. Install Dependencies
```bash
# Install all required packages
npm install

# Or if you prefer yarn
yarn install
```

### 2. Setup Project Structure
```bash
# Run the automated setup script
node scripts/setup.js
```

### 3. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your FYERS credentials
# Required: FYERS_APP_ID, FYERS_SECRET_KEY, FYERS_REDIRECT_URL
```

## 🔐 Authentication Setup

### Generate Access Token
```bash
# Interactive authentication setup
node examples/auth-setup.js

# Test your connection
node examples/auth-setup.js test

# Refresh expired token
node examples/auth-setup.js refresh
```

## 🏃‍♂️ Running the Application

### Development Mode
```bash
# Start with auto-restart on file changes
npm run dev

# Or directly with nodemon
npx nodemon src/app.js
```

### Production Mode
```bash
# Start the application
npm start

# Or directly with node
node src/app.js
```

### Quick Start Example
```bash
# Run the comprehensive example
node examples/quickstart.js
```

## 🧪 Testing

### Run All Tests
```bash
# Run complete test suite
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm run test:watch
```

### Run Specific Tests
```bash
# Test specific service
npm test -- tests/unit/fyersService.test.js

# Test with verbose output
npm test -- --verbose
```

## 📊 Monitoring and Debugging

### Check Application Status
```bash
# View real-time logs
tail -f logs/combined.log

# View error logs only
tail -f logs/error.log

# Search logs for specific terms
grep -i "error" logs/combined.log
grep -i "order" logs/combined.log
```

### Debug Mode
```bash
# Run with debug logging
LOG_LEVEL=debug npm start

# Run with Node.js debugger
node --inspect src/app.js
```

## 🔧 Maintenance Commands

### Update Dependencies
```bash
# Check for outdated packages
npm outdated

# Update all dependencies
npm update

# Update specific package
npm install fyers-api-v3@latest
```

### Code Quality
```bash
# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code (if prettier is configured)
npx prettier --write src/
```

## 📈 Trading Operations

### Manual Order Testing
```javascript
// In Node.js REPL or script
const OrderService = require('./src/services/orderService');
const orderService = new OrderService();

// Place a test market order (be careful!)
await orderService.placeOrder({
  symbol: "NSE:SBIN-EQ",
  quantity: 1,
  side: 1, // Buy
  type: 2, // Market order
  productType: "INTRADAY"
});
```

### Market Data Testing
```javascript
// Test market data connection
const MarketDataService = require('./src/services/marketDataService');
const marketData = new MarketDataService();

marketData.on('tick', (data) => {
  console.log(`${data.symbol}: ${data.ltp}`);
});

marketData.connect();
marketData.subscribe(['NSE:SBIN-EQ']);
```

## 🚀 Production Deployment

### Using PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start src/app.js --name fyers-trading

# Monitor application
pm2 monit

# View logs
pm2 logs fyers-trading

# Restart application
pm2 restart fyers-trading

# Stop application
pm2 stop fyers-trading

# Save PM2 configuration
pm2 save

# Setup auto-start on boot
pm2 startup
```

### Using Docker
```bash
# Build Docker image
docker build -t fyers-trading .

# Run container
docker run -d --name fyers-trading \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  fyers-trading

# View container logs
docker logs -f fyers-trading

# Stop container
docker stop fyers-trading
```

## 🔍 Troubleshooting Commands

### Common Issues

#### Authentication Problems
```bash
# Check API credentials
node -e "console.log(require('dotenv').config()); console.log(process.env.FYERS_APP_ID)"

# Test connection
node examples/auth-setup.js test

# Generate new token
node examples/auth-setup.js
```

#### Connection Issues
```bash
# Test network connectivity
ping api.fyers.in
telnet socket.fyers.in 443

# Check DNS resolution
nslookup api.fyers.in
```

#### Memory Issues
```bash
# Check memory usage
ps aux | grep node
top -p $(pgrep node)

# Start with increased memory
node --max-old-space-size=4096 src/app.js
```

#### Port Issues
```bash
# Check if port is in use
netstat -tulpn | grep :3000
lsof -i :3000

# Kill process using port
kill -9 $(lsof -t -i:3000)
```

## 📋 Daily Operations Checklist

### Morning Routine
```bash
# 1. Check application status
pm2 status

# 2. Review overnight logs
tail -100 logs/combined.log | grep -i error

# 3. Check system resources
free -h
df -h

# 4. Verify market data connection
curl -s "https://api.fyers.in/api/v2/marketStatus" | jq .
```

### End of Day
```bash
# 1. Review trading activity
grep -i "order" logs/combined.log | tail -20

# 2. Check positions
node -e "
const app = require('./src/app');
app.getAccountSummary().then(s => console.log(s.positions));
"

# 3. Backup logs
cp logs/combined.log logs/backup/combined-$(date +%Y%m%d).log
```

## 🆘 Emergency Commands

### Stop All Trading
```bash
# Stop application immediately
pm2 stop fyers-trading

# Or kill process
pkill -f "node src/app.js"
```

### Emergency Position Exit
```javascript
// Run in Node.js REPL
const OrderService = require('./src/services/orderService');
const orderService = new OrderService();

// Get all positions and close them
orderService.getPositions().then(positions => {
  positions.data.netPositions.forEach(async (pos) => {
    if (pos.netQty !== 0) {
      await orderService.placeOrder({
        symbol: pos.symbol,
        quantity: Math.abs(pos.netQty),
        side: pos.netQty > 0 ? -1 : 1, // Opposite side
        type: 2, // Market order
        productType: pos.productType
      });
    }
  });
});
```

## 📞 Support and Resources

### Get Help
```bash
# Check application version
node -e "console.log(require('./package.json').version)"

# View configuration
node -e "console.log(require('./src/config/config'))"

# Generate system info
node -e "
console.log('Node.js:', process.version);
console.log('Platform:', process.platform);
console.log('Memory:', process.memoryUsage());
console.log('Uptime:', process.uptime());
"
```

### Useful Links
- FYERS API Documentation: https://myapi.fyers.in/docsv3
- Create FYERS App: https://myapi.fyers.in
- Node.js Documentation: https://nodejs.org/docs
- PM2 Documentation: https://pm2.keymetrics.io/docs

---

**⚠️ Important Reminders:**
- Always test with small quantities first
- Use paper trading/demo account initially
- Monitor logs regularly
- Keep API credentials secure
- Implement proper risk management
- Check market hours before trading

**🚨 Emergency Contact:**
- FYERS Support: support@fyers.in
- FYERS API Support: api@fyers.in
