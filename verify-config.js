/**
 * Configuration Verification Script
 * Verifies that TrendiPay configuration is correctly set up
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
config();

console.log('\n🔍 TrendiPay Configuration Verification\n');
console.log('═'.repeat(60));

// Read .env file content
const envPath = join(__dirname, '.env');
const envContent = readFileSync(envPath, 'utf8');

// Parse environment variables
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

// Check TrendiPay configuration
const checks = [
  {
    name: 'TrendiPay Enabled',
    key: 'VITE_ENABLE_TRENDIPAY',
    required: true,
    expected: 'true'
  },
  {
    name: 'API URL',
    key: 'VITE_TRENDIPAY_API_URL',
    required: true,
    expected: 'https://test-api.trendipay.com'
  },
  {
    name: 'API Key',
    key: 'VITE_TRENDIPAY_API_KEY',
    required: true,
    maskValue: true
  },
  {
    name: 'Terminal ID',
    key: 'VITE_TRENDIPAY_TERMINAL_ID',
    required: true,
    critical: true
  },
  {
    name: 'Merchant ID',
    key: 'VITE_TRENDIPAY_MERCHANT_ID',
    required: true
  },
  {
    name: 'Webhook Secret',
    key: 'VITE_TRENDIPAY_WEBHOOK_SECRET',
    required: false
  }
];

let allGood = true;
let criticalMissing = false;

checks.forEach(check => {
  const value = envVars[check.key];
  const isSet = value && value !== 'your_terminal_id_here' && value !== 'your_webhook_secret_here' && value !== 'your_api_key_here' && value !== 'your_merchant_id_here';
  
  let status = '❌ MISSING';
  let displayValue = 'Not set';
  
  if (isSet) {
    status = '✅ SET';
    if (check.maskValue) {
      displayValue = value.substring(0, 15) + '...';
    } else if (value.length > 40) {
      displayValue = value.substring(0, 37) + '...';
    } else {
      displayValue = value;
    }
    
    if (check.expected && value !== check.expected) {
      status = '⚠️ SET (unexpected value)';
    }
  } else {
    if (check.required) {
      allGood = false;
      if (check.critical) {
        criticalMissing = true;
      }
    } else {
      status = '⚠️ RECOMMENDED';
    }
  }
  
  console.log(`\n${check.name}:`);
  console.log(`  Status: ${status}`);
  console.log(`  Key: ${check.key}`);
  console.log(`  Value: ${displayValue}`);
  if (check.critical && !isSet) {
    console.log('  🚨 CRITICAL: This value must be set for TrendiPay to work!');
  }
});

console.log('\n' + '═'.repeat(60));

// Generate API endpoint URL
const terminalId = envVars['VITE_TRENDIPAY_TERMINAL_ID'];
const apiUrl = envVars['VITE_TRENDIPAY_API_URL'];

if (terminalId && terminalId !== 'your_terminal_id_here') {
  console.log('\n📡 Generated API Endpoints:\n');
  console.log(`Collection: ${apiUrl}/v1/terminals/${terminalId}/collections`);
  console.log(`Disbursement: ${apiUrl}/v1/terminals/${terminalId}/disbursements`);
}

console.log('\n' + '═'.repeat(60));

if (criticalMissing) {
  console.log('\n❌ CRITICAL CONFIGURATION MISSING!');
  console.log('\n📝 Action Required:');
  console.log('1. Login to TrendiPay merchant dashboard');
  console.log('2. Navigate to Terminals section');
  console.log('3. Copy your Terminal ID');
  console.log('4. Update .env file with your Terminal ID');
  console.log('5. Restart your development server');
  process.exit(1);
} else if (!allGood) {
  console.log('\n⚠️ CONFIGURATION INCOMPLETE');
  console.log('\nSome optional settings are missing. The integration will work,');
  console.log('but you may want to configure webhook secret for production.');
} else {
  console.log('\n✅ CONFIGURATION COMPLETE!');
  console.log('\nYour TrendiPay integration is properly configured.');
  console.log('\n🚀 Next Steps:');
  console.log('1. Start development server: npm run dev');
  console.log('2. Test payment flow with QR scan');
  console.log('3. Check console logs for API calls');
}

console.log('\n');
