# TrendiPay Webhook Server

Backend server to handle TrendiPay payment webhooks for TrashDrop Mobile Collector Driver.

## 🎯 Purpose

This server receives payment status updates from TrendiPay and updates the Supabase database accordingly. It handles:
- **Collection webhooks**: Client payment approvals/rejections
- **Disbursement webhooks**: Collector payout confirmations

## 📋 Prerequisites

- Node.js 18+ installed
- Supabase project with `bin_payments` and `digital_bins` tables
- TrendiPay merchant account with webhook configuration

## 🚀 Setup

### 1. Install Dependencies

```bash
cd backend_webhooks
npm install
```

### 2. Configure Environment Variables

```bash
# Copy example file
cp .env.example .env

# Edit .env and fill in your credentials:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY (not anon key!)
# - TRENDIPAY_WEBHOOK_SECRET
```

### 3. Start Server

```bash
# Development
npm start

# Development with auto-reload (Node 18+)
npm run dev
```

Server will start on `http://localhost:3000`

## 🌐 Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| POST | `/api/webhooks/trendipay/collection` | Collection webhook |
| POST | `/api/webhooks/trendipay/disbursement` | Disbursement webhook |

## 🧪 Testing Locally

### Using ngrok

1. **Install ngrok**: https://ngrok.com/download

2. **Expose localhost**:
```bash
ngrok http 3000
```

3. **Copy ngrok URL** (e.g., `https://abc123.ngrok.io`)

4. **Configure TrendiPay dashboard**:
   - Collection callback: `https://abc123.ngrok.io/api/webhooks/trendipay/collection`
   - Disbursement callback: `https://abc123.ngrok.io/api/webhooks/trendipay/disbursement`

### Manual Testing with curl

```bash
# Test collection webhook
curl -X POST http://localhost:3000/api/webhooks/trendipay/collection \
  -H "Content-Type: application/json" \
  -H "X-TrendiPay-Signature: test-signature" \
  -d '{
    "reference": "payment-uuid-here",
    "transactionId": "TP123456789",
    "status": "successful",
    "amount": 50.00,
    "accountNumber": "0241234567",
    "message": "Payment successful",
    "timestamp": "2024-01-30T10:00:00Z"
  }'
```

## 🔒 Security

- **Signature Verification**: All webhooks are verified using HMAC-SHA256
- **Service Role Key**: Uses Supabase service role key for database access
- **HTTPS Required**: Production webhooks must use HTTPS (ngrok provides this)

## 📊 Database Updates

### Collection Webhook
Updates `bin_payments` table:
- `status`: 'success' | 'failed' | 'initiated'
- `gateway_reference`: TrendiPay transaction ID
- `raw_gateway_response`: Full webhook payload

Also updates `digital_bins` table on success:
- `status`: 'picked_up'
- `collected_at`: Timestamp

### Disbursement Webhook
Updates `bin_payments` table (disbursement records):
- `status`: 'success' | 'failed' | 'initiated'
- `gateway_reference`: TrendiPay transaction ID
- `raw_gateway_response`: Full webhook payload

## 🚢 Deployment

### Option 1: Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Option 2: Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Option 3: Render

1. Connect GitHub repository
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add environment variables

## 📝 TrendiPay Configuration

After deployment, configure these webhook URLs in your TrendiPay merchant dashboard:

```
Collection Callback URL:
https://your-domain.com/api/webhooks/trendipay/collection

Disbursement Callback URL:
https://your-domain.com/api/webhooks/trendipay/disbursement
```

## 🐛 Troubleshooting

### "Missing required environment variables"
- Ensure `.env` file exists with all required variables
- Use `SUPABASE_SERVICE_ROLE_KEY`, not `SUPABASE_ANON_KEY`

### "Invalid signature" errors
- Verify `TRENDIPAY_WEBHOOK_SECRET` matches TrendiPay dashboard
- Check webhook payload format matches TrendiPay documentation

### "Payment record not found"
- Ensure frontend created payment record before webhook arrives
- Check `reference` field matches `bin_payments.id`

## 📚 Related Documentation

- [TrendiPay API Docs](https://documenter.getpostman.com/view/19494994/2sAXxJiFG3)
- [Supabase JavaScript Docs](https://supabase.com/docs/reference/javascript)
- [Express.js Docs](https://expressjs.com/)

## 🆘 Support

For issues or questions:
1. Check server logs: `npm start`
2. Test webhook locally with curl
3. Verify TrendiPay dashboard configuration
4. Check Supabase database schema matches expectations

---

**Last Updated**: 2024-12-05
