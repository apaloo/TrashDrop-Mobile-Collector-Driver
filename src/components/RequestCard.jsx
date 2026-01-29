import React, { useState, useEffect } from 'react';
import QRCodeScanner from './QRCodeScanner';
import { PickupRequestStatus, WasteType } from '../utils/types';
import { isWithinRadius } from '../utils/locationUtils';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../utils/currencyUtils';
import { formatLocationAsync } from '../utils/geoUtils';
import { logger } from '../utils/logger';

const RequestCard = ({ 
  request, 
  onAccept, 
  onOpenDirections, 
  onScanQR, 
  onCompletePickup, 
  onLocateSite, 
  onDisposeBag, 
  onViewReport,
  onViewDetails,
  selectable = false,
  selected = false,
  onSelect,
  siteLocated = false,  // Whether disposal site has been located
  highlightLocateSite = false,  // Visual cue to highlight Locate Site button
  navigationStarted = false,  // Whether navigation to pickup has been started
  highlightDirections = false,  // Visual cue to highlight Directions button
  hasArrived = false  // Whether user has arrived at this request location (from NavigationQRModal)
}) => {
  // Get currency from context
  const { currency } = useCurrency();
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannedBags, setScannedBags] = useState(request.scanned_bags || []);
  const [expanded, setExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [formattedLocation, setFormattedLocation] = useState('Loading location...');
  const RADIUS_METERS = 50; // 50 meter radius requirement
  
  // Format location with reverse geocoding
  useEffect(() => {
    const loadLocation = async () => {
      if (request.location) {
        const formatted = await formatLocationAsync(request.location);
        setFormattedLocation(formatted);
      }
    };
    loadLocation();
  }, [request.location]);
  
  // Get user's current location when QR scanner modal opens
  useEffect(() => {
    if (showQRScanner) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation([latitude, longitude]);
          },
          (error) => {
            logger.error('Error getting location:', error);
            // Keep default location if there's an error
            setUserLocation([5.5913, -0.1969]); // Default location
          },
          { enableHighAccuracy: true }
        );
      }
    }
  }, [showQRScanner]);
  
  // Check if user is within range of pickup location
  useEffect(() => {
    // CRITICAL: If user has already arrived via NavigationQRModal, bypass geofence check
    if (hasArrived) {
      logger.info('✅ User already arrived via navigation - bypassing geofence check');
      setIsWithinRange(true);
      return;
    }
    
    if (userLocation && request.coordinates) {
      // Handle both array format [lat, lng] and object format {lat, lng}
      let requestCoords;
      if (Array.isArray(request.coordinates)) {
        // Already in array format [lat, lng]
        requestCoords = request.coordinates;
      } else if (typeof request.coordinates === 'object' && request.coordinates !== null) {
        // Object format {lat, lng} or {latitude, longitude}
        const lat = request.coordinates.lat || request.coordinates.latitude;
        const lng = request.coordinates.lng || request.coordinates.longitude;
        requestCoords = [lat, lng];
      } else {
        logger.warn('⚠️ Unknown coordinates format in RequestCard:', request.coordinates);
        setIsWithinRange(false);
        return;
      }
      
      // Validate coordinates before checking range
      if (!requestCoords[0] || !requestCoords[1] || isNaN(requestCoords[0]) || isNaN(requestCoords[1])) {
        logger.warn('⚠️ Invalid coordinates in RequestCard:', requestCoords);
        setIsWithinRange(false);
        return;
      }
      
      const withinRange = isWithinRadius(userLocation, requestCoords, RADIUS_METERS);
      logger.debug('🎯 RequestCard geofence check:', { 
        userLocation, 
        requestCoords, 
        radiusMeters: RADIUS_METERS, 
        withinRange 
      });
      setIsWithinRange(withinRange);
    } else {
      setIsWithinRange(false);
    }
  }, [userLocation, request.coordinates, RADIUS_METERS, hasArrived]);
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  // Get waste type badge color
  const getWasteTypeBadgeColor = (type) => {
    switch (type) {
      case WasteType.PLASTIC:
        return 'bg-blue-100 text-blue-800';
      case WasteType.PAPER:
        return 'bg-yellow-100 text-yellow-800';
      case WasteType.METAL:
        return 'bg-gray-100 text-gray-800';
      case WasteType.GLASS:
        return 'bg-green-100 text-green-800';
      case WasteType.ORGANIC:
        return 'bg-amber-100 text-amber-800';
      case WasteType.RECYCLING:
        return 'bg-teal-100 text-teal-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Process QR code scanning
  const handleScanQR = (qrData) => {
    // Process the QR code data from a valid TrashDrop QR code
    // In a real app, this would extract data from the QR code
    // For this simulation, we'll use the QR data or generate values if not provided
    
    const bagTypes = Object.values(WasteType);
    const bagType = qrData?.type || bagTypes[Math.floor(Math.random() * bagTypes.length)];
    const bagWeight = qrData?.weight || (Math.random() * 5 + 0.5).toFixed(1);
    const bagPoints = qrData?.points || Math.floor(Math.random() * 30) + 10;
    const bagFee = qrData?.fee || (Math.random() * 5 + 1).toFixed(2);
    
    const newBag = {
      id: qrData?.bagId || `bag-${Date.now()}`,
      type: bagType,
      weight: parseFloat(bagWeight),
      points: bagPoints,
      fee: parseFloat(bagFee)
    };
    
    const updatedBags = [...scannedBags, newBag];
    setScannedBags(updatedBags);
    
    // Call the parent handler
    if (onScanQR) {
      onScanQR(request.id, updatedBags);
    }
    
    // No longer closing the scanner after each scan
    // This allows users to scan multiple bags without reopening the modal
  };
  
  // Render action buttons based on request status
  const renderActionButtons = () => {
    // Check if this is a digital bin (used across multiple cases)
    const isDigitalBin = request.source_type === 'digital_bin';
    
    switch (request.status) {
      case PickupRequestStatus.AVAILABLE:
        // Different styling for digital bins (but same workflow)
        const buttonClasses = isDigitalBin 
          ? "w-full bg-black hover:bg-gray-800 text-white py-3 px-4 rounded-md flex items-center justify-center"
          : "w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-md flex items-center justify-center";
        
        return (
          <div>
            <button 
              onClick={() => onAccept && onAccept(request.id)}
              className={buttonClasses}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Accept
            </button>
          </div>
        );
      case PickupRequestStatus.ACCEPTED:
        // Visual-first pickup flow for low-literacy users
        // Step 1: Directions (navigate to pickup location)
        // Step 2: Scan QR (only active after navigation started)
        return (
          <div className="flex flex-col gap-2 w-full">
            {/* Step 1: Directions - with pulsing animation when highlighted */}
            <button 
              onClick={() => {
                // Haptic feedback
                if (navigator.vibrate) navigator.vibrate(50);
                onOpenDirections && onOpenDirections(request.id, request.location);
              }}
              className={`w-full py-3 px-4 rounded-md flex items-center justify-center transition-all duration-300 ${
                highlightDirections 
                  ? 'bg-blue-600 animate-pulse ring-4 ring-blue-300 scale-105' 
                  : navigationStarted 
                    ? 'bg-green-500 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {/* Step number circle */}
              <span className={`w-7 h-7 rounded-full flex items-center justify-center mr-2 text-sm font-bold ${
                navigationStarted ? 'bg-white text-green-600' : 'bg-white/30 text-white'
              }`}>
                {navigationStarted ? '✓' : '1'}
              </span>
              {/* Navigation icon */}
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
              </svg>
              {navigationStarted ? 'On My Way ✓' : 'Directions'}
              {/* Animated pointer when highlighted */}
              {highlightDirections && (
                <span className="ml-2 animate-bounce">👆</span>
              )}
            </button>
            
            {/* Visual arrow between steps when navigation not started */}
            {!navigationStarted && (
              <div className="flex justify-center text-gray-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                </svg>
              </div>
            )}
            
            {/* Step 2: Scan QR - grayed out until navigation started */}
            <button 
              onClick={() => {
                if (!navigationStarted) {
                  // Haptic feedback - error pattern
                  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                  return;
                }
                // Success haptic
                if (navigator.vibrate) navigator.vibrate(50);
                setShowQRScanner(true);
              }}
              className={`w-full py-3 px-4 rounded-md flex items-center justify-center transition-all duration-300 ${
                navigationStarted 
                  ? 'bg-purple-500 hover:bg-purple-600 text-white' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {/* Step number circle */}
              <span className={`w-7 h-7 rounded-full flex items-center justify-center mr-2 text-sm font-bold ${
                navigationStarted ? 'bg-white/30 text-white' : 'bg-gray-400 text-gray-200'
              }`}>
                2
              </span>
              {/* QR scan icon */}
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
              </svg>
              Scan QR
              {/* Lock icon when disabled */}
              {!navigationStarted && (
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
              )}
            </button>
            {/* Complete Pickup button moved to inside the QR scan modal */}
          </div>
        );
      case PickupRequestStatus.PICKED_UP:
        // Check if this is a disposed digital bin
        const isDisposed = isDigitalBin ? request.status === 'disposed' : request.disposal_complete;
        
        if (isDisposed) {
          return (
            <div className="flex flex-col gap-2 w-full">
              {/* Digital bin disposed tag */}
              {isDigitalBin && (
                <div className="w-full bg-gray-100 border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-md flex items-center justify-center font-medium">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Bin Disposed
                </div>
              )}
              
              {/* View Report button for regular requests */}
              {!isDigitalBin && (
                <button 
                  onClick={() => onViewReport && onViewReport(request.id)}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 px-4 rounded-md flex items-center justify-center"
                >
                  View Report
                </button>
              )}
            </div>
          );
        } else {
          // Visual-first disposal flow for low-literacy users
          // Step 1: Locate Site (with map icon)
          // Step 2: Dispose Bag (with checkmark icon) - only active after step 1
          return (
            <div className="flex flex-col gap-2 w-full">
              {/* Step 1: Locate Site - with pulsing animation when highlighted */}
              <button 
                onClick={() => {
                  // Haptic feedback
                  if (navigator.vibrate) navigator.vibrate(50);
                  onLocateSite && onLocateSite(request.id);
                }}
                className={`w-full py-3 px-4 rounded-md flex items-center justify-center transition-all duration-300 ${
                  highlightLocateSite 
                    ? 'bg-blue-600 animate-pulse ring-4 ring-blue-300 scale-105' 
                    : siteLocated 
                      ? 'bg-green-500 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {/* Step number circle */}
                <span className={`w-7 h-7 rounded-full flex items-center justify-center mr-2 text-sm font-bold ${
                  siteLocated ? 'bg-white text-green-600' : 'bg-white/30 text-white'
                }`}>
                  {siteLocated ? '✓' : '1'}
                </span>
                {/* Map pin icon */}
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                {siteLocated ? 'Site Found ✓' : 'Locate Site'}
                {/* Animated arrow pointing down when highlighted */}
                {highlightLocateSite && (
                  <span className="ml-2 animate-bounce">👆</span>
                )}
              </button>
              
              {/* Visual arrow between steps when site not located */}
              {!siteLocated && (
                <div className="flex justify-center text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                  </svg>
                </div>
              )}
              
              {/* Step 2: Dispose Bag - grayed out until site located */}
              <button 
                onClick={() => {
                  if (!siteLocated) {
                    // Haptic feedback - error pattern
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                    return;
                  }
                  // Success haptic
                  if (navigator.vibrate) navigator.vibrate(50);
                  onDisposeBag && onDisposeBag(request.id);
                }}
                className={`w-full py-3 px-4 rounded-md flex items-center justify-center transition-all duration-300 ${
                  siteLocated 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                id="disposeBagButton"
              >
                {/* Step number circle */}
                <span className={`w-7 h-7 rounded-full flex items-center justify-center mr-2 text-sm font-bold ${
                  siteLocated ? 'bg-white/30 text-white' : 'bg-gray-400 text-gray-200'
                }`}>
                  2
                </span>
                {/* Checkmark/dispose icon */}
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Dispose Bag
                {/* Lock icon when disabled */}
                {!siteLocated && (
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </svg>
                )}
              </button>
            </div>
          );
        }
      default:
        return null;
    }
  };
  
  return (
    <div className={`bg-white rounded-lg shadow-md mb-4 overflow-hidden relative ${selected ? 'ring-2 ring-green-500' : ''}`}>
      {/* Accent in top-right corner - black for digital bins, green for others */}
      <div className={`absolute top-0 right-0 w-12 h-12 transform rotate-45 translate-x-6 -translate-y-6 ${
        request.source_type === 'digital_bin' ? 'bg-black' : 'bg-green-500'
      }`}></div>
      
      {/* Selection checkbox - only shown when selectable is true */}
      {selectable && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect && onSelect(request.id)}
            className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
        </div>
      )}
      
      {/* Card Body */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium">
            {request.source_type === 'digital_bin' ? 'Digital Bin' : 'Anonymous'}
          </h3>
          <div className="text-sm text-gray-500">
            {formatDate(request.created_at)}
          </div>
        </div>
        
        <p className="text-sm text-gray-600 mb-3">{formattedLocation}</p>
        
        <div className="flex justify-start space-x-4 mb-3">
          <span className={`px-3 py-1 rounded-full text-sm ${
            request.source_type === 'digital_bin' 
              ? 'bg-gray-100 text-gray-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {request.source_type === 'digital_bin' 
              ? `${request.waste_type || 'General'} Bin`
              : `${request.bags || 1} bag`
            }
          </span>
          {request.source_type !== 'digital_bin' && (
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
              {request.points || 100} points
            </span>
          )}
          {request.source_type === 'digital_bin' && (
            <span className="bg-black text-white px-3 py-1 rounded-full text-sm">
              Digital Collection
            </span>
          )}
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
            {formatCurrency(request.fee || 0, currency)}
          </span>
        </div>
        
        {/* View More Button */}
        <button 
          onClick={() => setExpanded(!expanded)} 
          className="flex items-center text-green-600 text-sm font-medium mb-3"
        >
          <svg className={`w-4 h-4 mr-1 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
          </svg>
          View More
        </button>
        
        {/* Expanded Content */}
        {expanded && (
          <div className="mb-4 p-3 bg-gray-50 rounded-md space-y-3">
            {/* Payment Breakdown - show for both new and legacy requests */}
            {(() => {
              // New payment model - has breakdown data
              if (request.collector_core_payout) {
                return (
                  <div className="bg-white p-3 rounded border border-green-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Your Payout Breakdown</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Core ({request.deadhead_km?.toFixed(1) || '?'}km approach)
                        </span>
                        <span className="font-medium">{formatCurrency(request.collector_core_payout, currency)}</span>
                      </div>
                      
                      {request.collector_urgent_payout > 0 && (
                        <div className="flex justify-between text-orange-600">
                          <span>⚡ Urgent Bonus</span>
                          <span className="font-medium">{formatCurrency(request.collector_urgent_payout, currency)}</span>
                        </div>
                      )}
                      
                      {request.collector_distance_payout > 0 && (
                        <div className="flex justify-between text-blue-600">
                          <span>📍 Distance Bonus</span>
                          <span className="font-medium">{formatCurrency(request.collector_distance_payout, currency)}</span>
                        </div>
                      )}
                      
                      {request.surge_multiplier > 1.0 && (
                        <div className="flex justify-between text-red-600">
                          <span>🔥 Surge ×{request.surge_multiplier}</span>
                          <span className="font-medium">{formatCurrency(request.collector_surge_payout, currency)}</span>
                        </div>
                      )}
                      
                      {request.collector_tips > 0 && (
                        <div className="flex justify-between text-purple-600">
                          <span>💵 Tips</span>
                          <span className="font-medium">{formatCurrency(request.collector_tips, currency)}</span>
                        </div>
                      )}
                      
                      {request.collector_recyclables_payout > 0 && (
                        <div className="flex justify-between text-teal-600">
                          <span>♻️ Recyclables</span>
                          <span className="font-medium">{formatCurrency(request.collector_recyclables_payout, currency)}</span>
                        </div>
                      )}
                      
                      {request.collector_loyalty_cashback > 0 && (
                        <div className="flex justify-between text-indigo-600">
                          <span>⭐ Loyalty Cashback</span>
                          <span className="font-medium">{formatCurrency(request.collector_loyalty_cashback, currency)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between font-bold text-green-600 border-t pt-1 mt-1">
                        <span>Total Payout</span>
                        <span>{formatCurrency(request.collector_total_payout, currency)}</span>
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Legacy request - show estimated breakdown
              // Check for fee existence (including 0 for digital bins)
              if (request.fee !== undefined && request.fee !== null) {
                const totalPayout = parseFloat(request.fee);
                
                // Estimate: 87% core (average deadhead), 13% potential bonuses
                const estimatedCore = totalPayout * 0.87;
                const estimatedBonus = totalPayout * 0.13;
                
                return (
                  <div className="bg-white p-3 rounded border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-700">Estimated Payout Breakdown</h4>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Estimated</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">💼 Base Payout</span>
                        <span className="font-medium">{formatCurrency(estimatedCore, currency)}</span>
                      </div>
                      
                      <div className="flex justify-between text-blue-600">
                        <span>⚡ Potential Bonuses</span>
                        <span className="font-medium">{formatCurrency(estimatedBonus, currency)}</span>
                      </div>
                      
                      <div className="flex justify-between font-bold text-green-600 border-t pt-1 mt-1">
                        <span>Total Payout</span>
                        <span>{formatCurrency(totalPayout, currency)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Actual breakdown will be calculated when you accept this request based on your location and bonuses.
                    </p>
                  </div>
                );
              }
              
              return null;
            })()}
            
            <p className="text-sm text-gray-600">Additional request details will appear here.</p>
          </div>
        )}
        
        {/* Scanned Bags */}
        {scannedBags.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <h4 className="text-sm font-medium mb-2">Scanned Bags ({scannedBags.length})</h4>
            <div className="space-y-2">
              {scannedBags.map((bag, index) => (
                <div key={bag.id || index} className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
                  <div className="flex items-center">
                    <span className={`${getWasteTypeBadgeColor(bag.type)} px-2 py-1 rounded-full text-xs mr-2`}>
                      {bag.type}
                    </span>
                    <span className="text-sm">{bag.weight} kg</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full text-xs">
                      {bag.points} pts
                    </span>
                    <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs">
                      {formatCurrency(bag.fee, currency)}
                    </span>
                  </div>
                </div>
              ))}
              
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <div className="flex space-x-4">
                    <span>{scannedBags.reduce((acc, bag) => acc + bag.weight, 0).toFixed(1)} kg</span>
                    <span>{scannedBags.reduce((acc, bag) => acc + bag.points, 0)} pts</span>
                    <span>{formatCurrency(scannedBags.reduce((acc, bag) => acc + (bag.fee || 0), 0), currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="mt-4">
          {renderActionButtons()}
        </div>
      </div>
      
      {/* Location Restriction Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 text-center">
            <div className="mb-4 text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Location Restriction</h3>
            <p className="text-gray-600 mb-6">
              You must be within 50 meters of the pickup location to complete this pickup.
              Please move closer to the location and try again.
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => setShowLocationModal(false)}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                OK, I Understand
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-md my-8 mx-auto shadow-xl">
            <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center z-10">
              <h2 className="text-lg font-medium">Scan QR Code</h2>
              <button onClick={() => setShowQRScanner(false)} className="text-gray-500 hover:bg-gray-100 rounded-full p-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {/* QR Code Scanner */}
              <QRCodeScanner
                isWithinRange={isWithinRange}
                onScanSuccess={(decodedText) => {
                  logger.debug('QR Code scanned:', decodedText);
                  try {
                    // Parse the QR code data
                    const qrData = JSON.parse(decodedText);
                    if (qrData && qrData.source === 'trashdrop' && qrData.bagId) {
                      // Process the QR code data from TrashDrop
                      handleScanQR(qrData);
                    }
                  } catch (e) {
                    logger.error('Error processing QR data:', e);
                  }
                }}
                onScanError={(error) => {
                  logger.error('QR scan error:', error);
                  // Display error to user if needed
                }}
              />
              
              {/* Scanned Bags Table */}
              <div className="mb-4 overflow-x-auto">
                <h3 className="text-sm font-medium mb-2">Scanned Bags ({scannedBags.length || 0})</h3>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fee</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {scannedBags && scannedBags.length > 0 ? (
                      <>
                        {scannedBags.map((bag, index) => (
                          <tr key={bag.id || index}>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`${getWasteTypeBadgeColor(bag.type)} px-2 py-1 rounded-full text-xs`}>
                                {bag.type}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs">{bag.weight} kg</td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs">{bag.points} pts</td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs">${parseFloat(bag.fee || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-medium">
                          <td className="px-3 py-2 whitespace-nowrap text-xs">Total</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{scannedBags.reduce((acc, bag) => acc + (parseFloat(bag.weight) || 0), 0).toFixed(1)} kg</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{scannedBags.reduce((acc, bag) => acc + (parseInt(bag.points) || 0), 0)} pts</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">${scannedBags.reduce((acc, bag) => acc + (parseFloat(bag.fee) || 0), 0).toFixed(2)}</td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-3 py-4 text-center text-sm text-gray-500">No bags scanned yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Location Status Indicator - Always visible */}
              <div className={`mb-4 p-3 rounded-md ${isWithinRange ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${isWithinRange ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <p className={`text-sm ${isWithinRange ? 'text-green-700' : 'text-red-700'}`}>
                    {isWithinRange 
                      ? 'You are within 50 meters of the pickup location' 
                      : 'You must be within 50 meters of the pickup location'}
                  </p>
                </div>
              </div>
              
              {/* Complete Pickup Button - Moved inside modal after table */}
              {scannedBags.length > 0 && (
                <button 
                  onClick={() => {
                    if (!isWithinRange) {
                      setShowLocationModal(true);
                      return;
                    }
                    onCompletePickup && onCompletePickup(request.id, scannedBags);
                    setShowQRScanner(false);
                  }}
                  className={`w-full py-2 px-4 rounded-md flex items-center justify-center text-white ${isWithinRange 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-red-400 cursor-not-allowed'}`}
                >
                  {isWithinRange 
                    ? `Complete Pickup (${scannedBags.length} bags)` 
                    : 'Too Far From Pickup Location'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestCard;
