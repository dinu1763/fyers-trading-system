class TechnicalIndicators {
  static calculateSMA(data, period) {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
    return result;
  }

  static calculateEMA(data, period) {
    const multiplier = 2 / (period + 1);
    const result = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      result.push((data[i] * multiplier) + (result[i - 1] * (1 - multiplier)));
    }
    return result;
  }

  static calculateATR(ohlcData, period = 14) {
    const trueRanges = [];
    
    for (let i = 1; i < ohlcData.length; i++) {
      const high = ohlcData[i].high;
      const low = ohlcData[i].low;
      const prevClose = ohlcData[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }
    
    return this.calculateSMA(trueRanges, period);
  }

  static calculateRSI(prices, period = 14) {
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const avgGains = this.calculateSMA(gains, period);
    const avgLosses = this.calculateSMA(losses, period);
    
    return avgGains.map((gain, i) => {
      const rs = gain / avgLosses[i];
      return 100 - (100 / (1 + rs));
    });
  }

  static calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    
    const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    const histogram = macdLine.map((macd, i) => macd - signalLine[i]);
    
    return { macdLine, signalLine, histogram };
  }

  static calculateBollingerBands(prices, period = 20, stdDev = 2) {
    const sma = this.calculateSMA(prices, period);
    const bands = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = sma[i - period + 1];
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);
      
      bands.push({
        upper: mean + (standardDeviation * stdDev),
        middle: mean,
        lower: mean - (standardDeviation * stdDev),
        width: (standardDeviation * stdDev * 2) / mean
      });
    }
    
    return bands;
  }

  static calculateADX(ohlcData, period = 14) {
    const trueRanges = [];
    const plusDM = [];
    const minusDM = [];
    
    for (let i = 1; i < ohlcData.length; i++) {
      const current = ohlcData[i];
      const previous = ohlcData[i - 1];
      
      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      );
      trueRanges.push(tr);
      
      const upMove = current.high - previous.high;
      const downMove = previous.low - current.low;
      
      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }
    
    const atr = this.calculateSMA(trueRanges, period);
    const plusDI = this.calculateSMA(plusDM, period).map((dm, i) => (dm / atr[i]) * 100);
    const minusDI = this.calculateSMA(minusDM, period).map((dm, i) => (dm / atr[i]) * 100);
    
    const dx = plusDI.map((plus, i) => {
      const sum = plus + minusDI[i];
      return sum === 0 ? 0 : Math.abs(plus - minusDI[i]) / sum * 100;
    });
    
    const adx = this.calculateSMA(dx, period);
    
    return { adx, plusDI, minusDI };
  }
}

module.exports = TechnicalIndicators;