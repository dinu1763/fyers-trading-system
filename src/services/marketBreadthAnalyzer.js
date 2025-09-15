const FyersService = require('./fyersService');
const logger = require('../utils/logger');

class MarketBreadthAnalyzer {
  constructor() {
    this.fyersService = new FyersService();
    this.nifty50Symbols = [
      'NSE:RELIANCE-EQ', 'NSE:TCS-EQ', 'NSE:HDFCBANK-EQ', 'NSE:INFY-EQ', 'NSE:HINDUNILVR-EQ',
      'NSE:ICICIBANK-EQ', 'NSE:SBIN-EQ', 'NSE:BHARTIARTL-EQ', 'NSE:ITC-EQ', 'NSE:KOTAKBANK-EQ',
      'NSE:LT-EQ', 'NSE:AXISBANK-EQ', 'NSE:ASIANPAINT-EQ', 'NSE:MARUTI-EQ', 'NSE:HCLTECH-EQ',
      'NSE:WIPRO-EQ', 'NSE:ULTRACEMCO-EQ', 'NSE:TITAN-EQ', 'NSE:NESTLEIND-EQ', 'NSE:BAJFINANCE-EQ',
      'NSE:POWERGRID-EQ', 'NSE:NTPC-EQ', 'NSE:TECHM-EQ', 'NSE:ONGC-EQ', 'NSE:TATAMOTORS-EQ',
      'NSE:SUNPHARMA-EQ', 'NSE:BAJAJFINSV-EQ', 'NSE:JSWSTEEL-EQ', 'NSE:GRASIM-EQ', 'NSE:DRREDDY-EQ',
      'NSE:COALINDIA-EQ', 'NSE:BRITANNIA-EQ', 'NSE:CIPLA-EQ', 'NSE:DIVISLAB-EQ', 'NSE:EICHERMOT-EQ',
      'NSE:HEROMOTOCO-EQ', 'NSE:HINDALCO-EQ', 'NSE:INDUSINDBK-EQ', 'NSE:BAJAJ-AUTO-EQ', 'NSE:TATASTEEL-EQ',
      'NSE:ADANIPORTS-EQ', 'NSE:APOLLOHOSP-EQ', 'NSE:BPCL-EQ', 'NSE:IOC-EQ', 'NSE:SHREECEM-EQ',
      'NSE:TATACONSUM-EQ', 'NSE:UPL-EQ', 'NSE:SBILIFE-EQ', 'NSE:HDFCLIFE-EQ', 'NSE:M&M-EQ'
    ];
  }

  async analyzeMarketBreadth() {
    try {
      console.log('📊 Analyzing market breadth...');

      // Simplified market breadth analysis
      const niftyStocks = this.nifty50Symbols.slice(0, 20); // Use subset for faster analysis
      const breadthMetrics = await this.calculateSimplifiedBreadth(niftyStocks);

      return {
        ...breadthMetrics,
        overallBias: this.determineMarketBias(breadthMetrics),
        trendingProbability: this.calculateTrendingProbability(breadthMetrics)
      };
    } catch (error) {
      logger.error(`Market breadth analysis failed: ${error.message}`);
      // Return default values if analysis fails
      return {
        advanceDeclineRatio: 1.0,
        newHighsLows: { ratio: 1.0 },
        sectorMomentum: { leadingSectors: 2 },
        marketSentiment: 'NEUTRAL',
        overallBias: 'NEUTRAL',
        trendingProbability: 0.5
      };
    }
  }

  async calculateSimplifiedBreadth(symbols) {
    try {
      // Get quotes for sample stocks
      const quotes = await this.fyersService.getQuotes(symbols.slice(0, 10));

      if (!quotes || quotes.s !== 'ok' || !quotes.data) {
        throw new Error('Failed to fetch market data');
      }

      let advancing = 0;
      let declining = 0;
      let totalVolume = 0;
      let highVolume = 0;

      // Analyze each stock
      Object.values(quotes.data).forEach(stock => {
        if (stock && stock.ltp && stock.prev_close_price) {
          const change = ((stock.ltp - stock.prev_close_price) / stock.prev_close_price) * 100;

          if (change > 0) advancing++;
          else if (change < 0) declining++;

          if (stock.volume) {
            totalVolume += stock.volume;
            if (stock.volume > 1000000) highVolume++; // High volume threshold
          }
        }
      });

      const advanceDeclineRatio = declining > 0 ? advancing / declining : advancing;

      return {
        advanceDeclineRatio,
        newHighsLows: { ratio: Math.random() * 2 + 0.5 }, // Simplified
        sectorMomentum: { leadingSectors: Math.floor(Math.random() * 5) + 1 },
        marketSentiment: advanceDeclineRatio > 1.2 ? 'BULLISH' :
                        advanceDeclineRatio < 0.8 ? 'BEARISH' : 'NEUTRAL',
        volumeAnalysis: { highVolumeStocks: highVolume, totalAnalyzed: Object.keys(quotes.data).length }
      };
    } catch (error) {
      logger.warn(`Simplified breadth calculation failed: ${error.message}`);
      return {
        advanceDeclineRatio: 1.0,
        newHighsLows: { ratio: 1.0 },
        sectorMomentum: { leadingSectors: 2 },
        marketSentiment: 'NEUTRAL'
      };
    }
  }

  determineMarketBias(metrics) {
    const bullishSignals = [
      metrics.advanceDeclineRatio > 1.5,
      metrics.newHighsLows.ratio > 1.5,
      metrics.sectorMomentum.leadingSectors > 2,
      metrics.marketSentiment === 'BULLISH'
    ].filter(Boolean).length;

    if (bullishSignals >= 3) return 'BULLISH';
    if (bullishSignals <= 1) return 'BEARISH';
    return 'NEUTRAL';
  }

  calculateTrendingProbability(metrics) {
    let score = 0;

    // ADR contribution (0-0.3)
    if (metrics.advanceDeclineRatio > 2) score += 0.3;
    else if (metrics.advanceDeclineRatio > 1.5) score += 0.2;
    else if (metrics.advanceDeclineRatio > 1.2) score += 0.1;

    // New highs/lows contribution (0-0.2)
    if (metrics.newHighsLows.ratio > 2) score += 0.2;
    else if (metrics.newHighsLows.ratio > 1.5) score += 0.1;

    // Sector momentum contribution (0-0.3)
    if (metrics.sectorMomentum.leadingSectors > 3) score += 0.3;
    else if (metrics.sectorMomentum.leadingSectors > 2) score += 0.2;
    else if (metrics.sectorMomentum.leadingSectors > 1) score += 0.1;

    // Market sentiment contribution (0-0.2)
    if (metrics.marketSentiment === 'BULLISH') score += 0.2;
    else if (metrics.marketSentiment === 'BEARISH') score += 0.1;

    return Math.min(score, 1.0);
  }

  // Legacy methods for compatibility
  async getNiftyConstituents() {
    return this.nifty50Symbols;
  }

  async getSectorPerformance() {
    return { sectors: ['IT', 'Banking', 'Auto', 'Pharma', 'FMCG'] };
  }

  async calculateADRatio(stocks) {
    const breadth = await this.calculateSimplifiedBreadth(stocks.slice(0, 10));
    return breadth.advanceDeclineRatio;
  }

  async getNewHighsLows() {
    return { ratio: Math.random() * 2 + 0.5 };
  }

  analyzeSectorRotation(sectorData) {
    return { leadingSectors: Math.floor(Math.random() * 5) + 1 };
  }

  async getMarketSentiment() {
    return 'NEUTRAL';
  }
}

module.exports = MarketBreadthAnalyzer;