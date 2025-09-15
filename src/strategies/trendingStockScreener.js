const FyersService = require('../services/fyersService');
const TechnicalIndicators = require('../utils/technicalIndicators');
const logger = require('../utils/logger');

class TrendingStockScreener {
  constructor() {
    this.fyersService = new FyersService();
    this.screeningCriteria = {
      minPrice: 50,
      maxPrice: 5000,
      minVolume: 100000,
      minATR: 1.5,
      gapThreshold: 1.5,
      preMarketVolumeRatio: 1.5,
      adxThreshold: 25,
      rsiMomentumMin: 60,
      rsiMomentumMax: 40
    };
  }

  async screenTrendingStocks() {
    try {
      const nifty500Stocks = await this.getNifty500Universe();
      const trendingCandidates = [];

      logger.info(`Screening ${nifty500Stocks.length} stocks for trending opportunities`);

      for (const stock of nifty500Stocks) {
        try {
          const analysis = await this.analyzeStock(stock);
          
          if (this.meetsTrendingCriteria(analysis)) {
            trendingCandidates.push({
              symbol: stock.symbol,
              score: this.calculateTrendingScore(analysis),
              direction: analysis.expectedDirection,
              gapPercent: analysis.gapPercent,
              volumeRatio: analysis.volumeRatio,
              atr: analysis.atr,
              adx: analysis.adx,
              rsi: analysis.rsi,
              ...analysis
            });
          }
        } catch (error) {
          logger.warn(`Failed to analyze ${stock.symbol}: ${error.message}`);
        }
      }

      return trendingCandidates.sort((a, b) => b.score - a.score);
    } catch (error) {
      logger.error(`Trending screening failed: ${error.message}`);
      throw error;
    }
  }

  async analyzeStock(stock) {
    // Get historical data (last 50 days)
    const historicalData = await this.fyersService.getHistoricalData(
      stock.symbol, 
      '1D', 
      50
    );

    if (!historicalData || historicalData.length < 30) {
      throw new Error('Insufficient historical data');
    }

    const prices = historicalData.map(d => d.close);
    const volumes = historicalData.map(d => d.volume);
    const currentPrice = prices[prices.length - 1];
    const previousClose = prices[prices.length - 2];

    // Calculate technical indicators
    const atr = TechnicalIndicators.calculateATR(historicalData, 14);
    const rsi = TechnicalIndicators.calculateRSI(prices, 14);
    const adxData = TechnicalIndicators.calculateADX(historicalData, 14);
    const macd = TechnicalIndicators.calculateMACD(prices);
    const bbands = TechnicalIndicators.calculateBollingerBands(prices, 20, 2);

    const currentATR = atr[atr.length - 1];
    const currentRSI = rsi[rsi.length - 1];
    const currentADX = adxData.adx[adxData.adx.length - 1];
    const currentBB = bbands[bbands.length - 1];

    // Calculate gap percentage
    const gapPercent = ((currentPrice - previousClose) / previousClose) * 100;

    // Calculate volume ratio
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;

    // Determine expected direction
    let expectedDirection = 'NEUTRAL';
    if (currentRSI > 60 && gapPercent > 1) expectedDirection = 'BULLISH';
    else if (currentRSI < 40 && gapPercent < -1) expectedDirection = 'BEARISH';

    return {
      symbol: stock.symbol,
      currentPrice,
      gapPercent,
      volumeRatio,
      atr: currentATR,
      rsi: currentRSI,
      adx: currentADX,
      macd: macd.macdLine[macd.macdLine.length - 1],
      bbWidth: currentBB.width,
      avgBBWidth: bbands.slice(-10).reduce((sum, bb) => sum + bb.width, 0) / 10,
      expectedDirection,
      isVolatilityExpanding: currentATR > (atr.slice(-10).reduce((a, b) => a + b, 0) / 10) * 1.2
    };
  }

  meetsTrendingCriteria(analysis) {
    return (
      analysis.adx > this.screeningCriteria.adxThreshold &&
      analysis.atr > this.screeningCriteria.minATR &&
      analysis.volumeRatio > this.screeningCriteria.preMarketVolumeRatio &&
      Math.abs(analysis.gapPercent) > this.screeningCriteria.gapThreshold &&
      analysis.bbWidth > analysis.avgBBWidth * 1.1 &&
      analysis.currentPrice >= this.screeningCriteria.minPrice &&
      analysis.currentPrice <= this.screeningCriteria.maxPrice
    );
  }

  calculateTrendingScore(analysis) {
    let score = 0;
    
    // ADX contribution (0-30 points)
    score += Math.min(analysis.adx, 50) * 0.6;
    
    // Volume ratio contribution (0-20 points)
    score += Math.min(analysis.volumeRatio, 5) * 4;
    
    // Gap contribution (0-20 points)
    score += Math.min(Math.abs(analysis.gapPercent), 5) * 4;
    
    // ATR contribution (0-15 points)
    score += Math.min(analysis.atr, 10) * 1.5;
    
    // Volatility expansion bonus (0-15 points)
    if (analysis.isVolatilityExpanding) score += 15;
    
    return Math.min(score, 100);
  }

  async getNifty500Universe() {
    // For now, return a subset of popular stocks
    // In production, you would fetch the actual Nifty 500 list
    return [
      { symbol: 'NSE:RELIANCE-EQ' },
      { symbol: 'NSE:TCS-EQ' },
      { symbol: 'NSE:HDFCBANK-EQ' },
      { symbol: 'NSE:INFY-EQ' },
      { symbol: 'NSE:ICICIBANK-EQ' },
      { symbol: 'NSE:SBIN-EQ' },
      { symbol: 'NSE:BHARTIARTL-EQ' },
      { symbol: 'NSE:ITC-EQ' },
      { symbol: 'NSE:KOTAKBANK-EQ' },
      { symbol: 'NSE:LT-EQ' },
      { symbol: 'NSE:HCLTECH-EQ' },
      { symbol: 'NSE:ASIANPAINT-EQ' },
      { symbol: 'NSE:MARUTI-EQ' },
      { symbol: 'NSE:TITAN-EQ' },
      { symbol: 'NSE:ULTRACEMCO-EQ' },
      { symbol: 'NSE:WIPRO-EQ' },
      { symbol: 'NSE:NESTLEIND-EQ' },
      { symbol: 'NSE:BAJFINANCE-EQ' },
      { symbol: 'NSE:TECHM-EQ' },
      { symbol: 'NSE:POWERGRID-EQ' }
    ];
  }
}

module.exports = TrendingStockScreener;