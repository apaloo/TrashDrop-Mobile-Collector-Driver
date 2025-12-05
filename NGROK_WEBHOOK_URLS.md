# ngrok Webhook URLs for TrendiPay Configuration

**Date**: December 5, 2024  
**Status**: 🟢 **ACTIVE**

## 📡 ngrok Tunnel Information

**Public URL**: `https://9cc4dfcd4830.ngrok-free.app`  
**Local Port**: `3000`  
**Status**: Running  
**Region**: Europe (eu)  
**Web Interface**: http://127.0.0.1:4040

---

## 🔗 Webhook URLs for TrendiPay Dashboard

### Collection Webhook URL
```
https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/collection
```

### Disbursement Webhook URL
```
https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/disbursement
```

---

## 📋 Configuration Steps

### 1. Login to TrendiPay Merchant Dashboard
Navigate to your TrendiPay merchant portal.

### 2. Configure Webhook URLs

**For Collection Webhooks**:
- Setting: Collection Callback URL
- Value: `https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/collection`

**For Disbursement Webhooks**:
- Setting: Disbursement Callback URL  
- Value: `https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/disbursement`

### 3. Save Configuration
Click "Save" or "Update" in the TrendiPay dashboard.

---

## 🧪 Test Webhook Endpoints

### Test Collection Webhook
```bash
curl -X POST https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/collection \
  -H "Content-Type: application/json" \
  -H "X-TrendiPay-Signature: test-signature" \
  -d '{
    "reference": "test-payment-id",
    "transactionId": "TP123456789",
    "status": "successful",
    "amount": 50.00,
    "accountNumber": "0241234567",
    "message": "Payment successful",
    "timestamp": "2024-12-05T16:00:00Z"
  }'
```

### Test Disbursement Webhook
```bash
curl -X POST https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/disbursement \
  -H "Content-Type: application/json" \
  -H "X-TrendiPay-Signature: test-signature" \
  -d '{
    "reference": "test-disbursement-id",
    "transactionId": "TP987654321",
    "status": "successful",
    "amount": 30.00,
    "accountNumber": "0241234567",
    "message": "Disbursement successful",
    "timestamp": "2024-12-05T16:00:00Z"
  }'
```

### Test Health Endpoint
```bash
curl https://9cc4dfcd4830.ngrok-free.app/health
```

---

## 📊 Monitor Webhooks

### ngrok Web Interface
View all incoming webhook requests in real-time:
```
http://127.0.0.1:4040
```

This interface shows:
- ✅ All HTTP requests and responses
- ✅ Request/response headers
- ✅ Request/response bodies
- ✅ Timing information
- ✅ Replay functionality

### Webhook Server Logs
Check the webhook server console for detailed logs:
- Payment processing
- Signature verification
- Database updates
- Error messages

---

## ⚠️ Important Notes

### ngrok Session Duration
- **Free Plan**: ngrok URLs change when you restart ngrok
- **Current Session**: Active until you close the terminal or press Ctrl+C
- **URL Changes**: If ngrok restarts, you must update TrendiPay dashboard with new URL

### Security
- ✅ HTTPS enabled automatically by ngrok
- ✅ Webhook signature verification active
- ✅ All traffic encrypted
- ✅ Safe for testing production webhooks

### For Production
For production deployment:
1. Deploy webhook server to cloud hosting (Vercel, Railway, Render)
2. Get permanent domain/URL
3. Update TrendiPay dashboard with production URLs
4. No need for ngrok in production

---

## 🚀 Ready to Test!

### Current Status
- ✅ Webhook server running on localhost:3000
- ✅ ngrok tunnel active and forwarding
- ✅ Public URLs ready for TrendiPay
- ✅ Monitoring interface available

### Next Steps
1. **Configure TrendiPay Dashboard**: Add the webhook URLs above
2. **Test Payment Flow**: Initiate a payment from the mobile app
3. **Monitor Webhooks**: Watch http://127.0.0.1:4040 for incoming webhooks
4. **Verify Database**: Check Supabase for payment updates

---

## 🛑 Stopping ngrok

To stop the ngrok tunnel:
```bash
# Press Ctrl+C in the ngrok terminal
```

To restart with a new URL:
```bash
ngrok http 3000
# Update TrendiPay dashboard with new URL
```

---

**Status**: 🟢 Active and ready for webhooks!  
**Expires**: When ngrok process is terminated  
**Last Updated**: December 5, 2024 at 4:38 PM UTC
