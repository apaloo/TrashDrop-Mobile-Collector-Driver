# TrendiPay 404 Error - Troubleshooting Guide

**Error**: `"The requested resource was not found."`  
**Status Code**: 404  
**Date**: December 5, 2024

## 🔍 What This Error Means

A **404 error** from TrendiPay API means the endpoint you're trying to access doesn't exist. This typically happens when:

1. **Terminal ID doesn't exist** in TrendiPay's system
2. **Terminal ID is incorrect** or mistyped
3. **Terminal is inactive** or not properly configured
4. **Wrong API environment** (test vs production mismatch)

## 🎯 Most Likely Cause

Based on your configuration:
- **Terminal ID**: `73f3ba0f-7f70-4baf-8e46-f31e50bdb697`
- **API URL**: `https://test-api.trendipay.com`
- **Endpoint**: `/v1/terminals/73f3ba0f-7f70-4baf-8e46-f31e50bdb697/collections`

**The Terminal ID may not exist in TrendiPay's test environment.**

## ✅ How to Fix

### Step 1: Verify Terminal ID in TrendiPay Dashboard

1. **Login** to TrendiPay merchant dashboard
2. **Navigate** to "Terminals" or "API Configuration" section
3. **Check** if Terminal ID `73f3ba0f-7f70-4baf-8e46-f31e50bdb697` exists
4. **Verify** the terminal is:
   - ✅ Active/Enabled
   - ✅ Associated with your merchant account
   - ✅ In the correct environment (test vs production)

### Step 2: Get Correct Terminal ID

If the Terminal ID doesn't exist or is incorrect:

1. **Go to** TrendiPay dashboard → Terminals
2. **Find** your active terminal
3. **Copy** the exact Terminal ID (case-sensitive)
4. **Update** your `.env` file:
   ```bash
   VITE_TRENDIPAY_TERMINAL_ID=YOUR_ACTUAL_TERMINAL_ID_HERE
   ```
5. **Restart** dev server:
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

### Step 3: Verify Environment Match

Ensure your API URL matches your Terminal's environment:

**Test Environment**:
```
VITE_TRENDIPAY_API_URL=https://test-api.trendipay.com
Terminal ID: Test terminal ID from dashboard
```

**Production Environment**:
```
VITE_TRENDIPAY_API_URL=https://api.trendipay.com
Terminal ID: Production terminal ID from dashboard
```

## 🔧 Debug Tools

### Tool 1: Debug Page
Open: http://localhost:5173/debug-trendipay.html

This page will:
- ✅ Show your current configuration
- ✅ Display the exact endpoint being called
- ✅ Test endpoint connectivity
- ✅ Provide specific error diagnosis

### Tool 2: Configuration Verification
Run from terminal:
```bash
node verify-config.js
```

This will show all your TrendiPay settings.

### Tool 3: Manual API Test
Test the endpoint directly with curl:

```bash
curl -X POST https://test-api.trendipay.com/v1/terminals/YOUR_TERMINAL_ID/collections \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Merchant-ID: YOUR_MERCHANT_ID" \
  -d '{
    "reference": "test-123",
    "accountNumber": "0241234567",
    "rSwitch": "mtn",
    "amount": "1.00",
    "description": "Test",
    "callbackUrl": "http://localhost:3000/test",
    "type": "purchase",
    "currency": "GHS"
  }'
```

## 🎯 Expected Responses

### ✅ Success (200-299)
```json
{
  "success": true,
  "transactionId": "TP123456789",
  "status": "pending",
  "message": "Collection initiated successfully"
}
```

### ❌ 404 - Not Found
```json
{
  "success": false,
  "status": 404,
  "data": {
    "message": "The requested resource was not found."
  }
}
```
**Cause**: Terminal ID doesn't exist or endpoint is wrong

### ❌ 401 - Unauthorized
```json
{
  "success": false,
  "status": 401,
  "data": {
    "message": "Unauthorized"
  }
}
```
**Cause**: Invalid API Key or Merchant ID

### ❌ 400 - Bad Request
```json
{
  "success": false,
  "status": 400,
  "data": {
    "message": "Invalid request parameters"
  }
}
```
**Cause**: Missing or invalid request data

## 📞 Contact TrendiPay Support

If you've verified everything and still get 404 errors:

### Information to Provide:
- **Merchant ID**: `37408274-8fa7-4c78-a05f-3a5238148bcc`
- **Terminal ID**: `73f3ba0f-7f70-4baf-8e46-f31e50bdb697`
- **Environment**: Test (test-api.trendipay.com)
- **Error**: 404 - Resource not found
- **Endpoint**: `/v1/terminals/{terminalId}/collections`

### Questions to Ask:
1. Does Terminal ID `73f3ba0f-7f70-4baf-8e46-f31e50bdb697` exist in my account?
2. Is this Terminal active and enabled?
3. Is this Terminal configured for the test environment?
4. What is the correct Terminal ID for my test account?
5. Are there any additional setup steps required?

## 🔄 Alternative: Create New Terminal

If the Terminal doesn't exist, you may need to create one:

1. Login to TrendiPay dashboard
2. Go to **Terminals** section
3. Click **"Create New Terminal"** or **"Add Terminal"**
4. Follow the setup wizard
5. Copy the new Terminal ID
6. Update your `.env` file
7. Restart dev server

## 📝 Checklist

Before testing again:

- [ ] Verified Terminal ID exists in TrendiPay dashboard
- [ ] Terminal is active/enabled
- [ ] Environment matches (test vs production)
- [ ] Updated `.env` with correct Terminal ID
- [ ] Restarted dev server (`npm run dev`)
- [ ] Cleared browser cache (Cmd+Shift+R)
- [ ] Tested with debug tool
- [ ] Checked TrendiPay documentation

## 🎓 Understanding Terminal IDs

### What is a Terminal ID?
- A unique identifier for each payment terminal/channel
- Different terminals for test and production
- Required in all API endpoint URLs
- Format example: `73f3ba0f-7f70-4baf-8e46-f31e50bdb697`

### Why Multiple Terminals?
- **Test Terminal**: For development and testing
- **Production Terminal**: For live transactions
- **Multiple Channels**: Web, mobile, POS, etc.

### Terminal Configuration
Each terminal has:
- Unique Terminal ID
- Associated Merchant ID
- API credentials
- Webhook URLs
- Transaction limits
- Allowed payment methods

## 💡 Quick Fixes Summary

1. **Most Common**: Wrong/non-existent Terminal ID
   - **Fix**: Get correct ID from dashboard
   
2. **Second Common**: Test/Prod mismatch
   - **Fix**: Match API URL with terminal environment
   
3. **Third Common**: Terminal not activated
   - **Fix**: Activate terminal in dashboard

## 📊 Success Indicators

You'll know it's fixed when:
- ✅ Debug tool shows "Endpoint is accessible"
- ✅ Test page returns 200/201 status
- ✅ Response includes `transactionId`
- ✅ No 404 errors in console
- ✅ Webhook server receives callbacks

## 🚀 Next Steps After Fix

Once Terminal ID is corrected:

1. **Test Collection**: Use test page with small amount (1 GHS)
2. **Verify Response**: Should get `transactionId` and `status: pending`
3. **Check Webhook**: Monitor ngrok for callback
4. **Test Disbursement**: Try payout with small amount
5. **Production**: Move to production terminal when ready

---

**Status**: Awaiting Terminal ID verification  
**Priority**: High (blocks payment testing)  
**Action Required**: Verify Terminal ID with TrendiPay  
**ETA**: Depends on TrendiPay support response

## 📚 Related Documentation

- `TRENDIPAY_IMPLEMENTATION_GUIDE.md` - Full setup guide
- `TRENDIPAY_QUICK_START.md` - Quick reference
- `debug-trendipay.html` - Debug tool
- `verify-config.js` - Configuration checker

---

**Created**: December 5, 2024  
**Last Updated**: December 5, 2024  
**For**: TrashDrop Mobile Collector Driver - TrendiPay Integration
