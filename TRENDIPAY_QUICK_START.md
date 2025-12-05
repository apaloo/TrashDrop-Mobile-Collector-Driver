# TrendiPay Integration - Quick Start

## ⚡ Quick Setup (5 Minutes)

### 1. Get Your Terminal ID
1. Login to TrendiPay merchant dashboard
2. Go to **Terminals** section
3. Copy your **Terminal ID**

### 2. Update Frontend Configuration
```bash
# Edit .env file
nano .env

# Add your Terminal ID:
VITE_TRENDIPAY_TERMINAL_ID=your_terminal_id_here
```

### 3. Restart Development Server
```bash
npm run dev
```

### 4. Setup Backend (Optional for Testing)
```bash
cd backend_webhooks
npm install
cp .env.example .env
# Edit .env and add Supabase credentials
npm start
```

## ✅ Current Status

### Frontend ✅ READY
- TrendiPay service configured
- API endpoints updated with terminal ID format
- Payment service integrated
- Environment variables configured

### Backend ✅ READY
- Webhook server created
- Collection handler implemented
- Disbursement handler implemented
- Database updates configured

### Credentials Status
| Credential | Status | Location |
|------------|--------|----------|
| API Key | ✅ Configured | `.env` line 23 |
| Merchant ID | ✅ Configured | `.env` line 25 |
| API URL | ✅ Configured | `.env` line 22 (Test) |
| Terminal ID | ⚠️ **REQUIRED** | `.env` line 24 |
| Webhook Secret | ⚠️ Recommended | `.env` line 26 |

## 🧪 Test Payment Flow

1. **Start App**: `npm run dev`
2. **Scan QR Code**: Use NavigationQRModal
3. **Fill Payment Form**:
   - Select "Mobile Money"
   - Phone: `0241234567`
   - Network: MTN/Vodafone/AirtelTigo
4. **Submit**: Check console for success

## 📋 Expected Console Output

```
✅ Payment record created: <uuid>
📡 Calling TrendiPay collection API...
✅ TrendiPay collection initiated: {
  paymentId: "<uuid>",
  transactionId: "TP123456789",
  status: "pending"
}
```

## 🔍 Verify in Database

```sql
-- Check payment record
SELECT * FROM bin_payments 
WHERE id = '<payment-id>' 
ORDER BY created_at DESC;

-- Should show:
-- status: 'initiated' or 'pending'
-- gateway_reference: TrendiPay transaction ID
-- payment_mode: 'momo' or 'e_cash'
```

## 🚨 Common Issues

### "Terminal ID is not defined"
**Fix**: Add `VITE_TRENDIPAY_TERMINAL_ID` to `.env` and restart server

### "Network error" or "Failed to fetch"
**Fix**: Check API URL is correct (test vs production)

### "Invalid API key"
**Fix**: Verify `VITE_TRENDIPAY_API_KEY` matches TrendiPay dashboard

## 📞 Need Help?

1. Check **TRENDIPAY_IMPLEMENTATION_GUIDE.md** for detailed docs
2. Check **backend_webhooks/README.md** for webhook setup
3. Run test script: `cd backend_webhooks && node test-webhook.js`

---

**Next Action**: Add Terminal ID to `.env` and test payment! 🚀
