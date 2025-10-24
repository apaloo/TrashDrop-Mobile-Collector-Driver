# Netlify Functions

This directory contains serverless functions for the TrashDrop Mobile Collector Driver app.

## Functions

### `geocode.js` - Reverse Geocoding Proxy

Proxies reverse geocoding requests to OpenStreetMap Nominatim API to avoid CORS issues in the browser.

**Endpoint**: `/.netlify/functions/geocode`

**Method**: `GET`

**Query Parameters**:
- `lat` (required): Latitude coordinate (e.g., 5.6336)
- `lng` (required): Longitude coordinate (e.g., -0.1732)

**Example Request**:
```
GET /.netlify/functions/geocode?lat=5.6336&lng=-0.1732
```

**Example Response**:
```json
{
  "place_id": 123456,
  "lat": "5.6336",
  "lon": "-0.1732",
  "display_name": "Ring Road, East Legon, Accra, Ghana",
  "address": {
    "road": "Ring Road",
    "suburb": "East Legon",
    "city": "Accra",
    "country": "Ghana"
  }
}
```

**Error Response**:
```json
{
  "error": "Missing lat or lng parameter"
}
```

## Local Testing

### Option 1: Netlify CLI (Recommended)

1. Install Netlify CLI globally:
   ```bash
   npm install -g netlify-cli
   ```

2. Run the dev server with functions:
   ```bash
   netlify dev
   ```

3. Test the function:
   ```bash
   curl "http://localhost:8888/.netlify/functions/geocode?lat=5.6336&lng=-0.1732"
   ```

### Option 2: Direct Testing (Development Mode)

When running on localhost (via `npm run dev`), the app automatically falls back to calling Nominatim API directly since Netlify functions aren't available locally.

## Production Deployment

When deployed to Netlify:
1. Functions are automatically deployed from the `netlify/functions` directory
2. Available at `https://your-site.netlify.app/.netlify/functions/geocode`
3. The app automatically detects production environment and uses the function
4. CORS issues are completely resolved since requests go through your domain

## Features

✅ **CORS-free**: All requests go through your domain
✅ **Caching**: Responses cached for 24 hours to reduce API calls
✅ **Validation**: Input validation for coordinates
✅ **Error Handling**: Proper error responses with status codes
✅ **Rate Limiting**: Respects Nominatim's usage policy with proper headers

## Nominatim Usage Policy

This function respects OpenStreetMap Nominatim's usage policy:
- Includes proper `User-Agent` header
- Implements 24-hour caching to reduce API load
- Rate limited on the client side with circuit breaker pattern

For high-volume usage, consider:
- Setting up your own Nominatim instance
- Using a commercial geocoding service
- Implementing additional caching layers

## Troubleshooting

**Function not found locally**: Make sure you're using `netlify dev` instead of `npm run dev` for local testing with functions.

**CORS errors in production**: Verify the function is deployed correctly by visiting `https://your-site.netlify.app/.netlify/functions/geocode?lat=5.6&lng=-0.2` directly.

**Timeout errors**: The function has an 8-second timeout. If Nominatim is slow, consider implementing retry logic or using a different service.
