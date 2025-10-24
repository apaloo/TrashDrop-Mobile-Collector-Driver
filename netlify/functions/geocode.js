/**
 * Netlify Function: Reverse Geocoding Proxy
 * Proxies requests to OpenStreetMap Nominatim API to avoid CORS issues
 */

exports.handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const { lat, lng } = event.queryStringParameters;

  // Validate parameters
  if (!lat || !lng) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing lat or lng parameter' })
    };
  }

  // Validate coordinate ranges
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid coordinates' })
    };
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Coordinates out of valid range' })
    };
  }

  try {
    // Call Nominatim API with proper headers
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'TrashDropCollectorApp/1.0',
          'Accept': 'application/json',
          'Accept-Language': 'en'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API returned ${response.status}`);
    }

    const data = await response.json();

    // Return successful response with CORS headers
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Geocoding service unavailable',
        message: error.message
      })
    };
  }
};
