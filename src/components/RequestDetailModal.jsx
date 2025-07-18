import { useState } from 'react';
import { WasteType } from '../utils/types';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../utils/currencyUtils';

const RequestDetailModal = ({ request, onClose }) => {
  const [activeDetailTab, setActiveDetailTab] = useState('overview');
  // Get currency from context
  const { currency } = useCurrency();
  
  if (!request) return null;
  
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
  
  // Calculate environmental impact
  const calculateImpact = () => {
    if (!request.scanned_bags || request.scanned_bags.length === 0) {
      return { co2Reduced: 0, waterSaved: 0, energySaved: 0 };
    }
    
    // Calculate based on waste type and weight
    const totalWeight = request.scanned_bags.reduce((acc, bag) => acc + bag.weight, 0);
    
    // These are example calculations - in a real app these would be more accurate
    return {
      co2Reduced: (totalWeight * 2.5).toFixed(2), // kg of CO2
      waterSaved: (totalWeight * 1000).toFixed(0), // liters of water
      energySaved: (totalWeight * 5).toFixed(2), // kWh of energy
    };
  };
  
  const impact = calculateImpact();
  
  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeDetailTab) {
      case 'overview':
        return (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="font-medium text-gray-800 mb-2">Request Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">ID:</span>
                    <span className="font-medium">{request.id.substring(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className="font-medium">{request.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span className="font-medium">{formatDate(request.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pickup Date:</span>
                    <span className="font-medium">{formatDate(request.pickup_date)}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="font-medium text-gray-800 mb-2">Location</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Address:</span>
                    <span className="font-medium">{request.location || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">City:</span>
                    <span className="font-medium">{request.city || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Postal Code:</span>
                    <span className="font-medium">{request.postal_code || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-800 mb-2">Notes</h3>
              <p className="text-gray-700">{request.notes || 'No additional notes provided.'}</p>
            </div>
          </div>
        );
        
      case 'collection':
        return (
          <div className="p-4">
            <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
              <h3 className="font-medium text-gray-800 mb-2">Collection Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Pickup Date:</span>
                  <span className="font-medium">{formatDate(request.pickup_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed:</span>
                  <span className="font-medium">{formatDate(request.completed_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Disposal:</span>
                  <span className="font-medium">{formatDate(request.disposal_date)}</span>
                </div>
              </div>
            </div>
            
            {/* Earnings Summary Card */}
            <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
              <h3 className="font-medium text-gray-800 mb-2">Earnings Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="text-green-600 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {formatCurrency(request.scanned_bags ? request.scanned_bags.reduce((acc, bag) => acc + (bag.fee || 0), 0) : 0, currency)}
                  </div>
                  <div className="text-xs text-gray-600">Bag Collection Fees</div>
                </div>
                
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <div className="text-blue-600 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {formatCurrency(request.completion_bonus || 0, currency)}
                  </div>
                  <div className="text-xs text-gray-600">Completion Bonus</div>
                </div>
                
                <div className="bg-purple-50 p-3 rounded-lg text-center">
                  <div className="text-purple-600 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {request.scanned_bags ? request.scanned_bags.reduce((acc, bag) => acc + bag.points, 0) : '0'}
                  </div>
                  <div className="text-xs text-gray-600">Points Earned</div>
                </div>
              </div>
              
              {/* Total Earnings */}
              {request.total_earnings && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Total Earnings:</span>
                    <span className="text-lg font-bold text-green-600">{formatCurrency(request.total_earnings, currency)}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-800 mb-2">Scanned Bags</h3>
              {request.scanned_bags && request.scanned_bags.length > 0 ? (
                <div className="space-y-2">
                  {request.scanned_bags.map((bag, index) => (
                    <div key={bag.id || index} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
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
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between font-medium">
                      <span>Total:</span>
                      <div className="flex space-x-4">
                        <span>{request.scanned_bags.reduce((acc, bag) => acc + bag.weight, 0)} kg</span>
                        <span>{request.scanned_bags.reduce((acc, bag) => acc + bag.points, 0)} pts</span>
                        <span>₵{request.scanned_bags.reduce((acc, bag) => acc + (bag.fee || 0), 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No bags have been scanned yet.</p>
              )}
            </div>
          </div>
        );
        
      case 'impact':
        return (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                <div className="text-green-500 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
                <div className="text-2xl font-bold">{impact.co2Reduced}</div>
                <div className="text-gray-500 text-sm">kg CO₂ Reduced</div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                <div className="text-blue-500 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div className="text-2xl font-bold">{impact.waterSaved}</div>
                <div className="text-gray-500 text-sm">Liters of Water Saved</div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                <div className="text-yellow-500 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="text-2xl font-bold">{impact.energySaved}</div>
                <div className="text-gray-500 text-sm">kWh Energy Saved</div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-800 mb-2">Environmental Impact</h3>
              <p className="text-gray-700 mb-4">
                By recycling these materials, you've helped reduce landfill waste and conserved natural resources.
                The environmental impact is equivalent to:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="bg-green-100 p-2 rounded-full mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-700">Driving {(impact.co2Reduced * 4).toFixed(1)} fewer kilometers in an average car</span>
                </div>
                
                <div className="flex items-center">
                  <div className="bg-green-100 p-2 rounded-full mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-700">Saving enough water for {Math.round(impact.waterSaved / 150)} showers</span>
                </div>
                
                <div className="flex items-center">
                  <div className="bg-green-100 p-2 rounded-full mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-700">Powering a home for {Math.round(impact.energySaved / 30)} days</span>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'history':
        return (
          <div className="p-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-800 mb-4">Request Timeline</h3>
              
              <div className="relative pl-8 pb-6">
                <div className="absolute top-0 left-0 h-full w-0.5 bg-gray-200"></div>
                
                <div className="relative mb-6">
                  <div className="absolute -left-8 mt-1.5 w-4 h-4 rounded-full bg-green-500"></div>
                  <div className="mb-1 text-sm font-medium">{formatDate(request.created_at)}</div>
                  <div className="text-gray-700">Request created</div>
                </div>
                
                {request.accepted_at && (
                  <div className="relative mb-6">
                    <div className="absolute -left-8 mt-1.5 w-4 h-4 rounded-full bg-blue-500"></div>
                    <div className="mb-1 text-sm font-medium">{formatDate(request.accepted_at)}</div>
                    <div className="text-gray-700">Request accepted by collector</div>
                  </div>
                )}
                
                {request.completed_at && (
                  <div className="relative mb-6">
                    <div className="absolute -left-8 mt-1.5 w-4 h-4 rounded-full bg-purple-500"></div>
                    <div className="mb-1 text-sm font-medium">{formatDate(request.completed_at)}</div>
                    <div className="text-gray-700">Pickup completed</div>
                    {request.scanned_bags && (
                      <div className="text-gray-500 text-sm mt-1">
                        {request.scanned_bags.length} bags collected
                      </div>
                    )}
                  </div>
                )}
                
                {request.disposal_date && (
                  <div className="relative">
                    <div className="absolute -left-8 mt-1.5 w-4 h-4 rounded-full bg-amber-500"></div>
                    <div className="mb-1 text-sm font-medium">{formatDate(request.disposal_date)}</div>
                    <div className="text-gray-700">Waste disposed at recycling center</div>
                    {request.disposal_site && (
                      <div className="text-gray-500 text-sm mt-1">
                        Site: {request.disposal_site}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-4 bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-800 mb-2">Chain of Custody</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Requester:</span>
                  <span className="font-medium">{request.requester_id || 'Anonymous'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Collector:</span>
                  <span className="font-medium">{request.collector_id || 'Not assigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Disposal Verified:</span>
                  <span className="font-medium">{request.disposal_complete ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return <div className="p-4">Select a tab to view details</div>;
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-medium">Request Details</h2>
          <button onClick={onClose} className="text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b">
          <button 
            className={`flex-1 py-3 text-center font-medium ${activeDetailTab === 'overview' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-600'}`}
            onClick={() => setActiveDetailTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`flex-1 py-3 text-center font-medium ${activeDetailTab === 'collection' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-600'}`}
            onClick={() => setActiveDetailTab('collection')}
          >
            Collection
          </button>
          <button 
            className={`flex-1 py-3 text-center font-medium ${activeDetailTab === 'impact' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-600'}`}
            onClick={() => setActiveDetailTab('impact')}
          >
            Impact
          </button>
          <button 
            className={`flex-1 py-3 text-center font-medium ${activeDetailTab === 'history' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-600'}`}
            onClick={() => setActiveDetailTab('history')}
          >
            History
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="overflow-y-auto flex-1">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default RequestDetailModal;
