# TrendiPay Amount Format - IMPORTANT

**Updated**: December 5, 2024  
**Critical Change**: Amount must be in pesewas (integer), not GHS (decimal)

---

## 🚨 Critical Information

### Amount Format Required by TrendiPay

**TrendiPay requires amounts in PESEWAS (Ghana's smallest currency unit)**

- **Format**: Integer (no decimals)
- **Minimum**: 100 pesewas (= 1.00 GHS)
- **Example**: 
  - 1.00 GHS = 100 pesewas
  - 10.00 GHS = 1000 pesewas
  - 50.00 GHS = 5000 pesewas

---

## ✅ Correct Format

### Collection Request (Correct)
```json
{
  "reference": "test-123",
  "accountNumber": "0241234567",
  "rSwitch": "mtn",
  "amount": 1000,           ← Integer in pesewas (10.00 GHS)
  "description": "Payment",
  "callbackUrl": "...",
  "type": "purchase",
  "currency": "GHS"
}
```

### Disbursement Request (Correct)
```json
{
  "reference": "test-456",
  "accountNumber": "0241234567",
  "rSwitch": "mtn",
  "amount": 3000,           ← Integer in pesewas (30.00 GHS)
  "description": "Payout",
  "callbackUrl": "...",
  "currency": "GHS"
}
```

---

## ❌ Incorrect Format

### DON'T Use Decimals
```json
{
  "amount": "10.00"    ← WRONG - Will cause error
}
```

```json
{
  "amount": 10.00      ← WRONG - Decimals not allowed
}
```

### DO Use Integer Pesewas
```json
{
  "amount": 1000       ← CORRECT - Integer pesewas
}
```

---

## 🔄 Conversion Formula

### GHS to Pesewas
```javascript
const amountInGHS = 10.00;
const amountInPesewas = Math.round(amountInGHS * 100);
// Result: 1000 pesewas
```

### Pesewas to GHS
```javascript
const amountInPesewas = 1000;
const amountInGHS = amountInPesewas / 100;
// Result: 10.00 GHS
```

---

## 📊 Common Amounts

| GHS (Cedis) | Pesewas | Usage |
|-------------|---------|-------|
| 1.00 GHS | 100 | Minimum allowed |
| 5.00 GHS | 500 | Small transaction |
| 10.00 GHS | 1000 | Common amount |
| 50.00 GHS | 5000 | Medium transaction |
| 100.00 GHS | 10000 | Large transaction |
| 500.00 GHS | 50000 | Very large |

---

## 🧪 Updated curl Commands

### Collection (10.00 GHS)
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
    "amount": 1000,
    "description": "Test payment 10 GHS",
    "callbackUrl": "https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/collection",
    "type": "purchase",
    "currency": "GHS"
  }' | python3 -m json.tool
```

### Collection (1.00 GHS - Minimum)
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
    "amount": 100,
    "description": "Test payment 1 GHS minimum",
    "callbackUrl": "https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/collection",
    "type": "purchase",
    "currency": "GHS"
  }' | python3 -m json.tool
```

### Disbursement (30.00 GHS)
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
    "amount": 3000,
    "description": "Test payout 30 GHS",
    "callbackUrl": "https://9cc4dfcd4830.ngrok-free.app/api/webhooks/trendipay/disbursement",
    "currency": "GHS"
  }' | python3 -m json.tool
```

---

## 🔧 How Our Code Handles This

### Frontend Input (GHS)
User enters amount in GHS: `10.00`

### Automatic Conversion
```javascript
// In trendiPayService.js
const amountInPesewas = Math.round(parseFloat(amount) * 100);
// 10.00 * 100 = 1000 pesewas

// Validation
if (amountInPesewas < 100) {
  throw new Error('Amount must be at least 1.00 GHS (100 pesewas)');
}
```

### API Request (Pesewas)
```javascript
const payload = {
  amount: amountInPesewas  // Sent as 1000, not "10.00"
};
```

---

## ⚠️ Validation Rules

### Minimum Amount
- **100 pesewas** (1.00 GHS) minimum
- Amounts below 100 pesewas will be rejected

### Integer Only
- Decimals are **NOT allowed**
- Must be whole number (integer)

### Rounding
- Our code uses `Math.round()` to handle edge cases
- Example: 10.99 GHS → 1099 pesewas

---

## 🎯 Test Scenarios

### Valid Amounts
```javascript
// All these will work:
1.00 GHS → 100 pesewas    ✅
5.50 GHS → 550 pesewas    ✅
10.00 GHS → 1000 pesewas  ✅
50.75 GHS → 5075 pesewas  ✅
100.00 GHS → 10000 pesewas ✅
```

### Invalid Amounts
```javascript
// These will be rejected:
0.50 GHS → 50 pesewas     ❌ Below minimum
0.99 GHS → 99 pesewas     ❌ Below minimum
0.00 GHS → 0 pesewas      ❌ Must be positive
-10.00 GHS → -1000        ❌ Must be positive
```

---

## 📝 Implementation Summary

### What Changed
1. **`trendiPayService.js`** - Converts GHS to pesewas
2. **`trendipay-test.html`** - Updated form validation (minimum 1.00 GHS)
3. **All test pages** - Display amounts in GHS but send as pesewas

### User Experience
- Users **input** amounts in **GHS** (e.g., 10.00)
- System **converts** to **pesewas** automatically
- API **receives** amounts in **pesewas** (e.g., 1000)
- **Transparent** - users don't need to know about pesewas

---

## 🚀 Testing

### Test with Minimum Amount
```bash
# Test 1.00 GHS (100 pesewas)
curl ... -d '{"amount": 100, ...}'
```

### Test Normal Amount
```bash
# Test 10.00 GHS (1000 pesewas)
curl ... -d '{"amount": 1000, ...}'
```

### Test Large Amount
```bash
# Test 100.00 GHS (10000 pesewas)
curl ... -d '{"amount": 10000, ...}'
```

---

## ❓ FAQ

### Q: Why pesewas and not GHS?
**A**: TrendiPay API requires amounts in the smallest currency unit (pesewas) to avoid floating-point precision issues.

### Q: Do users see pesewas?
**A**: No, users input and see amounts in GHS. The conversion happens automatically.

### Q: What if user enters 10.999 GHS?
**A**: System rounds to 1100 pesewas (11.00 GHS).

### Q: Can I send 0.50 GHS?
**A**: No, minimum is 1.00 GHS (100 pesewas).

### Q: What about 10.50 GHS?
**A**: Yes! This converts to 1050 pesewas (allowed).

---

## 🔍 Debugging

If you get amount-related errors:

1. **Check amount value** in request payload
2. **Verify it's an integer** (no decimals, no quotes)
3. **Ensure it's >= 100** pesewas
4. **Look at console logs** for conversion details

---

**Updated**: December 5, 2024  
**Status**: ✅ Implemented in all services  
**Format**: Integer pesewas (minimum 100)
