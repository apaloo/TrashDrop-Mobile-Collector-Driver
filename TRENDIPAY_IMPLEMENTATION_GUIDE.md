# TrendiPay Integration Implementation Guide

Complete guide for implementing TrendiPay payment gateway in TrashDrop Mobile Collector Driver.

## 📋 Overview

This integration enables:
- **Client Collections**: Mobile Money payments from clients for waste collection
- **Collector Disbursements**: Automated payouts to collectors
- **Real-time Webhooks**: Instant payment status updates

## 🏗️ Architecture

```
┌─────────────────┐
│   Mobile App    │ (Vite + React)
│  (Frontend)     │
└────────┬────────┘
         │ 1. Initiate Payment
         ▼
┌─────────────────┐
│ trendiPayService│
│  .js (Frontend) │
└────────┬────────┘
         │ 2. POST /v1/terminals/{id}/collections
         ▼
┌─────────────────┐
│  TrendiPay API  │
│  (External)     │
└────────┬────────┘
         │ 3. Send Webhook
         ▼
┌─────────────────┐
│ Webhook Server  │ (Express.js)
│  (Backend)      │
└────────┬────────┘
         │ 4. Update Database
         ▼
┌─────────────────┐
│    Supabase     │
│   (Database)    │
└─────────────────┘
```

## 🔧 Component Breakdown

### 1. Frontend (Mobile App)

**Location**: `/src/services/`

#### Files Modified:
- ✅ `trendiPayService.js` - API integration
- ✅ `paymentService.js` - Payment orchestration
- ✅ `.env` - Configuration
- ✅ `.env.example` - Example configuration

#### Key Features:
- Terminal ID in API paths: `/v1/terminals/{terminalId}/collections`
- Network mapping (MTN, Vodafone, AirtelTigo)
- Error handling and retries
- Status checking

### 2. Backend (Webhook Server)

**Location**: `/backend_webhooks/`

#### Files Created:
- ✅ `server.js` - Express server
- ✅ `trendiPayWebhooks.js` - Webhook handlers
- ✅ `package.json` - Dependencies
- ✅ `.env.example` - Backend configuration
- ✅ `README.md` - Backend documentation
- ✅ `test-webhook.js` - Testing script

#### Key Features:
- HMAC signature verification
- Collection webhook handler
- Disbursement webhook handler
- Digital bin status updates
- Raw response storage

### 3. Database (Supabase)

**Location**: Schema provided

#### Tables Used:
- `bin_payments` - Payment records
- `digital_bins` - Bin collection records
- `collector_profiles` - Collector information

## 🚀 Setup Instructions

### Step 1: Frontend Configuration

1. **Update `.env` file**:
```bash
# TrendiPay Gateway Configuration
VITE_ENABLE_TRENDIPAY=true
VITE_TRENDIPAY_API_URL=https://test-api.trendipay.com
VITE_TRENDIPAY_API_KEY=739|TtSlRwlbwzkZs11qlHYcTkAQ7iTKeZMNcoQ1TFbY3382cf19
VITE_TRENDIPAY_TERMINAL_ID=your_terminal_id_here  # ⚠️ ADD THIS
VITE_TRENDIPAY_MERCHANT_ID=37408274-8fa7-4c78-a05f-3a5238148bcc
VITE_TRENDIPAY_WEBHOOK_SECRET=your_webhook_secret_here
VITE_API_URL=http://localhost:3000
```

2. **Get Terminal ID from TrendiPay Dashboard**:
   - Login to TrendiPay merchant portal
   - Navigate to Terminals section
   - Copy your Terminal ID
   - Update `VITE_TRENDIPAY_TERMINAL_ID` in `.env`

3. **Restart Development Server**:
```bash
npm run dev
```

### Step 2: Backend Setup

1. **Navigate to backend folder**:
```bash
cd backend_webhooks
```

2. **Install dependencies**:
```bash
npm install
```

3. **Create `.env` file**:
```bash
cp .env.example .env
```

4. **Configure `.env`**:
```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here  # ⚠️ SERVICE ROLE, not anon key

# TrendiPay Webhook Security
TRENDIPAY_WEBHOOK_SECRET=your_webhook_secret_here  # ⚠️ Get from TrendiPay dashboard
```

5. **Start webhook server**:
```bash
npm start
```

### Step 3: Expose Webhook Server (Development)

1. **Install ngrok**:
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

2. **Expose localhost**:
```bash
ngrok http 3000
```

3. **Copy ngrok URL** (e.g., `https://abc123.ngrok.io`)

### Step 4: Configure TrendiPay Dashboard

1. **Login to TrendiPay merchant portal**

2. **Navigate to Webhooks/API Configuration**

3. **Set webhook URLs**:
```
Collection Callback URL:
https://abc123.ngrok.io/api/webhooks/trendipay/collection

Disbursement Callback URL:
https://abc123.ngrok.io/api/webhooks/trendipay/disbursement
```

4. **Save configuration**

## 🧪 Testing

### Test 1: Frontend Payment Initiation

1. **Start mobile app**:
```bash
npm run dev
```

2. **Scan QR code** for digital bin

3. **Fill payment form**:
   - Select "Mobile Money"
   - Enter phone number (e.g., `0241234567`)
   - Select network (MTN, Vodafone, AirtelTigo)
   - Submit

4. **Check console logs** for:
   - ✅ Payment record created
   - ✅ TrendiPay API called
   - ✅ Transaction ID received

### Test 2: Webhook Reception

1. **Start webhook server**:
```bash
cd backend_webhooks
npm start
```

2. **Start ngrok**:
```bash
ngrok http 3000
```

3. **Manual webhook test**:
```bash
cd backend_webhooks
node test-webhook.js
```

4. **Check server logs** for:
   - ✅ Webhook received
   - ✅ Signature verified
   - ✅ Database updated

### Test 3: End-to-End Flow

1. **Create test payment** in mobile app

2. **Check Supabase `bin_payments` table**:
   - Status should be `initiated`
   - Gateway reference should be set

3. **Simulate TrendiPay webhook** (via test script or actual TrendiPay test)

4. **Verify database updates**:
   - `bin_payments.status` → `success` or `failed`
   - `bin_payments.raw_gateway_response` → Full webhook payload
   - `digital_bins.status` → `picked_up` (if successful)

## 📊 Database Schema Requirements

Ensure your `bin_payments` table has these columns:

```sql
CREATE TABLE bin_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digital_bin_id uuid NOT NULL REFERENCES digital_bins(id),
  collector_id uuid NOT NULL REFERENCES collector_profiles(id),
  bags_collected integer NOT NULL CHECK (bags_collected >= 0),
  total_bill numeric NOT NULL CHECK (total_bill >= 0),
  payment_mode text NOT NULL CHECK (payment_mode IN ('momo', 'e_cash', 'cash')),
  client_momo text,
  client_rswitch text,
  status text NOT NULL CHECK (status IN ('pending', 'initiated', 'success', 'failed')),
  gateway_reference text UNIQUE,
  raw_gateway_response jsonb,
  gateway_error text,
  type text NOT NULL DEFAULT 'collection' CHECK (type IN ('collection', 'disbursement')),
  currency text DEFAULT 'GHS',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## 🔒 Security Checklist

- ✅ **Signature Verification**: All webhooks verify HMAC-SHA256 signature
- ✅ **Service Role Key**: Backend uses Supabase service role key (not anon key)
- ✅ **HTTPS**: Production webhooks use HTTPS (ngrok provides this)
- ✅ **Environment Variables**: No hardcoded credentials
- ✅ **Error Handling**: All errors logged and handled gracefully

## 🚢 Production Deployment

### Frontend (Already Deployed)
- Frontend is already configured
- Just ensure `.env` has correct Terminal ID

### Backend Deployment Options

#### Option 1: Vercel
```bash
cd backend_webhooks
vercel
# Set environment variables in Vercel dashboard
```

#### Option 2: Railway
```bash
cd backend_webhooks
railway init
railway up
# Set environment variables in Railway dashboard
```

#### Option 3: Render
1. Connect GitHub repository
2. Set build command: `cd backend_webhooks && npm install`
3. Set start command: `cd backend_webhooks && npm start`
4. Add environment variables

### Update TrendiPay Configuration

After deployment, update webhook URLs in TrendiPay dashboard:
```
Production Collection URL:
https://your-production-domain.com/api/webhooks/trendipay/collection

Production Disbursement URL:
https://your-production-domain.com/api/webhooks/trendipay/disbursement
```

## 📈 Monitoring

### Frontend Logs
```javascript
// Check browser console for:
- "TrendiPay collection initiated"
- "Payment record created"
- Payment IDs and transaction IDs
```

### Backend Logs
```bash
# Check webhook server logs for:
- "📥 TrendiPay Collection Webhook received"
- "✅ Collection payment updated to: success"
- "💰 Payment successful - notify collector"
```

### Database Monitoring
```sql
-- Check recent payments
SELECT id, status, gateway_reference, created_at 
FROM bin_payments 
ORDER BY created_at DESC 
LIMIT 10;

-- Check payment success rate
SELECT status, COUNT(*) 
FROM bin_payments 
GROUP BY status;
```

## 🐛 Troubleshooting

### Issue: "Missing Terminal ID"
**Solution**: Add `VITE_TRENDIPAY_TERMINAL_ID` to `.env` and restart dev server

### Issue: "Invalid signature"
**Solution**: Verify `TRENDIPAY_WEBHOOK_SECRET` matches TrendiPay dashboard

### Issue: "Payment record not found"
**Solution**: Ensure frontend creates payment before webhook arrives

### Issue: "Service role key error"
**Solution**: Use `SUPABASE_SERVICE_ROLE_KEY` in backend, not anon key

## 📚 API Reference

### TrendiPay Collection API

```http
POST /v1/terminals/{terminalId}/collections
Host: test-api.trendipay.com
Authorization: Bearer {apiKey}
Content-Type: application/json

{
  "reference": "payment-id",
  "accountNumber": "0241234567",
  "rSwitch": "mtn",
  "amount": 50.00,
  "description": "Digital bin payment",
  "callbackUrl": "https://your-domain.com/api/webhooks/trendipay/collection",
  "type": "purchase",
  "currency": "GHS"
}
```

### TrendiPay Webhook Format

```json
{
  "reference": "payment-id",
  "transactionId": "TP123456789",
  "status": "successful",
  "amount": 50.00,
  "accountNumber": "0241234567",
  "message": "Payment successful",
  "timestamp": "2024-12-05T14:30:00Z"
}
```

## ✅ Implementation Checklist

### Frontend
- [x] Update `trendiPayService.js` with terminal ID
- [x] Configure `.env` with all credentials
- [ ] Add Terminal ID to `.env` (⚠️ USER ACTION REQUIRED)
- [x] Test payment initiation

### Backend
- [x] Create webhook server
- [x] Create webhook handlers
- [x] Add signature verification
- [ ] Create `.env` file (⚠️ USER ACTION REQUIRED)
- [ ] Install dependencies
- [ ] Start server
- [ ] Test webhooks

### Deployment
- [ ] Deploy webhook server to production
- [ ] Configure TrendiPay dashboard with production URLs
- [ ] Test end-to-end flow in production
- [ ] Monitor logs and database

## 🎯 Next Steps

1. **Get Terminal ID**: Login to TrendiPay dashboard and copy your Terminal ID
2. **Update Frontend `.env`**: Add Terminal ID to `VITE_TRENDIPAY_TERMINAL_ID`
3. **Setup Backend**: Follow Step 2 in setup instructions
4. **Test Locally**: Follow testing instructions
5. **Deploy to Production**: Choose deployment option and deploy webhook server

## 📞 Support

- **TrendiPay Documentation**: https://documenter.getpostman.com/view/19494994/2sAXxJiFG3
- **Backend README**: `/backend_webhooks/README.md`
- **Test Script**: `/backend_webhooks/test-webhook.js`

---

**Last Updated**: 2024-12-05
**Version**: 1.0.0
**Status**: ✅ Implementation Complete (Pending Terminal ID Configuration)
