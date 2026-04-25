import React, { useState, useEffect } from 'react';
import { calculateDistance } from '../utils/locationUtils';
import { slideIn } from '../utils/animationUtils';
import { logger } from '../utils/logger';

/**
 * Component to display a list of assignments and requests
 * Designed for collectors with low literacy — uses big buttons, icons, and simple language
 */
const ItemList = ({ assignments, requests, userLocation }) => {
  const [filteredItems, setFilteredItems] = useState([]);
  const [sortOption, setSortOption] = useState('distance');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  
  // Process items when data changes
  useEffect(() => {
    // Combine assignments and requests
    let allItems = [];
    
    if (assignments && assignments.length > 0) {
      allItems = [...allItems, ...assignments];
    }
    
    if (requests && requests.length > 0) {
      allItems = [...allItems, ...requests];
    }
    
    if (allItems.length === 0) {
      setFilteredItems([]);
      return;
    }
    
    // Filter items by status
    let filtered = allItems;
    if (filterStatus !== 'all') {
      filtered = allItems.filter(item => item.status === filterStatus);
    }
    
    // Filter items by type
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }
    
    // Calculate distance for each item if user location is available
    if (userLocation) {
      filtered = filtered.map(item => {
        const distance = calculateDistance(
          { latitude: userLocation.latitude, longitude: userLocation.longitude },
          { latitude: item.latitude, longitude: item.longitude }
        );
        
        return {
          ...item,
          distance
        };
      });
    }
    
    // Sort items based on selected option
    switch (sortOption) {
      case 'distance':
        filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0));
        break;
      case 'name':
        filtered.sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''));
        break;
      case 'location':
        filtered.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
        break;
      default:
        filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
    
    setFilteredItems(filtered);
    
    // Apply slide-in animation to list items
    setTimeout(() => {
      const listItems = document.querySelectorAll('.item-list-item');
      listItems.forEach((item, index) => {
        setTimeout(() => {
          slideIn(item, 'bottom', 20, 300);
        }, index * 100);
      });
    }, 100);
  }, [assignments, requests, userLocation, sortOption, filterStatus, filterType]);
  
  // Status emoji + label for badges
  const statusInfo = {
    available: { emoji: '🟢', label: 'Open', bg: 'bg-green-100 text-green-800 border-green-300' },
    accepted:  { emoji: '🟡', label: 'Yours', bg: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    en_route:  { emoji: '🚚', label: 'Going', bg: 'bg-blue-100 text-blue-800 border-blue-300' },
    arrived:   { emoji: '📍', label: 'There', bg: 'bg-purple-100 text-purple-800 border-purple-300' },
    completed: { emoji: '✅', label: 'Done', bg: 'bg-green-100 text-green-800 border-green-300' },
    pending:   { emoji: '⏳', label: 'Wait', bg: 'bg-gray-100 text-gray-700 border-gray-300' },
  };
  
  const getStatus = (status) => statusInfo[status] || { emoji: '⚪', label: status || '—', bg: 'bg-gray-100 text-gray-600 border-gray-300' };

  // Filter button configs
  const statusFilters = [
    { key: 'all',       emoji: '📋', label: 'All' },
    { key: 'accepted',  emoji: '🟡', label: 'Yours' },
    { key: 'available', emoji: '🟢', label: 'Open' },
    { key: 'completed', emoji: '✅', label: 'Done' },
  ];

  const sortOptions = [
    { key: 'distance', emoji: '📍', label: 'Nearest' },
    { key: 'location', emoji: '🏠', label: 'Place' },
    { key: 'name',     emoji: '👤', label: 'Name' },
  ];
  
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <span className="text-2xl mr-2">🗒️</span> Your Pickups
          </h2>
          <span className="text-base font-bold bg-green-100 text-green-800 px-3 py-1 rounded-full">
            {filteredItems.length}
          </span>
        </div>
        
        {/* Show filter — big tap-friendly buttons */}
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Show</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusFilters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border-2 transition-all whitespace-nowrap
                  ${filterStatus === f.key
                    ? 'bg-green-500 text-white border-green-600 shadow-md scale-105'
                    : 'bg-gray-50 text-gray-700 border-gray-200 active:bg-gray-100'
                  }`}
              >
                <span className="text-lg">{f.emoji}</span>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort — big tap-friendly buttons */}
        <div className="mb-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Order by</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sortOptions.map(s => (
              <button
                key={s.key}
                onClick={() => setSortOption(s.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border-2 transition-all whitespace-nowrap
                  ${sortOption === s.key
                    ? 'bg-blue-500 text-white border-blue-600 shadow-md scale-105'
                    : 'bg-gray-50 text-gray-700 border-gray-200 active:bg-gray-100'
                  }`}
              >
                <span className="text-lg">{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100" />
      
      {/* List or empty state */}
      <div className="overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="text-center py-10 px-6">
            {/* Big friendly illustration */}
            <div className="text-6xl mb-4">📭</div>
            <p className="text-xl font-bold text-gray-700 mb-2">No pickups yet</p>
            <p className="text-base text-gray-500 mb-6 leading-relaxed">
              Go to <span className="font-bold text-green-600">Request</span> or <span className="font-bold text-blue-600">Assign</span> page and accept jobs first.
            </p>

            {/* Visual step-by-step guide */}
            <div className="bg-green-50 rounded-xl p-5 text-left max-w-xs mx-auto">
              <p className="text-sm font-bold text-green-800 mb-3 text-center">How to get pickups:</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
                  <span className="text-sm text-gray-700">Tap <span className="font-bold">Request</span> below</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
                  <span className="text-sm text-gray-700">Pick a job and tap <span className="font-bold">Accept</span></span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
                  <span className="text-sm text-gray-700">Come back here to see your route</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filteredItems.map((item, index) => {
              const st = getStatus(item.status);
              return (
                <li 
                  key={`${item.id || 'item'}-${index}`}
                  className="item-list-item opacity-0"
                  style={{ display: 'block' }}
                >
                  <div className="p-4 active:bg-gray-50">
                    {/* Top row: status badge + distance */}
                    <div className="flex justify-between items-center mb-2">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold border ${st.bg}`}>
                        <span>{st.emoji}</span> {st.label}
                      </span>
                      
                      {item.distance !== undefined && (
                        <span className="text-base font-bold text-gray-800 flex items-center gap-1">
                          <span className="text-lg">📍</span>
                          {item.distance < 1 
                            ? `${(item.distance * 1000).toFixed(0)} m` 
                            : `${item.distance.toFixed(1)} km`}
                        </span>
                      )}
                    </div>

                    {/* Location and name - large text */}
                    <div className="mb-3">
                      <h3 className="text-base font-bold text-gray-900">{item.location || 'Unknown location'}</h3>
                      {item.customer_name && (
                        <p className="text-sm text-gray-600 mt-0.5 flex items-center gap-1">
                          <span>👤</span> {item.customer_name}
                        </p>
                      )}
                      {item.waste_type && (
                        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                          <span>🗑️</span> {item.waste_type.charAt(0).toUpperCase() + item.waste_type.slice(1)}
                        </p>
                      )}
                    </div>
                    
                    {/* Big action buttons */}
                    <div className="flex gap-2">
                      <button
                        className="flex-1 py-3 bg-green-500 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 active:bg-green-600 shadow-sm"
                        onClick={() => {
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}&travelmode=driving`;
                          window.open(url, '_blank');
                        }}
                      >
                        <span className="text-xl">🧭</span> Go There
                      </button>
                      
                      <button
                        className="py-3 px-5 bg-gray-100 border-2 border-gray-200 rounded-xl text-gray-700 font-bold text-base flex items-center justify-center gap-2 active:bg-gray-200"
                        onClick={() => {
                          logger.debug('View details for item:', item.id);
                        }}
                      >
                        <span className="text-xl">ℹ️</span> Info
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ItemList;
