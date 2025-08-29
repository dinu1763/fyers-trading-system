const moment = require('moment-timezone');
const logger = require('./logger');

/**
 * Utility helper functions for the trading system
 */
class TradingHelpers {
  
  /**
   * Check if current time is within market hours
   */
  static isMarketOpen() {
    const now = moment().tz('Asia/Kolkata');
    const currentTime = now.format('HHmm');
    const dayOfWeek = now.day();
    
    // Check if it's a weekday (Monday = 1, Friday = 5)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false; // Weekend
    }
    
    // Market hours: 9:15 AM to 3:30 PM IST
    return currentTime >= '0915' && currentTime <= '1530';
  }

  /**
   * Get market session information
   */
  static getMarketSession() {
    const now = moment().tz('Asia/Kolkata');
    const currentTime = now.format('HHmm');
    
    if (currentTime < '0915') {
      return 'PRE_MARKET';
    } else if (currentTime >= '0915' && currentTime <= '1530') {
      return 'MARKET_HOURS';
    } else {
      return 'POST_MARKET';
    }
  }

  /**
   * Calculate time until market opens
   */
  static getTimeToMarketOpen() {
    const now = moment().tz('Asia/Kolkata');
    let marketOpen = moment().tz('Asia/Kolkata').set({
      hour: 9,
      minute: 15,
      second: 0,
      millisecond: 0
    });
    
    // If market time has passed today, set for next trading day
    if (now.isAfter(marketOpen)) {
      marketOpen = marketOpen.add(1, 'day');
      
      // Skip weekends
      while (marketOpen.day() === 0 || marketOpen.day() === 6) {
        marketOpen = marketOpen.add(1, 'day');
      }
    }
    
    return marketOpen.diff(now);
  }

  /**
   * Format currency amount
   */
  static formatCurrency(amount, currency = '₹') {
    if (typeof amount !== 'number') {
      return `${currency}0.00`;
    }
    
    return `${currency}${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  /**
   * Calculate percentage change
   */
  static calculatePercentageChange(oldValue, newValue) {
    if (oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  /**
   * Round to specified decimal places
   */
  static roundToDecimals(value, decimals = 2) {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  /**
   * Validate symbol format
   */
  static validateSymbol(symbol) {
    // Basic validation for NSE symbols
    const patterns = [
      /^NSE:[A-Z0-9&]+(-EQ|-BE)$/,  // Equity
      /^NSE:[A-Z0-9]+\d{2}[A-Z]{3}FUT$/,  // Futures
      /^NSE:[A-Z0-9]+\d{2}[A-Z]{3}\d+[CP]E$/  // Options
    ];
    
    return patterns.some(pattern => pattern.test(symbol));
  }

  /**
   * Parse symbol to get instrument details
   */
  static parseSymbol(symbol) {
    const parts = symbol.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid symbol format');
    }
    
    const [exchange, instrument] = parts;
    
    if (instrument.endsWith('-EQ') || instrument.endsWith('-BE')) {
      return {
        exchange,
        symbol: instrument.replace(/(-EQ|-BE)$/, ''),
        type: 'EQUITY',
        segment: instrument.endsWith('-EQ') ? 'EQ' : 'BE'
      };
    }
    
    if (instrument.includes('FUT')) {
      const match = instrument.match(/^([A-Z0-9]+)(\d{2})([A-Z]{3})FUT$/);
      if (match) {
        return {
          exchange,
          symbol: match[1],
          type: 'FUTURES',
          expiry: `${match[2]}${match[3]}`
        };
      }
    }
    
    if (instrument.includes('CE') || instrument.includes('PE')) {
      const match = instrument.match(/^([A-Z0-9]+)(\d{2})([A-Z]{3})(\d+)([CP])E$/);
      if (match) {
        return {
          exchange,
          symbol: match[1],
          type: 'OPTIONS',
          expiry: `${match[2]}${match[3]}`,
          strike: parseInt(match[4]),
          optionType: match[5] === 'C' ? 'CALL' : 'PUT'
        };
      }
    }
    
    throw new Error('Unable to parse symbol');
  }

  /**
   * Calculate position value
   */
  static calculatePositionValue(quantity, price) {
    return quantity * price;
  }

  /**
   * Calculate P&L
   */
  static calculatePnL(quantity, buyPrice, currentPrice) {
    return quantity * (currentPrice - buyPrice);
  }

  /**
   * Calculate P&L percentage
   */
  static calculatePnLPercentage(buyPrice, currentPrice) {
    return this.calculatePercentageChange(buyPrice, currentPrice);
  }

  /**
   * Validate order parameters
   */
  static validateOrderParams(orderData) {
    const required = ['symbol', 'quantity', 'side'];
    const missing = required.filter(field => !orderData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    if (orderData.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    
    if (![1, -1].includes(orderData.side)) {
      throw new Error('Side must be 1 (Buy) or -1 (Sell)');
    }
    
    if (!this.validateSymbol(orderData.symbol)) {
      throw new Error('Invalid symbol format');
    }
    
    return true;
  }

  /**
   * Generate unique order ID
   */
  static generateOrderId() {
    return `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry function with exponential backoff
   */
  static async retry(fn, maxAttempts = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          break;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Rate limiter
   */
  static createRateLimiter(maxRequests, windowMs) {
    const requests = [];
    
    return async function() {
      const now = Date.now();
      
      // Remove old requests outside the window
      while (requests.length > 0 && requests[0] <= now - windowMs) {
        requests.shift();
      }
      
      // Check if we can make a request
      if (requests.length >= maxRequests) {
        const oldestRequest = requests[0];
        const waitTime = windowMs - (now - oldestRequest);
        await TradingHelpers.sleep(waitTime);
        return this();
      }
      
      requests.push(now);
    };
  }

  /**
   * Convert timestamp to IST
   */
  static toIST(timestamp) {
    return moment(timestamp).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss IST');
  }

  /**
   * Get trading day
   */
  static getTradingDay(date = null) {
    const targetDate = date ? moment(date) : moment();
    return targetDate.tz('Asia/Kolkata').format('YYYY-MM-DD');
  }

  /**
   * Check if date is a trading day (weekday)
   */
  static isTradingDay(date = null) {
    const targetDate = date ? moment(date) : moment();
    const dayOfWeek = targetDate.day();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
  }

  /**
   * Get next trading day
   */
  static getNextTradingDay(date = null) {
    let nextDay = date ? moment(date).add(1, 'day') : moment().add(1, 'day');
    
    while (!this.isTradingDay(nextDay)) {
      nextDay = nextDay.add(1, 'day');
    }
    
    return nextDay.format('YYYY-MM-DD');
  }

  /**
   * Sanitize log data (remove sensitive information)
   */
  static sanitizeLogData(data) {
    const sensitiveFields = ['access_token', 'secret_key', 'password', 'auth_code'];
    const sanitized = { ...data };
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });
    
    return sanitized;
  }
}

module.exports = TradingHelpers;
