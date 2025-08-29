const FyersService = require('./fyersService');
const logger = require('../utils/logger');

class OrderService extends FyersService {
  constructor() {
    super();
  }

  async placeOrder(orderData) {
    try {
      const order = {
        symbol: orderData.symbol,
        qty: orderData.quantity,
        type: orderData.type || 2, // 1: Limit, 2: Market, 3: SL, 4: SL-M
        side: orderData.side, // 1: Buy, -1: Sell
        productType: orderData.productType || "CNC", // CNC, INTRADAY, MARGIN, CO, BO
        limitPrice: orderData.limitPrice || 0,
        stopPrice: orderData.stopPrice || 0,
        validity: orderData.validity || "DAY", // DAY, IOC
        disclosedQty: orderData.disclosedQty || 0,
        offlineOrder: false
      };

      // Validate order data
      this.validateOrderData(order);

      logger.info(`Placing order: ${JSON.stringify(order)}`);
      const response = await this.fyers.place_order(order);
      
      if (response.s === 'ok') {
        logger.info(`Order placed successfully: ${response.id}`);
        return response;
      } else {
        throw new Error(`Order placement failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Order placement error: ${error.message}`);
      throw error;
    }
  }

  async modifyOrder(orderId, modifications) {
    try {
      const modifyData = {
        id: orderId,
        ...modifications
      };

      logger.info(`Modifying order ${orderId}: ${JSON.stringify(modifications)}`);
      const response = await this.fyers.modify_order(modifyData);
      
      if (response.s === 'ok') {
        logger.info(`Order modified successfully: ${orderId}`);
        return response;
      } else {
        throw new Error(`Order modification failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Order modification error: ${error.message}`);
      throw error;
    }
  }

  async cancelOrder(orderId) {
    try {
      logger.info(`Cancelling order: ${orderId}`);
      const response = await this.fyers.cancel_order({ id: orderId });
      
      if (response.s === 'ok') {
        logger.info(`Order cancelled successfully: ${orderId}`);
        return response;
      } else {
        throw new Error(`Order cancellation failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Order cancellation error: ${error.message}`);
      throw error;
    }
  }

  async getOrders() {
    try {
      const response = await this.fyers.get_orders();
      if (response.s === 'ok') {
        logger.debug('Orders fetched successfully');
        return response;
      } else {
        throw new Error(`Get orders failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Get orders error: ${error.message}`);
      throw error;
    }
  }

  async getPositions() {
    try {
      const response = await this.fyers.get_positions();
      if (response.s === 'ok') {
        logger.debug('Positions fetched successfully');
        return response;
      } else {
        throw new Error(`Get positions failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Get positions error: ${error.message}`);
      throw error;
    }
  }

  async getHoldings() {
    try {
      const response = await this.fyers.get_holdings();
      if (response.s === 'ok') {
        logger.debug('Holdings fetched successfully');
        return response;
      } else {
        throw new Error(`Get holdings failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Get holdings error: ${error.message}`);
      throw error;
    }
  }

  async getTradebook() {
    try {
      const response = await this.fyers.get_tradebook();
      if (response.s === 'ok') {
        logger.debug('Tradebook fetched successfully');
        return response;
      } else {
        throw new Error(`Get tradebook failed: ${response.message}`);
      }
    } catch (error) {
      logger.error(`Get tradebook error: ${error.message}`);
      throw error;
    }
  }

  validateOrderData(order) {
    const required = ['symbol', 'qty', 'side'];
    const missing = required.filter(field => !order[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required order fields: ${missing.join(', ')}`);
    }

    if (order.qty <= 0) {
      throw new Error('Order quantity must be greater than 0');
    }

    if (![1, -1].includes(order.side)) {
      throw new Error('Order side must be 1 (Buy) or -1 (Sell)');
    }

    if (![1, 2, 3, 4].includes(order.type)) {
      throw new Error('Invalid order type');
    }

    if (order.type === 1 && (!order.limitPrice || order.limitPrice <= 0)) {
      throw new Error('Limit price required for limit orders');
    }

    if ([3, 4].includes(order.type) && (!order.stopPrice || order.stopPrice <= 0)) {
      throw new Error('Stop price required for stop orders');
    }
  }

  // Helper method to create common order types
  createMarketOrder(symbol, quantity, side, productType = "CNC") {
    return {
      symbol,
      quantity,
      side,
      type: 2, // Market order
      productType
    };
  }

  createLimitOrder(symbol, quantity, side, limitPrice, productType = "CNC") {
    return {
      symbol,
      quantity,
      side,
      type: 1, // Limit order
      limitPrice,
      productType
    };
  }

  createStopLossOrder(symbol, quantity, side, stopPrice, productType = "CNC") {
    return {
      symbol,
      quantity,
      side,
      type: 4, // Stop-loss market order
      stopPrice,
      productType
    };
  }
}

module.exports = OrderService;
