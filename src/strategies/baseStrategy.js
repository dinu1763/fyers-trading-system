const EventEmitter = require('events');
const logger = require('../utils/logger');

/**
 * Base Strategy Class
 * All trading strategies should extend this class
 */
class BaseStrategy extends EventEmitter {
  constructor(name, config = {}) {
    super();
    this.name = name;
    this.config = {
      maxPositionSize: 100000,
      riskPercentage: 2,
      stopLossPercentage: 5,
      takeProfitPercentage: 10,
      ...config
    };
    
    this.positions = new Map();
    this.orders = new Map();
    this.isActive = false;
    this.marketData = new Map();
    
    logger.info(`Strategy ${this.name} initialized`);
  }

  /**
   * Start the strategy
   */
  start() {
    this.isActive = true;
    logger.info(`Strategy ${this.name} started`);
    this.emit('started');
  }

  /**
   * Stop the strategy
   */
  stop() {
    this.isActive = false;
    logger.info(`Strategy ${this.name} stopped`);
    this.emit('stopped');
  }

  /**
   * Process incoming market data
   * Override this method in your strategy
   */
  onTick(data) {
    if (!this.isActive) return;
    
    // Store latest market data
    this.marketData.set(data.symbol, data);
    
    // Call strategy-specific logic
    this.processMarketData(data);
  }

  /**
   * Override this method to implement your strategy logic
   */
  processMarketData(data) {
    throw new Error('processMarketData method must be implemented by strategy');
  }

  /**
   * Calculate position size based on risk management
   */
  calculatePositionSize(symbol, price, riskAmount = null) {
    const risk = riskAmount || (this.config.maxPositionSize * this.config.riskPercentage / 100);
    const stopLossPrice = price * (1 - this.config.stopLossPercentage / 100);
    const riskPerShare = price - stopLossPrice;
    
    if (riskPerShare <= 0) {
      logger.warn(`Invalid risk calculation for ${symbol}`);
      return 0;
    }
    
    const quantity = Math.floor(risk / riskPerShare);
    const maxQuantity = Math.floor(this.config.maxPositionSize / price);
    
    return Math.min(quantity, maxQuantity);
  }

  /**
   * Generate buy signal
   */
  generateBuySignal(symbol, price, quantity = null) {
    if (!this.isActive) return null;
    
    const calculatedQuantity = quantity || this.calculatePositionSize(symbol, price);
    
    if (calculatedQuantity <= 0) {
      logger.warn(`Cannot generate buy signal for ${symbol}: invalid quantity`);
      return null;
    }
    
    const signal = {
      type: 'BUY',
      symbol,
      price,
      quantity: calculatedQuantity,
      stopLoss: price * (1 - this.config.stopLossPercentage / 100),
      takeProfit: price * (1 + this.config.takeProfitPercentage / 100),
      timestamp: new Date(),
      strategy: this.name
    };
    
    logger.info(`Buy signal generated: ${JSON.stringify(signal)}`);
    this.emit('signal', signal);
    return signal;
  }

  /**
   * Generate sell signal
   */
  generateSellSignal(symbol, price, quantity = null) {
    if (!this.isActive) return null;
    
    const position = this.positions.get(symbol);
    const sellQuantity = quantity || (position ? position.quantity : 0);
    
    if (sellQuantity <= 0) {
      logger.warn(`Cannot generate sell signal for ${symbol}: no position or invalid quantity`);
      return null;
    }
    
    const signal = {
      type: 'SELL',
      symbol,
      price,
      quantity: sellQuantity,
      timestamp: new Date(),
      strategy: this.name
    };
    
    logger.info(`Sell signal generated: ${JSON.stringify(signal)}`);
    this.emit('signal', signal);
    return signal;
  }

  /**
   * Update position information
   */
  updatePosition(symbol, quantity, avgPrice) {
    if (quantity === 0) {
      this.positions.delete(symbol);
      logger.info(`Position closed for ${symbol}`);
    } else {
      this.positions.set(symbol, {
        symbol,
        quantity,
        avgPrice,
        timestamp: new Date()
      });
      logger.info(`Position updated for ${symbol}: ${quantity} @ ${avgPrice}`);
    }
  }

  /**
   * Check if symbol has open position
   */
  hasPosition(symbol) {
    return this.positions.has(symbol);
  }

  /**
   * Get current position for symbol
   */
  getPosition(symbol) {
    return this.positions.get(symbol);
  }

  /**
   * Get all current positions
   */
  getAllPositions() {
    return Array.from(this.positions.values());
  }

  /**
   * Get latest market data for symbol
   */
  getLatestData(symbol) {
    return this.marketData.get(symbol);
  }

  /**
   * Check if market conditions are suitable for trading
   */
  isMarketSuitable() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 100 + minutes;
    
    // Market hours: 9:15 AM to 3:30 PM IST
    // Avoid first and last 15 minutes for better execution
    return currentTime >= 930 && currentTime <= 1515;
  }

  /**
   * Risk management check
   */
  checkRiskLimits(symbol, quantity, price) {
    const positionValue = quantity * price;
    
    // Check maximum position size
    if (positionValue > this.config.maxPositionSize) {
      logger.warn(`Position value ${positionValue} exceeds max position size ${this.config.maxPositionSize}`);
      return false;
    }
    
    // Check total exposure
    const totalExposure = this.getAllPositions().reduce((total, pos) => {
      const latestData = this.getLatestData(pos.symbol);
      const currentPrice = latestData ? latestData.ltp : pos.avgPrice;
      return total + (pos.quantity * currentPrice);
    }, 0);
    
    if (totalExposure + positionValue > this.config.maxPositionSize * 3) {
      logger.warn(`Total exposure would exceed risk limits`);
      return false;
    }
    
    return true;
  }

  /**
   * Get strategy statistics
   */
  getStats() {
    return {
      name: this.name,
      isActive: this.isActive,
      positionsCount: this.positions.size,
      totalPositions: this.getAllPositions(),
      config: this.config
    };
  }
}

module.exports = BaseStrategy;
