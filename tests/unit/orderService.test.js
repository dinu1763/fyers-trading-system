const OrderService = require('../../src/services/orderService');

// Mock the parent FyersService
jest.mock('../../src/services/fyersService');

describe('OrderService', () => {
  let orderService;

  beforeEach(() => {
    orderService = new OrderService();
    // Mock the fyers object
    orderService.fyers = {
      place_order: jest.fn(),
      modify_order: jest.fn(),
      cancel_order: jest.fn(),
      get_orders: jest.fn(),
      get_positions: jest.fn(),
      get_holdings: jest.fn(),
      get_tradebook: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('placeOrder', () => {
    it('should place a market order successfully', async () => {
      const orderData = {
        symbol: 'NSE:SBIN-EQ',
        quantity: 10,
        side: 1,
        type: 2
      };

      const mockResponse = {
        s: 'ok',
        id: 'ORDER123'
      };

      orderService.fyers.place_order.mockResolvedValue(mockResponse);

      const result = await orderService.placeOrder(orderData);
      expect(result).toEqual(mockResponse);
      expect(orderService.fyers.place_order).toHaveBeenCalledWith({
        symbol: 'NSE:SBIN-EQ',
        qty: 10,
        type: 2,
        side: 1,
        productType: 'CNC',
        limitPrice: 0,
        stopPrice: 0,
        validity: 'DAY',
        disclosedQty: 0,
        offlineOrder: false
      });
    });

    it('should throw error for invalid order data', async () => {
      const invalidOrderData = {
        symbol: 'NSE:SBIN-EQ',
        quantity: 0, // Invalid quantity
        side: 1
      };

      await expect(orderService.placeOrder(invalidOrderData))
        .rejects.toThrow('Order quantity must be greater than 0');
    });

    it('should throw error for missing required fields', async () => {
      const incompleteOrderData = {
        symbol: 'NSE:SBIN-EQ'
        // Missing quantity and side
      };

      await expect(orderService.placeOrder(incompleteOrderData))
        .rejects.toThrow('Missing required order fields: qty, side');
    });
  });

  describe('validateOrderData', () => {
    it('should validate correct order data', () => {
      const validOrder = {
        symbol: 'NSE:SBIN-EQ',
        qty: 10,
        side: 1,
        type: 2
      };

      expect(() => orderService.validateOrderData(validOrder)).not.toThrow();
    });

    it('should throw error for invalid side', () => {
      const invalidOrder = {
        symbol: 'NSE:SBIN-EQ',
        qty: 10,
        side: 2, // Invalid side
        type: 2
      };

      expect(() => orderService.validateOrderData(invalidOrder))
        .toThrow('Order side must be 1 (Buy) or -1 (Sell)');
    });

    it('should throw error for limit order without limit price', () => {
      const invalidOrder = {
        symbol: 'NSE:SBIN-EQ',
        qty: 10,
        side: 1,
        type: 1, // Limit order
        limitPrice: 0 // Missing limit price
      };

      expect(() => orderService.validateOrderData(invalidOrder))
        .toThrow('Limit price required for limit orders');
    });

    it('should throw error for stop order without stop price', () => {
      const invalidOrder = {
        symbol: 'NSE:SBIN-EQ',
        qty: 10,
        side: 1,
        type: 4, // Stop order
        stopPrice: 0 // Missing stop price
      };

      expect(() => orderService.validateOrderData(invalidOrder))
        .toThrow('Stop price required for stop orders');
    });
  });

  describe('helper methods', () => {
    it('should create market order correctly', () => {
      const order = orderService.createMarketOrder('NSE:SBIN-EQ', 10, 1, 'INTRADAY');
      
      expect(order).toEqual({
        symbol: 'NSE:SBIN-EQ',
        quantity: 10,
        side: 1,
        type: 2,
        productType: 'INTRADAY'
      });
    });

    it('should create limit order correctly', () => {
      const order = orderService.createLimitOrder('NSE:SBIN-EQ', 10, 1, 500);
      
      expect(order).toEqual({
        symbol: 'NSE:SBIN-EQ',
        quantity: 10,
        side: 1,
        type: 1,
        limitPrice: 500,
        productType: 'CNC'
      });
    });

    it('should create stop-loss order correctly', () => {
      const order = orderService.createStopLossOrder('NSE:SBIN-EQ', 10, -1, 480);
      
      expect(order).toEqual({
        symbol: 'NSE:SBIN-EQ',
        quantity: 10,
        side: -1,
        type: 4,
        stopPrice: 480,
        productType: 'CNC'
      });
    });
  });

  describe('modifyOrder', () => {
    it('should modify order successfully', async () => {
      const mockResponse = { s: 'ok' };
      orderService.fyers.modify_order.mockResolvedValue(mockResponse);

      const result = await orderService.modifyOrder('ORDER123', { qty: 20 });
      expect(result).toEqual(mockResponse);
      expect(orderService.fyers.modify_order).toHaveBeenCalledWith({
        id: 'ORDER123',
        qty: 20
      });
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order successfully', async () => {
      const mockResponse = { s: 'ok' };
      orderService.fyers.cancel_order.mockResolvedValue(mockResponse);

      const result = await orderService.cancelOrder('ORDER123');
      expect(result).toEqual(mockResponse);
      expect(orderService.fyers.cancel_order).toHaveBeenCalledWith({ id: 'ORDER123' });
    });
  });

  describe('getOrders', () => {
    it('should fetch orders successfully', async () => {
      const mockResponse = {
        s: 'ok',
        data: { orderBook: [] }
      };
      orderService.fyers.get_orders.mockResolvedValue(mockResponse);

      const result = await orderService.getOrders();
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getPositions', () => {
    it('should fetch positions successfully', async () => {
      const mockResponse = {
        s: 'ok',
        data: { netPositions: [] }
      };
      orderService.fyers.get_positions.mockResolvedValue(mockResponse);

      const result = await orderService.getPositions();
      expect(result).toEqual(mockResponse);
    });
  });
});
