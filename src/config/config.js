require('dotenv').config();

const config = {
  fyers: {
    appId: process.env.FYERS_APP_ID,
    secretKey: process.env.FYERS_SECRET_KEY,
    redirectUrl: process.env.FYERS_REDIRECT_URL,
    accessToken: process.env.FYERS_ACCESS_TOKEN
  },
  trading: {
    maxPositionSize: parseInt(process.env.MAX_POSITION_SIZE) || 100000,
    riskPercentage: parseFloat(process.env.RISK_PERCENTAGE) || 2,
    stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE) || 5
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: './logs/trading.log'
  },
  environment: process.env.NODE_ENV || 'development'
};

// Validate required configuration
const requiredFields = [
  'fyers.appId',
  'fyers.secretKey',
  'fyers.redirectUrl'
];

function validateConfig() {
  const missing = [];
  
  requiredFields.forEach(field => {
    const keys = field.split('.');
    let value = config;
    
    for (const key of keys) {
      value = value[key];
      if (value === undefined || value === null || value === '') {
        missing.push(field);
        break;
      }
    }
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

// Only validate in production or when explicitly requested
if (process.env.NODE_ENV === 'production' || process.env.VALIDATE_CONFIG === 'true') {
  validateConfig();
}

module.exports = config;
