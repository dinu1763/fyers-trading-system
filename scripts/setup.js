#!/usr/bin/env node

/**
 * Setup Script for FYERS Trading System
 * This script helps set up the project structure and dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up FYERS Trading System...\n');

// Create directory structure
const directories = [
  'src/config',
  'src/services',
  'src/strategies',
  'src/utils',
  'tests/unit',
  'tests/integration',
  'logs',
  'examples',
  'scripts'
];

console.log('📁 Creating directory structure...');
directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`   ✅ Created: ${dir}`);
  } else {
    console.log(`   ⏭️  Exists: ${dir}`);
  }
});

// Check if package.json exists and has required dependencies
console.log('\n📦 Checking dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = [
    'fyers-api-v3',
    'dotenv',
    'winston',
    'moment-timezone',
    'lodash'
  ];
  
  const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies?.[dep]);
  
  if (missingDeps.length > 0) {
    console.log(`   ⚠️  Missing dependencies: ${missingDeps.join(', ')}`);
    console.log('   Installing missing dependencies...');
    execSync(`npm install ${missingDeps.join(' ')}`, { stdio: 'inherit' });
  } else {
    console.log('   ✅ All required dependencies are installed');
  }
} catch (error) {
  console.log('   ⚠️  Could not read package.json');
}

// Create .env file if it doesn't exist
console.log('\n🔧 Setting up environment configuration...');
if (!fs.existsSync('.env')) {
  if (fs.existsSync('.env.example')) {
    fs.copyFileSync('.env.example', '.env');
    console.log('   ✅ Created .env from .env.example');
    console.log('   ⚠️  Please edit .env file with your FYERS API credentials');
  } else {
    console.log('   ⚠️  .env.example not found, please create .env manually');
  }
} else {
  console.log('   ⏭️  .env file already exists');
}

// Create logs directory and initial log files
console.log('\n📝 Setting up logging...');
if (!fs.existsSync('logs/combined.log')) {
  fs.writeFileSync('logs/combined.log', '');
  console.log('   ✅ Created logs/combined.log');
}
if (!fs.existsSync('logs/error.log')) {
  fs.writeFileSync('logs/error.log', '');
  console.log('   ✅ Created logs/error.log');
}

// Create .gitignore if it doesn't exist
console.log('\n🔒 Setting up version control...');
if (!fs.existsSync('.gitignore')) {
  const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*

# Environment variables
.env
.env.local

# Logs
logs/
*.log

# Coverage
coverage/

# IDE files
.vscode/
.idea/

# OS files
.DS_Store
Thumbs.db
`;
  fs.writeFileSync('.gitignore', gitignoreContent);
  console.log('   ✅ Created .gitignore');
} else {
  console.log('   ⏭️  .gitignore already exists');
}

// Validate configuration
console.log('\n🔍 Validating setup...');
const validationChecks = [
  { file: 'src/config/config.js', name: 'Configuration module' },
  { file: 'src/services/fyersService.js', name: 'FYERS service' },
  { file: 'src/services/orderService.js', name: 'Order service' },
  { file: 'src/services/marketDataService.js', name: 'Market data service' },
  { file: 'src/utils/logger.js', name: 'Logger utility' },
  { file: 'src/app.js', name: 'Main application' },
  { file: '.env', name: 'Environment configuration' }
];

let allValid = true;
validationChecks.forEach(check => {
  if (fs.existsSync(check.file)) {
    console.log(`   ✅ ${check.name}`);
  } else {
    console.log(`   ❌ ${check.name} - Missing: ${check.file}`);
    allValid = false;
  }
});

console.log('\n' + '='.repeat(60));
if (allValid) {
  console.log('🎉 Setup completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Edit .env file with your FYERS API credentials');
  console.log('2. Run authentication setup: node examples/auth-setup.js');
  console.log('3. Test the connection: node examples/auth-setup.js test');
  console.log('4. Start the application: npm start');
  console.log('\nFor development with auto-restart: npm run dev');
  console.log('To run tests: npm test');
} else {
  console.log('⚠️  Setup completed with some missing files');
  console.log('Please ensure all required files are present before running the application');
}
console.log('='.repeat(60));

// Display helpful information
console.log('\n📚 Helpful Resources:');
console.log('• FYERS API Documentation: https://myapi.fyers.in/docsv3');
console.log('• Create FYERS App: https://myapi.fyers.in');
console.log('• Project README: ./README.md');
console.log('• Quick Start Example: ./examples/quickstart.js');
console.log('• Authentication Setup: ./examples/auth-setup.js');

console.log('\n💡 Tips:');
console.log('• Always test with small quantities first');
console.log('• Use paper trading/demo account initially');
console.log('• Monitor logs in the logs/ directory');
console.log('• Check market hours before running strategies');
console.log('• Implement proper risk management');

console.log('\n🔐 Security Reminders:');
console.log('• Never commit .env file to version control');
console.log('• Keep your API credentials secure');
console.log('• Regularly rotate access tokens');
console.log('• Monitor API usage and limits');

console.log('\nSetup script completed! 🚀');
