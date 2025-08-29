const { fyersDataSocket } = require("fyers-api-v3");
const logger = require('../utils/logger');
const config = require('../config/config');
const EventEmitter = require('events');

class MarketDataService extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.isConnected = false;
    this.subscriptions = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    try {
      if (!config.fyers.accessToken) {
        throw new Error('Access token not available for market data connection');
      }

      logger.info('Creating market data socket connection...');
      this.socket = fyersDataSocket.getInstance(
        config.fyers.accessToken,
        "./logs",
        true // Enable logging
      );

      this.setupEventHandlers();

      logger.info('Connecting to market data feed...');
      this.socket.connect();

      // Manual reconnection logic since autoReconnect might not be available
      this.setupManualReconnect();

    } catch (error) {
      logger.error(`Market data connection error: ${error.message}`);
      throw error;
    }
  }

  setupManualReconnect() {
    // Implement manual reconnection logic
    this.on('disconnected', () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
          if (!this.isConnected) {
            try {
              this.socket.connect();
            } catch (error) {
              logger.error(`Reconnection attempt failed: ${error.message}`);
            }
          }
        }, delay);
      } else {
        logger.error('Max reconnection attempts reached');
      }
    });
  }

  setupEventHandlers() {
    this.socket.on("connect", () => {
      logger.info("Market data socket connected");
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Check if mode method exists before calling it
      if (typeof this.socket.mode === 'function' && this.socket.FullMode) {
        this.socket.mode(this.socket.FullMode);
        logger.info('Set to full mode');
      } else {
        logger.warn('Mode setting not available on this socket version');
      }

      this.emit('connected');
    });

    this.socket.on("message", (message) => {
      this.handleMarketData(message);
    });

    this.socket.on("error", (error) => {
      logger.error(`Market data socket error: ${error}`);
      this.isConnected = false;
      this.emit('error', error);
    });

    this.socket.on("close", () => {
      logger.info("Market data socket closed");
      this.isConnected = false;
      this.emit('disconnected');
    });
  }

  subscribe(symbols) {
    if (!this.isConnected) {
      throw new Error("Socket not connected");
    }

    try {
      const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
      this.socket.subscribe(symbolArray);
      
      symbolArray.forEach(symbol => this.subscriptions.add(symbol));
      logger.info(`Subscribed to symbols: ${symbolArray.join(', ')}`);
      
    } catch (error) {
      logger.error(`Subscription error: ${error.message}`);
      throw error;
    }
  }

  unsubscribe(symbols) {
    if (!this.isConnected) {
      throw new Error("Socket not connected");
    }

    try {
      const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
      this.socket.unsubscribe(symbolArray);
      
      symbolArray.forEach(symbol => this.subscriptions.delete(symbol));
      logger.info(`Unsubscribed from symbols: ${symbolArray.join(', ')}`);
      
    } catch (error) {
      logger.error(`Unsubscription error: ${error.message}`);
      throw error;
    }
  }

  setMode(mode) {
    if (!this.isConnected) {
      throw new Error("Socket not connected");
    }

    try {
      if (typeof this.socket.mode === 'function') {
        if (mode === 'lite' && this.socket.LiteMode) {
          this.socket.mode(this.socket.LiteMode);
          logger.info("Switched to lite mode");
        } else if (this.socket.FullMode) {
          this.socket.mode(this.socket.FullMode);
          logger.info("Switched to full mode");
        } else {
          logger.warn(`Mode ${mode} not available`);
        }
      } else {
        logger.warn('Mode switching not available on this socket version');
      }
    } catch (error) {
      logger.error(`Mode switch error: ${error.message}`);
      throw error;
    }
  }

  handleMarketData(data) {
    try {
      // Process incoming market data
      logger.debug(`Market data received: ${JSON.stringify(data)}`);
      
      // Emit different events based on data type
      if (data && data.symbol) {
        this.emit('tick', data);
        
        // Check for significant price movements
        if (data.change_percentage && Math.abs(data.change_percentage) > 2) {
          this.emit('significantMove', data);
          logger.info(`Significant movement in ${data.symbol}: ${data.change_percentage}%`);
        }
        
        // Check for volume spikes
        if (data.volume && data.avg_volume && data.volume > data.avg_volume * 2) {
          this.emit('volumeSpike', data);
          logger.info(`Volume spike in ${data.symbol}: ${data.volume}`);
        }
      }
      
    } catch (error) {
      logger.error(`Market data processing error: ${error.message}`);
    }
  }

  getSubscriptions() {
    return Array.from(this.subscriptions);
  }

  isSymbolSubscribed(symbol) {
    return this.subscriptions.has(symbol);
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      subscriptions: this.getSubscriptions(),
      reconnectAttempts: this.reconnectAttempts
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.isConnected = false;
      this.subscriptions.clear();
      logger.info("Market data socket disconnected");
    }
  }

  // Helper methods for common market data operations
  subscribeToIndices() {
    const indices = [
      "NSE:NIFTY50-INDEX",
      "NSE:NIFTYBANK-INDEX",
      "NSE:NIFTYIT-INDEX",
      "NSE:NIFTYFMCG-INDEX"
    ];
    
    this.subscribe(indices);
    logger.info("Subscribed to major indices");
  }

  subscribeToTopStocks() {
    const topStocks = [
      "NSE:RELIANCE-EQ",
      "NSE:TCS-EQ",
      "NSE:HDFCBANK-EQ",
      "NSE:INFY-EQ",
      "NSE:HINDUNILVR-EQ",
      "NSE:ICICIBANK-EQ",
      "NSE:SBIN-EQ",
      "NSE:BHARTIARTL-EQ",
      "NSE:ITC-EQ",
      "NSE:KOTAKBANK-EQ"
    ];
    
    this.subscribe(topStocks);
    logger.info("Subscribed to top stocks");
  }

  // Method to get real-time quotes for subscribed symbols
  getCurrentData() {
    return {
      connected: this.isConnected,
      subscriptions: this.getSubscriptions(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = MarketDataService;
