const BaseStrategy = require('./baseStrategy');
const logger = require('../utils/logger');

/**
 * Sample Moving Average Crossover Strategy
 * This is a simple example strategy that demonstrates how to extend BaseStrategy
 */
class SampleStrategy extends BaseStrategy {
  constructor(config = {}) {
    const defaultConfig = {
      shortPeriod: 5,
      longPeriod: 20,
      symbols: ['NSE:SBIN-EQ', 'NSE:TCS-EQ', 'NSE:RELIANCE-EQ'],
      ...config
    };
    
    super('SampleMovingAverageStrategy', defaultConfig);
    
    // Store price history for moving average calculation
    this.priceHistory = new Map();
    
    // Initialize price history for each symbol
    this.config.symbols.forEach(symbol => {
      this.priceHistory.set(symbol, []);
    });
  }

  /**
   * Process incoming market data
   */
  processMarketData(data) {
    if (!this.config.symbols.includes(data.symbol)) {
      return; // Ignore symbols not in our watchlist
    }

    if (!data.ltp || data.ltp <= 0) {
      return; // Invalid price data
    }

    // Update price history
    this.updatePriceHistory(data.symbol, data.ltp);
    
    // Check for trading signals
    this.checkForSignals(data.symbol, data.ltp);
  }

  /**
   * Update price history for moving average calculation
   */
  updatePriceHistory(symbol, price) {
    let history = this.priceHistory.get(symbol) || [];
    
    // Add new price
    history.push(price);
    
    // Keep only the required number of prices (long period + buffer)
    const maxHistory = this.config.longPeriod + 10;
    if (history.length > maxHistory) {
      history = history.slice(-maxHistory);
    }
    
    this.priceHistory.set(symbol, history);
  }

  /**
   * Calculate simple moving average
   */
  calculateSMA(symbol, period) {
    const history = this.priceHistory.get(symbol) || [];
    
    if (history.length < period) {
      return null; // Not enough data
    }
    
    const recentPrices = history.slice(-period);
    const sum = recentPrices.reduce((acc, price) => acc + price, 0);
    return sum / period;
  }

  /**
   * Check for trading signals based on moving average crossover
   */
  checkForSignals(symbol, currentPrice) {
    // Calculate moving averages
    const shortMA = this.calculateSMA(symbol, this.config.shortPeriod);
    const longMA = this.calculateSMA(symbol, this.config.longPeriod);
    
    if (!shortMA || !longMA) {
      return; // Not enough data for calculation
    }

    // Get previous moving averages for crossover detection
    const prevShortMA = this.calculatePreviousSMA(symbol, this.config.shortPeriod);
    const prevLongMA = this.calculatePreviousSMA(symbol, this.config.longPeriod);
    
    if (!prevShortMA || !prevLongMA) {
      return; // Not enough data for previous calculation
    }

    // Check market conditions
    if (!this.isMarketSuitable()) {
      return;
    }

    const hasPosition = this.hasPosition(symbol);
    
    // Bullish crossover: Short MA crosses above Long MA
    if (prevShortMA <= prevLongMA && shortMA > longMA && !hasPosition) {
      logger.info(`Bullish crossover detected for ${symbol}: Short MA (${shortMA.toFixed(2)}) > Long MA (${longMA.toFixed(2)})`);
      
      // Check risk limits before generating signal
      const quantity = this.calculatePositionSize(symbol, currentPrice);
      if (this.checkRiskLimits(symbol, quantity, currentPrice)) {
        this.generateBuySignal(symbol, currentPrice);
      }
    }
    
    // Bearish crossover: Short MA crosses below Long MA
    else if (prevShortMA >= prevLongMA && shortMA < longMA && hasPosition) {
      logger.info(`Bearish crossover detected for ${symbol}: Short MA (${shortMA.toFixed(2)}) < Long MA (${longMA.toFixed(2)})`);
      this.generateSellSignal(symbol, currentPrice);
    }
    
    // Stop-loss check for existing positions
    if (hasPosition) {
      this.checkStopLoss(symbol, currentPrice);
    }
  }

  /**
   * Calculate previous moving average (excluding the latest price)
   */
  calculatePreviousSMA(symbol, period) {
    const history = this.priceHistory.get(symbol) || [];
    
    if (history.length < period + 1) {
      return null; // Not enough data
    }
    
    const previousPrices = history.slice(-(period + 1), -1);
    const sum = previousPrices.reduce((acc, price) => acc + price, 0);
    return sum / period;
  }

  /**
   * Check stop-loss for existing positions
   */
  checkStopLoss(symbol, currentPrice) {
    const position = this.getPosition(symbol);
    if (!position) return;
    
    const stopLossPrice = position.avgPrice * (1 - this.config.stopLossPercentage / 100);
    
    if (currentPrice <= stopLossPrice) {
      logger.info(`Stop-loss triggered for ${symbol}: Current price ${currentPrice} <= Stop-loss ${stopLossPrice.toFixed(2)}`);
      this.generateSellSignal(symbol, currentPrice);
    }
  }

  /**
   * Get strategy-specific statistics
   */
  getStrategyStats() {
    const baseStats = this.getStats();
    
    const symbolStats = this.config.symbols.map(symbol => {
      const history = this.priceHistory.get(symbol) || [];
      const shortMA = this.calculateSMA(symbol, this.config.shortPeriod);
      const longMA = this.calculateSMA(symbol, this.config.longPeriod);
      const latestData = this.getLatestData(symbol);
      
      return {
        symbol,
        historyLength: history.length,
        shortMA: shortMA ? shortMA.toFixed(2) : null,
        longMA: longMA ? longMA.toFixed(2) : null,
        currentPrice: latestData ? latestData.ltp : null,
        hasPosition: this.hasPosition(symbol)
      };
    });
    
    return {
      ...baseStats,
      shortPeriod: this.config.shortPeriod,
      longPeriod: this.config.longPeriod,
      symbols: symbolStats
    };
  }

  /**
   * Reset strategy state
   */
  reset() {
    this.priceHistory.clear();
    this.positions.clear();
    this.orders.clear();
    
    // Reinitialize price history
    this.config.symbols.forEach(symbol => {
      this.priceHistory.set(symbol, []);
    });
    
    logger.info(`Strategy ${this.name} reset`);
  }

  /**
   * Add new symbol to watchlist
   */
  addSymbol(symbol) {
    if (!this.config.symbols.includes(symbol)) {
      this.config.symbols.push(symbol);
      this.priceHistory.set(symbol, []);
      logger.info(`Added ${symbol} to strategy watchlist`);
    }
  }

  /**
   * Remove symbol from watchlist
   */
  removeSymbol(symbol) {
    const index = this.config.symbols.indexOf(symbol);
    if (index > -1) {
      this.config.symbols.splice(index, 1);
      this.priceHistory.delete(symbol);
      
      // Close position if exists
      if (this.hasPosition(symbol)) {
        const latestData = this.getLatestData(symbol);
        if (latestData) {
          this.generateSellSignal(symbol, latestData.ltp);
        }
      }
      
      logger.info(`Removed ${symbol} from strategy watchlist`);
    }
  }

  /**
   * Update strategy parameters
   */
  updateParameters(newConfig) {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    logger.info(`Strategy parameters updated from ${JSON.stringify(oldConfig)} to ${JSON.stringify(this.config)}`);
    
    // If periods changed, we might need to reset price history
    if (newConfig.shortPeriod || newConfig.longPeriod) {
      logger.info('Moving average periods changed, consider resetting strategy');
    }
  }
}

module.exports = SampleStrategy;
