/**
 * Authentication Setup Example
 * This script helps you set up FYERS API authentication
 */

require('dotenv').config();
const FyersService = require('../src/services/fyersService');
const logger = require('../src/utils/logger');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function setupAuthentication() {
  logger.info('FYERS API Authentication Setup');
  logger.info('=====================================');
  
  try {
    // Check if required environment variables are set
    if (!process.env.FYERS_APP_ID || !process.env.FYERS_SECRET_KEY) {
      logger.error('Please set FYERS_APP_ID and FYERS_SECRET_KEY in your .env file');
      logger.info('You can get these from: https://myapi.fyers.in');
      process.exit(1);
    }
    
    const fyersService = new FyersService();
    
    // Step 1: Generate authorization URL
    logger.info('Step 1: Generating authorization URL...');
    const authUrl = await fyersService.generateAuthUrl();
    
    console.log('\n' + '='.repeat(80));
    console.log('AUTHORIZATION REQUIRED');
    console.log('='.repeat(80));
    console.log('Please visit the following URL to authorize the application:');
    console.log('\n' + authUrl + '\n');
    console.log('After authorization, you will be redirected to your redirect URL.');
    console.log('Copy the "auth_code" parameter from the redirect URL.');
    console.log('='.repeat(80) + '\n');
    
    // Step 2: Get auth code from user
    const authCode = await askQuestion('Enter the auth_code from the redirect URL: ');
    
    if (!authCode || authCode.trim() === '') {
      logger.error('Auth code is required');
      process.exit(1);
    }
    
    // Step 3: Generate access token
    logger.info('Step 3: Generating access token...');
    const accessToken = await fyersService.generateAccessToken(authCode.trim());
    
    console.log('\n' + '='.repeat(80));
    console.log('ACCESS TOKEN GENERATED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('Your access token is:');
    console.log('\n' + accessToken + '\n');
    console.log('Add this to your .env file as:');
    console.log(`FYERS_ACCESS_TOKEN=${accessToken}`);
    console.log('='.repeat(80) + '\n');
    
    // Step 4: Test the connection
    logger.info('Step 4: Testing connection...');
    const profile = await fyersService.getProfile();
    
    if (profile.s === 'ok') {
      logger.info('✅ Connection test successful!');
      logger.info(`Welcome, ${profile.data.name} (${profile.data.email})`);
      
      // Get funds information
      try {
        const funds = await fyersService.getFunds();
        if (funds.s === 'ok') {
          logger.info('Funds data structure:', JSON.stringify(funds.data, null, 2));

          // Handle different possible fund data structures
          const availableFunds = funds.data.fund_limit ||
                               funds.data.availablecash ||
                               funds.data.available_cash ||
                               funds.data.total_balance ||
                               'N/A';

          logger.info(`Available funds: ₹${availableFunds}`);
        } else {
          logger.warn('Could not fetch funds information:', funds.message);
        }
      } catch (fundError) {
        logger.warn('Funds fetch failed (non-critical):', fundError.message);
      }
      
    } else {
      logger.error('❌ Connection test failed');
      logger.error(profile.message);
    }
    
    logger.info('\nAuthentication setup completed successfully!');
    logger.info('You can now run the trading application with: npm start');
    
  } catch (error) {
    logger.error(`Authentication setup failed: ${error.message}`);
    
    if (error.message.includes('Invalid auth code')) {
      logger.info('Please make sure you copied the correct auth_code from the redirect URL');
    } else if (error.message.includes('Token generation failed')) {
      logger.info('Please check your App ID and Secret Key in the .env file');
    }
    
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Additional helper functions
async function refreshToken() {
  logger.info('Token Refresh Process');
  logger.info('====================');
  
  try {
    const fyersService = new FyersService();
    
    // Generate new auth URL
    const authUrl = await fyersService.generateAuthUrl();
    console.log('Visit this URL to get a new auth code:');
    console.log(authUrl);
    
    const authCode = await askQuestion('Enter the new auth_code: ');
    const accessToken = await fyersService.generateAccessToken(authCode.trim());
    
    console.log('\nNew access token:');
    console.log(accessToken);
    console.log('\nUpdate your .env file with this new token.');
    
  } catch (error) {
    logger.error(`Token refresh failed: ${error.message}`);
  } finally {
    rl.close();
  }
}

async function testConnection() {
  logger.info('Testing FYERS API Connection');
  logger.info('============================');
  
  try {
    if (!process.env.FYERS_ACCESS_TOKEN) {
      logger.error('No access token found. Please run authentication setup first.');
      process.exit(1);
    }
    
    const fyersService = new FyersService();
    
    // Test profile
    const profile = await fyersService.getProfile();
    if (profile.s === 'ok') {
      logger.info('✅ Profile: Connection successful');
      logger.info(`User: ${profile.data.name} (${profile.data.email})`);
    } else {
      logger.error('❌ Profile: Connection failed');
      logger.error(profile.message);
      return;
    }
    
    // Test funds
    try {
      const funds = await fyersService.getFunds();
      if (funds.s === 'ok') {
        logger.info('✅ Funds: Connection successful');
        logger.info('Funds data:', JSON.stringify(funds.data, null, 2));

        const availableFunds = funds.data.fund_limit ||
                             funds.data.availablecash ||
                             funds.data.available_cash ||
                             funds.data.total_balance ||
                             'N/A';

        logger.info(`Available: ₹${availableFunds}`);
      } else {
        logger.error('❌ Funds: Connection failed');
        logger.error(funds.message);
      }
    } catch (fundError) {
      logger.warn('⚠️ Funds: Could not fetch (non-critical)');
      logger.warn(fundError.message);
    }
    
    // Test quotes
    try {
      const quotes = await fyersService.getQuotes(['NSE:SBIN-EQ']);
      if (quotes.s === 'ok') {
        logger.info('✅ Quotes: Connection successful');
        logger.info('Quotes data structure:', JSON.stringify(quotes.data, null, 2));

        // Handle different possible quote data structures
        const sbinData = quotes.data['NSE:SBIN-EQ'] ||
                        quotes.data[0] ||
                        (Array.isArray(quotes.data) ? quotes.data[0] : null);

        if (sbinData && sbinData.ltp) {
          logger.info(`SBIN LTP: ₹${sbinData.ltp}`);
        } else {
          logger.info('Quote data received but structure is different than expected');
        }
      } else {
        logger.error('❌ Quotes: Connection failed');
        logger.error(quotes.message);
      }
    } catch (quoteError) {
      logger.warn('⚠️ Quotes: Could not fetch (non-critical)');
      logger.warn(quoteError.message);
    }
    
    logger.info('\nConnection test completed!');
    
  } catch (error) {
    logger.error(`Connection test failed: ${error.message}`);
    
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      logger.info('Your access token may have expired. Please run: node examples/auth-setup.js refresh');
    }
  }
}

// Command line interface
const command = process.argv[2];

if (require.main === module) {
  switch (command) {
    case 'refresh':
      refreshToken();
      break;
    case 'test':
      testConnection();
      break;
    default:
      setupAuthentication();
      break;
  }
}

module.exports = {
  setupAuthentication,
  refreshToken,
  testConnection
};
