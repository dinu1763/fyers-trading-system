const { fyersModel } = require("fyers-api-v3");
const config = require('../config/config');
const logger = require('../utils/logger');

class FyersService {
  constructor() {
    this.fyers = new fyersModel({
      path: "./logs",
      enableLogging: true
    });
    
    this.fyers.setAppId(config.fyers.appId);
    this.fyers.setRedirectUrl(config.fyers.redirectUrl);
    
    if (config.fyers.accessToken) {
      this.fyers.setAccessToken(config.fyers.accessToken);
    }
  }

  async generateAuthUrl() {
    try {
      const authUrl = this.fyers.generateAuthCode();
      logger.info('Generated authorization URL');
      return authUrl;
    } catch (error) {
      logger.error(`Auth URL generation error: ${error.message}`);
      throw error;
    }
  }

  async generateAccessToken(authCode) {
    try {
      const response = await this.fyers.generate_access_token({
        client_id: config.fyers.appId,
        secret_key: config.fyers.secretKey,
        auth_code: authCode
      });
      
      if (response.s === 'ok') {
        this.fyers.setAccessToken(response.access_token);
        logger.info('Access token generated successfully');
        return response.access_token;
      } else {
        throw new Error(`Token generation failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Authentication error: ${error.message}`);
      throw error;
    }
  }

  async getProfile() {
    try {
      const response = await this.fyers.get_profile();
      if (response.s === 'ok') {
        logger.info('Profile fetched successfully');
        return response;
      } else {
        throw new Error(`Profile fetch failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Profile fetch error: ${error.message}`);
      throw error;
    }
  }

  async getFunds() {
    try {
      const response = await this.fyers.get_funds();
      if (response.s === 'ok') {
        logger.info('Funds fetched successfully');
        logger.debug('Funds response:', JSON.stringify(response, null, 2));

        // Transform the response to include data property for consistency
        const transformedResponse = {
          s: response.s,
          code: response.code,
          message: response.message,
          data: {}
        };

        // Extract useful fund information
        if (response.fund_limit && Array.isArray(response.fund_limit)) {
          const fundData = {};
          response.fund_limit.forEach(fund => {
            switch(fund.id) {
              case 1: // Total Balance
                fundData.total_balance = fund.equityAmount;
                break;
              case 3: // Clear Balance
                fundData.available_cash = fund.equityAmount;
                fundData.fund_limit = fund.equityAmount;
                break;
              case 10: // Available Balance
                fundData.availablecash = fund.equityAmount;
                break;
            }
          });
          transformedResponse.data = fundData;
        }

        return transformedResponse;
      } else {
        throw new Error(`Funds fetch failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Funds fetch error: ${error.message}`);
      throw error;
    }
  }

  async getQuotes(symbols) {
    try {
      const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
      const response = await this.fyers.getQuotes(symbolArray);

      if (response.s === 'ok') {
        logger.debug(`Quotes fetched for ${symbolArray.length} symbols`);
        logger.debug('Quotes response:', JSON.stringify(response, null, 2));

        // Transform the response to a more usable format
        const transformedResponse = {
          s: response.s,
          code: response.code,
          message: response.message,
          data: {}
        };

        // Convert the 'd' array format to a keyed object format
        if (response.d && Array.isArray(response.d)) {
          response.d.forEach(item => {
            if (item.n && item.v) {
              transformedResponse.data[item.n] = {
                ...item.v,
                ltp: item.v.lp, // Map 'lp' to 'ltp' for consistency
                prev_close_price: item.v.prev_close_price,
                volume: item.v.volume,
                high_price: item.v.high_price,
                low_price: item.v.low_price,
                open_price: item.v.open_price
              };
            }
          });
        }

        return transformedResponse;
      } else {
        throw new Error(`Quotes fetch failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Quotes fetch error: ${error.message}`);
      throw error;
    }
  }

  async getMarketDepth(symbols) {
    try {
      const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
      const response = await this.fyers.getMarketDepth({
        symbol: symbolArray,
        ohlcv_flag: 1
      });
      
      if (response.s === 'ok') {
        logger.debug(`Market depth fetched for ${symbolArray.length} symbols`);
        return response;
      } else {
        throw new Error(`Market depth fetch failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Market depth fetch error: ${error.message}`);
      throw error;
    }
  }

  async getHistoricalData(symbol, resolution, days = 30) {
    try {
      // Calculate date range
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(toDate.getDate() - days);

      const formatDate = (date) => {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
      };

      const response = await this.fyers.getHistory({
        symbol: symbol,
        resolution: resolution,
        date_format: 1,
        range_from: formatDate(fromDate),
        range_to: formatDate(toDate),
        cont_flag: 1
      });

      if (response.s === 'ok') {
        logger.debug(`Historical data fetched for ${symbol}`);

        // Transform candle data to a more usable format
        if (response.candles && Array.isArray(response.candles)) {
          const transformedData = response.candles.map(candle => ({
            timestamp: candle[0],
            open: candle[1],
            high: candle[2],
            low: candle[3],
            close: candle[4],
            volume: candle[5] || 0
          }));

          return transformedData;
        }

        return [];
      } else {
        throw new Error(`Historical data fetch failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Historical data fetch error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = FyersService;
