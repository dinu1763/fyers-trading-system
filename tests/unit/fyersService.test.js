const FyersService = require('../../src/services/fyersService');

// Mock the fyers-api-v3 module
jest.mock('fyers-api-v3', () => ({
  fyersModel: jest.fn().mockImplementation(() => ({
    setAppId: jest.fn(),
    setRedirectUrl: jest.fn(),
    setAccessToken: jest.fn(),
    generateAuthCode: jest.fn().mockReturnValue('https://api.fyers.in/auth'),
    generate_access_token: jest.fn(),
    get_profile: jest.fn(),
    get_funds: jest.fn(),
    getQuotes: jest.fn(),
    getMarketDepth: jest.fn(),
    history: jest.fn()
  }))
}));

describe('FyersService', () => {
  let fyersService;

  beforeEach(() => {
    fyersService = new FyersService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAuthUrl', () => {
    it('should generate authorization URL', async () => {
      const url = await fyersService.generateAuthUrl();
      expect(url).toBe('https://api.fyers.in/auth');
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token successfully', async () => {
      const mockResponse = {
        s: 'ok',
        access_token: 'test_access_token'
      };
      
      fyersService.fyers.generate_access_token.mockResolvedValue(mockResponse);
      
      const token = await fyersService.generateAccessToken('test_auth_code');
      expect(token).toBe('test_access_token');
    });

    it('should throw error on failed token generation', async () => {
      const mockResponse = {
        s: 'error',
        message: 'Invalid auth code'
      };
      
      fyersService.fyers.generate_access_token.mockResolvedValue(mockResponse);
      
      await expect(fyersService.generateAccessToken('invalid_code'))
        .rejects.toThrow('Token generation failed: Invalid auth code');
    });
  });

  describe('getProfile', () => {
    it('should fetch profile successfully', async () => {
      const mockResponse = {
        s: 'ok',
        data: { name: 'Test User', email: 'test@example.com' }
      };
      
      fyersService.fyers.get_profile.mockResolvedValue(mockResponse);
      
      const profile = await fyersService.getProfile();
      expect(profile).toEqual(mockResponse);
    });

    it('should throw error on failed profile fetch', async () => {
      const mockResponse = {
        s: 'error',
        message: 'Unauthorized'
      };
      
      fyersService.fyers.get_profile.mockResolvedValue(mockResponse);
      
      await expect(fyersService.getProfile())
        .rejects.toThrow('Profile fetch failed: Unauthorized');
    });
  });

  describe('getFunds', () => {
    it('should fetch funds successfully', async () => {
      const mockResponse = {
        s: 'ok',
        data: { fund_limit: 100000 }
      };
      
      fyersService.fyers.get_funds.mockResolvedValue(mockResponse);
      
      const funds = await fyersService.getFunds();
      expect(funds).toEqual(mockResponse);
    });
  });

  describe('getQuotes', () => {
    it('should fetch quotes for single symbol', async () => {
      const mockResponse = {
        s: 'ok',
        data: { 'NSE:SBIN-EQ': { ltp: 500 } }
      };
      
      fyersService.fyers.getQuotes.mockResolvedValue(mockResponse);
      
      const quotes = await fyersService.getQuotes('NSE:SBIN-EQ');
      expect(quotes).toEqual(mockResponse);
      expect(fyersService.fyers.getQuotes).toHaveBeenCalledWith(['NSE:SBIN-EQ']);
    });

    it('should fetch quotes for multiple symbols', async () => {
      const symbols = ['NSE:SBIN-EQ', 'NSE:TCS-EQ'];
      const mockResponse = {
        s: 'ok',
        data: {
          'NSE:SBIN-EQ': { ltp: 500 },
          'NSE:TCS-EQ': { ltp: 3000 }
        }
      };
      
      fyersService.fyers.getQuotes.mockResolvedValue(mockResponse);
      
      const quotes = await fyersService.getQuotes(symbols);
      expect(quotes).toEqual(mockResponse);
      expect(fyersService.fyers.getQuotes).toHaveBeenCalledWith(symbols);
    });
  });

  describe('getHistoricalData', () => {
    it('should fetch historical data successfully', async () => {
      const mockResponse = {
        s: 'ok',
        data: {
          candles: [[1640995200, 500, 510, 495, 505, 1000]]
        }
      };
      
      fyersService.fyers.history.mockResolvedValue(mockResponse);
      
      const data = await fyersService.getHistoricalData(
        'NSE:SBIN-EQ', 
        'D', 
        '2022-01-01', 
        '2022-01-31'
      );
      
      expect(data).toEqual(mockResponse);
      expect(fyersService.fyers.history).toHaveBeenCalledWith({
        symbol: 'NSE:SBIN-EQ',
        resolution: 'D',
        date_format: 1,
        range_from: '2022-01-01',
        range_to: '2022-01-31',
        cont_flag: 1
      });
    });
  });
});
