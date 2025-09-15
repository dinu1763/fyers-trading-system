const FyersService = require('../services/fyersService');
const TrendingStockScreener = require('./trendingStockScreener');
const VolatilityAnalyzer = require('../services/volatilityAnalyzer');
const MarketBreadthAnalyzer = require('../services/marketBreadthAnalyzer');
const TechnicalIndicators = require('../utils/technicalIndicators');
const logger = require('../utils/logger');

class DirectionalTradingStrategy {
  constructor() {
    this.fyersService = new FyersService();
    this.screener = new TrendingStockScreener();
    this.volatilityAnalyzer = new VolatilityAnalyzer();
    this.breadthAnalyzer = new MarketBreadthAnalyzer();
    this.watchlist = [];
  }

  async analyzeDirectionalOpportunity(symbol, atr = null) {
    try {
      console.log(`🔍 Analyzing directional opportunity for ${symbol}...`);

      // Get current market data
      const quotes = await this.fyersService.getQuotes([symbol]);
      if (!quotes || quotes.s !== 'ok' || !quotes.data) {
        throw new Error('Failed to fetch current market data');
      }

      const stockData = quotes.data[symbol] || Object.values(quotes.data)[0];
      if (!stockData || !stockData.ltp) {
        throw new Error('Invalid stock data received');
      }

      // Get historical data for technical analysis
      const historicalData = await this.fyersService.getHistoricalData(symbol, '1D', 30);
      if (!historicalData || historicalData.length < 20) {
        throw new Error('Insufficient historical data');
      }

      // Calculate technical indicators
      const prices = historicalData.map(d => d.close);
      const volumes = historicalData.map(d => d.volume);
      const currentPrice = stockData.ltp;

      const rsi = TechnicalIndicators.calculateRSI(prices, 14);
      const currentRSI = rsi[rsi.length - 1];

      const calculatedATR = TechnicalIndicators.calculateATR(historicalData, 14);
      const currentATR = atr ? parseFloat(atr) : calculatedATR[calculatedATR.length - 1];

      const macd = TechnicalIndicators.calculateMACD(prices);
      const currentMACD = macd.macdLine[macd.macdLine.length - 1];
      const currentSignal = macd.signalLine[macd.signalLine.length - 1];

      // Determine direction and strength
      const analysis = this.evaluateDirectionalSignals({
        symbol,
        currentPrice,
        rsi: currentRSI,
        atr: currentATR,
        macd: currentMACD,
        signal: currentSignal,
        volume: stockData.volume || volumes[volumes.length - 1],
        avgVolume: volumes.slice(-20).reduce((a, b) => a + b, 0) / 20,
        historicalData
      });

      return analysis;
    } catch (error) {
      logger.error(`Directional analysis failed for ${symbol}: ${error.message}`);
      return {
        isValid: false,
        error: error.message,
        symbol
      };
    }
  }

  evaluateDirectionalSignals(data) {
    const { symbol, currentPrice, rsi, atr, macd, signal, volume, avgVolume } = data;

    let direction = 'NEUTRAL';
    let strength = 0;
    let confidence = 0;

    // RSI analysis
    if (rsi > 60 && rsi < 80) {
      direction = 'BULLISH';
      strength += 0.3;
    } else if (rsi < 40 && rsi > 20) {
      direction = 'BEARISH';
      strength += 0.3;
    }

    // MACD analysis
    if (macd > signal && macd > 0) {
      if (direction === 'BULLISH') strength += 0.3;
      else if (direction === 'NEUTRAL') {
        direction = 'BULLISH';
        strength += 0.2;
      }
    } else if (macd < signal && macd < 0) {
      if (direction === 'BEARISH') strength += 0.3;
      else if (direction === 'NEUTRAL') {
        direction = 'BEARISH';
        strength += 0.2;
      }
    }

    // Volume confirmation
    const volumeRatio = volume / avgVolume;
    if (volumeRatio > 1.5) {
      strength += 0.2;
      confidence += 0.3;
    }

    // ATR-based calculations
    const stopLossDistance = atr * 0.5; // 0.5 ATR for stop loss
    const targetDistance = atr * 1.5;   // 1.5 ATR for target

    let stopLoss, target, entryPrice;

    if (direction === 'BULLISH') {
      entryPrice = currentPrice;
      stopLoss = currentPrice - stopLossDistance;
      target = currentPrice + targetDistance;
    } else if (direction === 'BEARISH') {
      entryPrice = currentPrice;
      stopLoss = currentPrice + stopLossDistance;
      target = currentPrice - targetDistance;
    } else {
      entryPrice = currentPrice;
      stopLoss = currentPrice - stopLossDistance;
      target = currentPrice + targetDistance;
    }

    // Calculate position size (assuming 1% risk)
    const riskAmount = 10000; // Assuming ₹10,000 risk
    const riskPerShare = Math.abs(entryPrice - stopLoss);
    const recommendedQuantity = Math.floor(riskAmount / riskPerShare);

    confidence += strength;

    return {
      isValid: strength > 0.4 && direction !== 'NEUTRAL',
      symbol,
      direction,
      strength: Math.min(strength, 1.0),
      confidence: Math.min(confidence, 1.0),
      entryPrice: Math.round(entryPrice * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      target: Math.round(target * 100) / 100,
      atr: Math.round(atr * 100) / 100,
      rsi: Math.round(rsi * 100) / 100,
      volumeRatio: Math.round(volumeRatio * 100) / 100,
      recommendedQuantity: Math.max(1, recommendedQuantity),
      riskRewardRatio: Math.abs(target - entryPrice) / Math.abs(entryPrice - stopLoss)
    };
  }

  async initializeDailyScreening() {
    // Run pre-market screening at 8:30 AM
    const marketBreadth = await this.breadthAnalyzer.analyzeMarketBreadth();

    if (marketBreadth.trendingProbability > 0.6) {
      this.watchlist = await this.screener.screenTrendingStocks();
      logger.info(`Identified ${this.watchlist.length} trending candidates`);

      // Subscribe to top 20 candidates for real-time monitoring
      const topCandidates = this.watchlist.slice(0, 20).map(stock => stock.symbol);
      await this.subscribeToMarketData(topCandidates);
    }
  }

  async processMarketTick(tickData) {
    const stock = this.watchlist.find(s => s.symbol === tickData.symbol);
    if (!stock) return;

    const signal = await this.evaluateDirectionalSignal(tickData, stock);

    if (signal.strength > 0.7) {
      await this.executeDirectionalTrade(signal);
    }
  }

  async subscribeToMarketData(symbols) {
    // Placeholder for market data subscription
    logger.info(`Subscribing to market data for ${symbols.length} symbols`);
  }

  async executeDirectionalTrade(signal) {
    // Placeholder for trade execution
    logger.info(`Executing directional trade: ${JSON.stringify(signal)}`);
  }
}

module.exports = DirectionalTradingStrategy;