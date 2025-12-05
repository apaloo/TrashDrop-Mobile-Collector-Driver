/**
 * TrendiPay Webhook Server
 * 
 * Express.js server to handle TrendiPay payment webhooks
 * Receives payment notifications and updates Supabase database
 * 
 * Setup:
 * 1. Copy .env.example to .env and fill in credentials
 * 2. Run: npm install express @supabase/supabase-js dotenv
 * 3. Start: node server.js
 * 
 * Production:
 * - Deploy to Vercel, Railway, Render, or any Node.js hosting
 * - Configure TrendiPay dashboard with your webhook URLs
 */

import express from 'express';
import dotenv from 'dotenv';
import { setupTrendiPayRoutes } from './trendiPayWebhooks.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TRENDIPAY_WEBHOOK_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease copy .env.example to .env and fill in the values.');
  process.exit(1);
}

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'TrendiPay Webhook Server',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'TrashDrop TrendiPay Webhook Handler',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      collectionWebhook: 'POST /api/webhooks/trendipay/collection',
      disbursementWebhook: 'POST /api/webhooks/trendipay/disbursement'
    },
    documentation: 'See README.md for setup instructions'
  });
});

// Setup TrendiPay webhook routes
setupTrendiPayRoutes(app);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} does not exist`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 TrendiPay Webhook Server Started');
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('\n📋 Available endpoints:');
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log(`   POST http://localhost:${PORT}/api/webhooks/trendipay/collection`);
  console.log(`   POST http://localhost:${PORT}/api/webhooks/trendipay/disbursement`);
  console.log('\n💡 Tip: Use ngrok to expose localhost for testing:');
  console.log(`   ngrok http ${PORT}`);
  console.log('\n✅ Server ready to receive webhooks!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});
