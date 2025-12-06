# TrendiPay API - curl Commands

Complete curl commands for testing TrendiPay API with your configuration.

**Updated**: December 5, 2024 - Includes required `Accept: application/json` header

---

## 📋 Configuration

- **API URL**: `https://test-api.trendipay.com`
- **Terminal ID**: `73f3ba0f-7f70-4baf-8e46-f31e50bdb697`
- **Merchant ID**: `37408274-8fa7-4c78-a05f-3a5238148bcc`
- **API Key**: `739|TtSlRwlbwzkZs11qlHYcTkAQ7iTKeZMNcoQ1TFbY3382cf19`

---

## 💰 Collection (Customer Payment)

### Basic Collection Request

```bash
curl -X POST https://test-api.trendipay.com/v1/terminals/73f3ba0f-7f70-4baf-8e46-f31e50bdb697/collections \
  -H "Authorization: Bearer 739|TtSlRwlbwzkZs11qlHYcTkAQ7iTKeZMNcoQ1TFbY3382cf19" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Merchant-ID: 37408274-8fa7-4c78-a05f-3a5238148bcc" \
  -d '{
    "reference": "test-'$(date +%s)'",
    "accountNumber": "0241234567",
    "rSwitch": "mtn",
    "amount": "10.00",
    "description": "TrendiPay API test",
    "callbackUrl": "https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/collection",
    "type": "purchase",
    "currency": "GHS"
  }'
```

### Collection with Pretty JSON Output

```bash
curl -X POST https://test-api.trendipay.com/v1/terminals/73f3ba0f-7f70-4baf-8e46-f31e50bdb697/collections \
  -H "Authorization: Bearer 739|TtSlRwlbwzkZs11qlHYcTkAQ7iTKeZMNcoQ1TFbY3382cf19" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Merchant-ID: 37408274-8fa7-4c78-a05f-3a5238148bcc" \
  -d '{
    "reference": "test-'$(date +%s)'",
    "accountNumber": "0241234567",
    "rSwitch": "mtn",
    "amount": "10.00",
    "description": "TrendiPay API test",
    "callbackUrl": "https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/collection",
    "type": "purchase",
    "currency": "GHS"
  }' | python3 -m json.tool
```

### MTN Collection

```bash
curl -X POST https://test-api.trendipay.com/v1/terminals/73f3ba0f-7f70-4baf-8e46-f31e50bdb697/collections \
  -H "Authorization: Bearer 739|TtSlRwlbwzkZs11qlHYcTkAQ7iTKeZMNcoQ1TFbY3382cf19" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Merchant-ID: 37408274-8fa7-4c78-a05f-3a5238148bcc" \
  -d '{"reference":"test-mtn-'$(date +%s)'","accountNumber":"0241234567","rSwitch":"mtn","amount":"50.00","description":"MTN payment test","callbackUrl":"https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/collection","type":"purchase","currency":"GHS"}'
```

### Vodafone Collection

```bash
curl -X POST https://test-api.trendipay.com/v1/terminals/73f3ba0f-7f70-4baf-8e46-f31e50bdb697/collections \
  -H "Authorization: Bearer 739|TtSlRwlbwzkZs11qlHYcTkAQ7iTKeZMNcoQ1TFbY3382cf19" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Merchant-ID: 37408274-8fa7-4c78-a05f-3a5238148bcc" \
  -d '{"reference":"test-voda-'$(date +%s)'","accountNumber":"0501234567","rSwitch":"vodafone","amount":"75.00","description":"Vodafone payment test","callbackUrl":"https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/collection","type":"purchase","currency":"GHS"}'
```

### AirtelTigo Collection

```bash
curl -X POST https://test-api.trendipay.com/v1/terminals/73f3ba0f-7f70-4baf-8e46-f31e50bdb697/collections \
  -H "Authorization: Bearer 739|TtSlRwlbwzkZs11qlHYcTkAQ7iTKeZMNcoQ1TFbY3382cf19" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Merchant-ID: 37408274-8fa7-4c78-a05f-3a5238148bcc" \
  -d '{"reference":"test-airtel-'$(date +%s)'","accountNumber":"0261234567","rSwitch":"airteltigo","amount":"100.00","description":"AirtelTigo payment test","callbackUrl":"https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/collection","type":"purchase","currency":"GHS"}'
```

---

## 📤 Disbursement (Collector Payout)

### Basic Disbursement Request

```bash
curl -X POST https://test-api.trendipay.com/v1/terminals/73f3ba0f-7f70-4baf-8e46-f31e50bdb697/disbursements \
  -H "Authorization: Bearer 739|TtSlRwlbwzkZs11qlHYcTkAQ7iTKeZMNcoQ1TFbY3382cf19" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Merchant-ID: 37408274-8fa7-4c78-a05f-3a5238148bcc" \
  -d '{
    "reference": "test-disbursement-'$(date +%s)'",
    "accountNumber": "0241234567",
    "rSwitch": "mtn",
    "amount": "30.00",
    "description": "TrendiPay disbursement test",
    "callbackUrl": "https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/disbursement",
    "currency": "GHS"
  }'
```

### Disbursement with Pretty JSON Output

```bash
curl -X POST https://test-api.trendipay.com/v1/terminals/73f3ba0f-7f70-4baf-8e46-f31e50bdb697/disbursements \
  -H "Authorization: Bearer 739|TtSlRwlbwzkZs11qlHYcTkAQ7iTKeZMNcoQ1TFbY3382cf19" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Merchant-ID: 37408274-8fa7-4c78-a05f-3a5238148bcc" \
  -d '{
    "reference": "test-disbursement-'$(date +%s)'",
    "accountNumber": "0241234567",
    "rSwitch": "mtn",
    "amount": "30.00",
    "description": "TrendiPay disbursement test",
    "callbackUrl": "https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/disbursement",
    "currency": "GHS"
  }' | python3 -m json.tool
```

---

## 🔍 Status Check

### Check Collection Status

```bash
curl -X GET https://test-api.trendipay.com/v1/terminals/73f3ba0f-7f70-4baf-8e46-f31e50bdb697/collections/TP1234567890 \
  -H "Authorization: Bearer 739|TtSlRwlbwzkZs11qlHYcTkAQ7iTKeZMNcoQ1TFbY3382cf19" \
  -H "Accept: application/json" \
  -H "X-Merchant-ID: 37408274-8fa7-4c78-a05f-3a5238148bcc" | python3 -m json.tool
```

Replace `TP1234567890` with actual transaction ID from collection response.

### Check Disbursement Status

```bash
curl -X GET https://test-api.trendipay.com/v1/terminals/73f3ba0f-7f70-4baf-8e46-f31e50bdb697/disbursements/TP1234567890 \
  -H "Authorization: Bearer 739|TtSlRwlbwzkZs11qlHYcTkAQ7iTKeZMNcoQ1TFbY3382cf19" \
  -H "Accept: application/json" \
  -H "X-Merchant-ID: 37408274-8fa7-4c78-a05f-3a5238148bcc" | python3 -m json.tool
```

---

## 📊 Expected Responses

### ✅ Successful Collection

```json
{
  "success": true,
  "transactionId": "TP1234567890",
  "status": "pending",
  "message": "Collection initiated successfully",
  "reference": "test-1234567890",
  "checkStatusUrl": "https://test-api.trendipay.com/v1/terminals/73f3ba0f-7f70-4baf-8e46-f31e50bdb697/collections/TP1234567890"
}
```

### ✅ Successful Disbursement

```json
{
  "success": true,
  "transactionId": "TP9876543210",
  "status": "processing",
  "message": "Disbursement initiated successfully",
  "reference": "test-disbursement-1234567890",
  "checkStatusUrl": "https://test-api.trendipay.com/v1/terminals/73f3ba0f-7f70-4baf-8e46-f31e50bdb697/disbursements/TP9876543210"
}
```

### ❌ Error Response (400 - Bad Request)

```json
{
  "success": false,
  "status": 400,
  "message": "Invalid account number",
  "errors": {
    "accountNumber": ["The account number format is invalid"]
  }
}
```

### ❌ Error Response (401 - Unauthorized)

```json
{
  "success": false,
  "status": 401,
  "message": "Unauthorized"
}
```

---

## 🎯 Quick Test Script

Save this as `test-trendipay.sh`:

```bash
#!/bin/bash

# TrendiPay Quick Test Script

TERMINAL_ID="73f3ba0f-7f70-4baf-8e46-f31e50bdb697"
API_KEY="739|TtSlRwlbwzkZs11qlHYcTkAQ7iTKeZMNcoQ1TFbY3382cf19"
MERCHANT_ID="37408274-8fa7-4c78-a05f-3a5238148bcc"
API_URL="https://test-api.trendipay.com"
CALLBACK_URL="https://9cc4dfcd4830.ngrok-free.app"

echo "🧪 Testing TrendiPay Collection API..."
echo ""

curl -X POST "$API_URL/v1/terminals/$TERMINAL_ID/collections" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Merchant-ID: $MERCHANT_ID" \
  -d '{
    "reference": "test-'$(date +%s)'",
    "accountNumber": "0241234567",
    "rSwitch": "mtn",
    "amount": "1.00",
    "description": "Quick API test",
    "callbackUrl": "'$CALLBACK_URL'/api/webhooks/trendipay/collection",
    "type": "purchase",
    "currency": "GHS"
  }' | python3 -m json.tool

echo ""
echo "✅ Test complete!"
```

Make it executable and run:
```bash
chmod +x test-trendipay.sh
./test-trendipay.sh
```

---

## 📝 Important Headers

All TrendiPay API requests **must** include these headers:

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {API_KEY}` | ✅ Yes |
| `Content-Type` | `application/json` | ✅ Yes |
| `Accept` | `application/json` | ✅ Yes |
| `X-Merchant-ID` | `{MERCHANT_ID}` | ✅ Yes |

---

## 🔧 Variables Reference

Replace these in commands if needed:

```bash
# Your Configuration
TERMINAL_ID="73f3ba0f-7f70-4baf-8e46-f31e50bdb697"
API_KEY="739|TtSlRwlbwzkZs11qlHYcTkAQ7iTKeZMNcoQ1TFbY3382cf19"
MERCHANT_ID="37408274-8fa7-4c78-a05f-3a5238148bcc"
API_URL="https://test-api.trendipay.com"
NGROK_URL="https://9cc4dfcd4830.ngrok-free.app"
```

---

## 🚀 Testing Workflow

1. **Start webhook server**: `cd backend_webhooks && npm start`
2. **Start ngrok**: `ngrok http 3000`
3. **Run curl command**: Use any command above
4. **Monitor webhook**: Check http://127.0.0.1:4040
5. **Check database**: Verify in Supabase

---

**Updated**: December 5, 2024  
**Terminal ID**: `73f3ba0f-7f70-4baf-8e46-f31e50bdb697`  
**Required Header Added**: `Accept: application/json` ✅
