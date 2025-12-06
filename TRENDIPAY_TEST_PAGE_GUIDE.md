# TrendiPay Independent Test Page

A standalone web page for testing TrendiPay Collections and Disbursements independently from the main application.

## 📍 Location

**File**: `trendipay-test.html`  
**URL**: http://localhost:5173/trendipay-test.html

## 🎯 Purpose

Test TrendiPay API integration without needing to:
- Navigate through the full app
- Scan QR codes
- Create digital bins
- Set up collector profiles

## ✨ Features

### 🔧 Configuration Display
- Shows current TrendiPay settings
- Displays API URL, Terminal ID, Merchant ID
- Shows API Key (masked)
- Configuration status indicator

### 💰 Collection Testing (Payment)
- Test customer payments
- Support for MTN, Vodafone, AirtelTigo
- Quick-fill buttons for sample data
- Real-time API response display
- Automatic UUID generation

### 📤 Disbursement Testing (Payout)
- Test collector payouts
- Support for MTN, Vodafone, AirtelTigo
- Quick-fill buttons for sample data
- Real-time API response display
- Automatic UUID generation

### 📊 Response Viewer
- JSON-formatted responses
- Color-coded (green for success, red for error)
- Console logging for debugging
- Request/response details

## 🚀 How to Use

### 1. Start Development Server
```bash
npm run dev
```

### 2. Open Test Page
Navigate to: http://localhost:5173/trendipay-test.html

### 3. Verify Configuration
Check that all configuration items show green status:
- ✅ API URL configured
- ✅ Terminal ID set
- ✅ Merchant ID set
- ✅ API Key present
- ✅ TrendiPay Enabled

### 4. Test Collection (Payment)

**Option A: Use Quick Fill**
1. Click "MTN Sample" button
2. Review pre-filled data
3. Click "Initiate Collection"
4. View response

**Option B: Manual Entry**
1. Enter phone number (e.g., `0241234567`)
2. Select network (MTN/Vodafone/AirtelTigo)
3. Enter amount (e.g., `50.00`)
4. Click "Initiate Collection"
5. View response

### 5. Test Disbursement (Payout)

**Option A: Use Quick Fill**
1. Click "MTN Sample" button
2. Review pre-filled data
3. Click "Initiate Disbursement"
4. View response

**Option B: Manual Entry**
1. Enter phone number (e.g., `0241234567`)
2. Select network (MTN/Vodafone/AirtelTigo)
3. Enter amount (e.g., `30.00`)
4. Click "Initiate Disbursement"
5. View response

## 📋 Test Scenarios

### Scenario 1: MTN Collection
```
Phone: 0241234567
Network: MTN Mobile Money
Amount: 50.00 GHS
Expected: Success or pending approval
```

### Scenario 2: Vodafone Collection
```
Phone: 0501234567
Network: Vodafone Cash
Amount: 75.00 GHS
Expected: Success or pending approval
```

### Scenario 3: AirtelTigo Collection
```
Phone: 0261234567
Network: AirtelTigo Money
Amount: 100.00 GHS
Expected: Success or pending approval
```

### Scenario 4: MTN Disbursement
```
Phone: 0241234567
Network: MTN Mobile Money
Amount: 30.00 GHS
Expected: Success or processing
```

## 🔍 Understanding Responses

### Success Response (Collection)
```json
{
  "success": true,
  "status": 200,
  "data": {
    "transactionId": "TP123456789",
    "status": "pending",
    "message": "Collection initiated successfully",
    "reference": "your-uuid-here",
    "checkStatusUrl": "..."
  }
}
```

### Success Response (Disbursement)
```json
{
  "success": true,
  "status": 200,
  "data": {
    "transactionId": "TP987654321",
    "status": "processing",
    "message": "Disbursement initiated successfully",
    "reference": "your-uuid-here",
    "checkStatusUrl": "..."
  }
}
```

### Error Response
```json
{
  "success": false,
  "status": 400,
  "data": {
    "error": "Invalid account number",
    "message": "The provided phone number is invalid"
  }
}
```

## 🐛 Troubleshooting

### Configuration Not Loading
**Problem**: Shows "Not Set" for configuration values  
**Solution**: 
- Ensure `.env` file has all required variables
- Restart dev server: `npm run dev`
- Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### "Configuration Incomplete" Warning
**Problem**: Yellow warning badge at top  
**Solution**: 
- Check `.env` file for missing values
- Verify Terminal ID is set
- Ensure TrendiPay is enabled: `VITE_ENABLE_TRENDIPAY=true`

### API Request Fails
**Problem**: Red error response box  
**Solutions**:
- Verify API credentials in `.env`
- Check network connection
- Ensure Terminal ID is correct
- Verify phone number format (10 digits starting with 0)
- Check ngrok is running for webhook URLs

### Network Timeout
**Problem**: Request takes too long  
**Solutions**:
- Check internet connection
- Verify TrendiPay API is accessible
- Try test API URL: `https://test-api.trendipay.com`

## 📊 Monitoring

### Browser Console
Open browser DevTools (F12) to see:
- Request details
- Response details
- Error messages
- Configuration values

### Network Tab
Check Network tab in DevTools:
- Request headers
- Request payload
- Response status
- Response headers
- Response body

### Backend Logs
If webhook server is running:
- Check terminal for webhook receipts
- Monitor ngrok interface: http://127.0.0.1:4040
- Check Supabase for database updates

## 🔒 Security Notes

- ✅ API credentials loaded from environment variables
- ✅ Never hardcoded in HTML file
- ✅ Uses Vite's `import.meta.env` for security
- ✅ API key masked in display (first 20 chars only)
- ⚠️ Only use for development/testing
- ⚠️ Do not expose publicly with real credentials

## 🎨 UI Features

### Color Coding
- **Green box**: Successful API call
- **Red box**: Failed API call
- **Purple gradient**: Primary actions
- **Green gradient**: Disbursement actions
- **Yellow section**: Configuration display

### Quick Fill Buttons
- Pre-fill forms with sample data
- Test different networks quickly
- Save time during repeated testing

### Auto-generated UUIDs
- Unique reference per transaction
- Automatically generated after each submission
- Prevents duplicate reference errors

## 📝 Tips

1. **Test in order**: Collection first, then disbursement
2. **Use test numbers**: TrendiPay may provide test phone numbers
3. **Small amounts**: Start with small amounts for testing
4. **Check webhooks**: Monitor ngrok for webhook callbacks
5. **Database verification**: Check Supabase after each test
6. **Console logs**: Keep browser console open for details

## 🚀 Quick Start Checklist

- [ ] Development server running (`npm run dev`)
- [ ] `.env` file configured with Terminal ID
- [ ] Webhook server running (`cd backend_webhooks && npm start`)
- [ ] ngrok exposing port 3000
- [ ] Browser at http://localhost:5173/trendipay-test.html
- [ ] Configuration shows green status
- [ ] Quick fill button works
- [ ] Test collection successful
- [ ] Test disbursement successful
- [ ] Webhook received in backend
- [ ] Database updated in Supabase

## 📞 Support

If issues persist:
1. Check `TRENDIPAY_IMPLEMENTATION_GUIDE.md` for detailed setup
2. Run `node verify-config.js` to verify configuration
3. Review `TRENDIPAY_TEST_RESULTS.md` for expected behavior
4. Check TrendiPay API documentation

---

**File**: `trendipay-test.html`  
**Created**: December 5, 2024  
**Purpose**: Independent TrendiPay API testing  
**Status**: Ready for use
