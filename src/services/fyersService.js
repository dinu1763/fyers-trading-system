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
        return response;
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
        return response;
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

  async getHistoricalData(symbol, resolution, dateFrom, dateTo) {
    try {
      const response = await this.fyers.history({
        symbol: symbol,
        resolution: resolution,
        date_format: 1,
        range_from: dateFrom,
        range_to: dateTo,
        cont_flag: 1
      });
      
      if (response.s === 'ok') {
        logger.debug(`Historical data fetched for ${symbol}`);
        return response;
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
