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
        type: orderData.type || 2,
        side: orderData.side,
        productType: orderData.productType || "CNC",
        validity: orderData.validity || "DAY",
        disclosedQty: orderData.disclosedQty || 0,
        offlineOrder: false
      };

      // Add limitPrice if provided (don't check for > 0, as 0 might be valid)
      if (orderData.limitPrice !== undefined && orderData.limitPrice !== null) {
        order.limitPrice = parseFloat(orderData.limitPrice);
      }

      // Add stopPrice if provided
      if (orderData.stopPrice !== undefined && orderData.stopPrice !== null) {
        order.stopPrice = parseFloat(orderData.stopPrice);
      }

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
    // Basic validation
    if (!order.symbol || !order.qty || !order.side) {
      throw new Error('Missing required order fields: symbol, qty, side');
    }

    // Type-specific validation
    if ([1, 3].includes(order.type) && (!order.limitPrice || order.limitPrice <= 0)) {
      throw new Error('Limit price required for limit and stop-limit orders');
    }

    if ([3, 4].includes(order.type) && (!order.stopPrice || order.stopPrice <= 0)) {
      throw new Error('Stop price required for stop orders');
    }
    
    // For stop-limit orders (type 3), ensure proper price relationship
    if (order.type === 3) {
      if (order.side === 1 && order.limitPrice >= order.stopPrice) {
        throw new Error('For BUY stop orders: limitPrice must be less than stopPrice');
      }
      if (order.side === -1 && order.limitPrice >= order.stopPrice) {
        throw new Error('For SELL stop orders: limitPrice must be less than stopPrice');
      }
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
