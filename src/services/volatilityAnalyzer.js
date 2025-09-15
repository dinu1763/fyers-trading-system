const TechnicalIndicators = require('../utils/technicalIndicators');

class VolatilityAnalyzer {
  calculateVolatilityMetrics(symbol, historicalData) {
    const atr = this.calculateATR(historicalData, 14);
    const atrPercentile = this.getATRPercentile(atr, historicalData, 50);
    const volumeRatio = this.getRelativeVolume(symbol, historicalData);

    return {
      atr,
      atrPercentile,
      volumeRatio,
      volatilityRank: atrPercentile > 70 ? 'HIGH' :
                     atrPercentile > 30 ? 'MEDIUM' : 'LOW',
      isVolatilityExpanding: atr > this.getAvgATR(historicalData, 10) * 1.5
    };
  }

  identifyVolatilityBreakout(symbol, currentPrice, historicalData) {
    const bbands = this.calculateBollingerBands(historicalData, 20, 2);
    const currentBBWidth = (bbands.upper - bbands.lower) / bbands.middle;
    const avgBBWidth = this.getAverageBBWidth(historicalData, 20);

    return {
      isBreakout: currentBBWidth > avgBBWidth * 1.3,
      direction: currentPrice > bbands.upper ? 'BULLISH' :
                currentPrice < bbands.lower ? 'BEARISH' : 'NEUTRAL',
      strength: currentBBWidth / avgBBWidth
    };
  }

  calculateATR(historicalData, period = 14) {
    return TechnicalIndicators.calculateATR(historicalData, period);
  }

  getATRPercentile(atr, historicalData, lookback = 50) {
    if (!Array.isArray(atr) || atr.length === 0) return 50;

    const currentATR = atr[atr.length - 1];
    const recentATRs = atr.slice(-Math.min(lookback, atr.length));

    const sortedATRs = [...recentATRs].sort((a, b) => a - b);
    const rank = sortedATRs.findIndex(val => val >= currentATR);

    return (rank / sortedATRs.length) * 100;
  }

  getRelativeVolume(symbol, historicalData) {
    if (!historicalData || historicalData.length < 20) return 1.0;

    const volumes = historicalData.map(d => d.volume || 0);
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;

    return avgVolume > 0 ? currentVolume / avgVolume : 1.0;
  }

  getAvgATR(historicalData, period = 10) {
    const atr = this.calculateATR(historicalData, 14);
    if (!atr || atr.length < period) return 0;

    const recentATRs = atr.slice(-period);
    return recentATRs.reduce((a, b) => a + b, 0) / recentATRs.length;
  }

  calculateBollingerBands(historicalData, period = 20, stdDev = 2) {
    const prices = historicalData.map(d => d.close);
    return TechnicalIndicators.calculateBollingerBands(prices, period, stdDev);
  }

  getAverageBBWidth(historicalData, period = 20) {
    const bbands = this.calculateBollingerBands(historicalData, period);
    if (!bbands || bbands.length < 10) return 0;

    const recentBands = bbands.slice(-10);
    const widths = recentBands.map(bb => bb.width || 0);

    return widths.reduce((a, b) => a + b, 0) / widths.length;
  }
}

module.exports = VolatilityAnalyzer;