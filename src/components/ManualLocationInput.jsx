import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Component for manually entering location coordinates
 * Provides a fallback when browser geolocation fails
 */
const ManualLocationInput = ({ onLocationSubmit, onCancel }) => {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate inputs
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lng)) {
      setError('Please enter valid numbers for latitude and longitude');
      return;
    }
    
    if (lat < -90 || lat > 90) {
      setError('Latitude must be between -90 and 90 degrees');
      return;
    }
    
    if (lng < -180 || lng > 180) {
      setError('Longitude must be between -180 and 180 degrees');
      return;
    }
    
    // Submit valid coordinates
    onLocationSubmit({ latitude: lat, longitude: lng });
  };

  const handleUseCurrentCity = () => {
    // Default coordinates for some major cities
    const cities = [
      { name: 'New York', latitude: 40.7128, longitude: -74.0060 },
      { name: 'Los Angeles', latitude: 34.0522, longitude: -118.2437 },
      { name: 'Chicago', latitude: 41.8781, longitude: -87.6298 },
      { name: 'San Francisco', latitude: 37.7749, longitude: -122.4194 },
      { name: 'Miami', latitude: 25.7617, longitude: -80.1918 },
      { name: 'Seattle', latitude: 47.6062, longitude: -122.3321 }
    ];
    
    // Let user select a city
    const citySelect = document.createElement('select');
    citySelect.innerHTML = cities.map(city => 
      `<option value="${city.latitude},${city.longitude}">${city.name}</option>`
    ).join('');
    
    // Create a simple modal for city selection
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';
    
    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '8px';
    modalContent.style.width = '80%';
    modalContent.style.maxWidth = '400px';
    
    const heading = document.createElement('h3');
    heading.textContent = 'Select a city';
    heading.style.marginBottom = '15px';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-between';
    buttonContainer.style.marginTop = '20px';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.padding = '8px 16px';
    cancelButton.style.backgroundColor = '#f1f1f1';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.cursor = 'pointer';
    
    const selectButton = document.createElement('button');
    selectButton.textContent = 'Select';
    selectButton.style.padding = '8px 16px';
    selectButton.style.backgroundColor = '#10B981';
    selectButton.style.color = 'white';
    selectButton.style.border = 'none';
    selectButton.style.borderRadius = '4px';
    selectButton.style.cursor = 'pointer';
    
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(selectButton);
    
    modalContent.appendChild(heading);
    modalContent.appendChild(citySelect);
    modalContent.appendChild(buttonContainer);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    cancelButton.onclick = () => {
      document.body.removeChild(modal);
    };
    
    selectButton.onclick = () => {
      const [selectedLat, selectedLng] = citySelect.value.split(',');
      setLatitude(selectedLat);
      setLongitude(selectedLng);
      document.body.removeChild(modal);
    };
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Enter Your Location</h2>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-4">
          <p>{error}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="latitude" className="block text-sm font-medium text-gray-700 mb-1">
            Latitude
          </label>
          <input
            type="text"
            id="latitude"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="e.g., 37.7749"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="longitude" className="block text-sm font-medium text-gray-700 mb-1">
            Longitude
          </label>
          <input
            type="text"
            id="longitude"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="e.g., -122.4194"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>
        
        <div className="flex flex-col space-y-3">
          <button
            type="button"
            onClick={handleUseCurrentCity}
            className="w-full py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
          >
            Select from Common Cities
          </button>
          
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className="flex-1 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            >
              Use Location
            </button>
          </div>
        </div>
      </form>
      
      <div className="mt-4 text-xs text-gray-500">
        <p>Need help finding your coordinates?</p>
        <a 
          href="https://www.latlong.net/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-green-600 hover:underline"
        >
          Visit latlong.net to find your location
        </a>
      </div>
    </div>
  );
};

ManualLocationInput.propTypes = {
  onLocationSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default ManualLocationInput;
