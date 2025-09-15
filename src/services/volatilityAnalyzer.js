class VolatilityAnalyzer {
  calculateVolatilityMetrics(symbol, historicalData) {
    const atr = this.calculateATR(historicalData, 14);
    const atrPercentile = this.getATRPercentile(atr, historicalData, 50);
    const volumeRatio = this.getRelativeVolume(symbol);
    
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
}