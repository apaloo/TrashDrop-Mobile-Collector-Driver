import { useState } from 'react';
import { PickupRequestStatus, WasteType } from '../utils/types';

const RequestCard = ({ 
  request, 
  onAccept, 
  onOpenDirections, 
  onScanQR, 
  onCompletePickup, 
  onLocateSite, 
  onDisposeBag, 
  onViewReport,
  onViewDetails
}) => {
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannedBags, setScannedBags] = useState(request.scanned_bags || []);
  const [expanded, setExpanded] = useState(false);
  
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
  
  // Simulate QR code scanning
  const handleScanQR = () => {
    // In a real app, this would use the device camera to scan a QR code
    // For this simulation, we'll generate a random bag
    
    const bagTypes = Object.values(WasteType);
    const randomType = bagTypes[Math.floor(Math.random() * bagTypes.length)];
    const randomWeight = (Math.random() * 5 + 0.5).toFixed(1);
    const randomPoints = Math.floor(Math.random() * 30) + 10;
    const randomFee = (Math.random() * 5 + 1).toFixed(2);
    
    const newBag = {
      id: `bag-${Date.now()}`,
      type: randomType,
      weight: parseFloat(randomWeight),
      points: randomPoints,
      fee: parseFloat(randomFee)
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
    switch (request.status) {
      case PickupRequestStatus.AVAILABLE:
        return (
          <div>
            <button 
              onClick={() => onAccept && onAccept(request.id)}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-md flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Accept
            </button>
          </div>
        );
      case PickupRequestStatus.ACCEPTED:
        return (
          <div className="flex flex-col gap-2 w-full">
            <button 
              onClick={() => onOpenDirections && onOpenDirections(request.id, request.location)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-md flex items-center justify-center"
            >
              Directions
            </button>
            <button 
              onClick={() => setShowQRScanner(true)}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 px-4 rounded-md flex items-center justify-center"
            >
              Scan QR
            </button>
            {/* Complete Pickup button moved to inside the QR scan modal */}
          </div>
        );
      case PickupRequestStatus.PICKED_UP:
        if (request.disposal_complete) {
          return (
            <div className="flex flex-col gap-2 w-full">
              <button 
                onClick={() => onViewReport && onViewReport(request.id)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 px-4 rounded-md flex items-center justify-center"
              >
                View Report
              </button>
            </div>
          );
        } else {
          return (
            <div className="flex flex-col gap-2 w-full">
              <button 
                onClick={() => onLocateSite && onLocateSite(request.id)}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-md flex items-center justify-center"
              >
                Locate Site
              </button>
              <button 
                onClick={() => onDisposeBag && onDisposeBag(request.id)}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-md flex items-center justify-center"
                id="disposeBagButton"
              >
                Dispose Bag
              </button>
            </div>
          );
        }
      default:
        return null;
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md mb-4 overflow-hidden relative">
      {/* Green accent in top-right corner */}
      <div className="absolute top-0 right-0 w-12 h-12 bg-green-500 transform rotate-45 translate-x-6 -translate-y-6"></div>
      
      {/* Card Body */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium">Anonymous</h3>
          <div className="text-sm text-gray-500">
            {formatDate(request.created_at)}
          </div>
        </div>
        
        <h3 className="font-medium text-lg mb-3">{request.location}</h3>
        
        <div className="flex justify-start space-x-4 mb-3">
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
            {request.bags || 1} bag
          </span>
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
            {request.points || 100} points
          </span>
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
            ${parseFloat(request.fee || 8.55).toFixed(2)}
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
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600 mb-2">Additional request details will appear here.</p>
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
                      ${bag.fee?.toFixed(2)}
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
                    <span>${scannedBags.reduce((acc, bag) => acc + (bag.fee || 0), 0).toFixed(2)}</span>
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
      
      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-medium">Scan QR Code</h2>
              <button onClick={() => setShowQRScanner(false)} className="text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <div className="bg-gray-100 rounded-lg aspect-square flex items-center justify-center mb-4">
                <div className="text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-gray-500">Camera simulation</p>
                </div>
              </div>
              
              {/* Simulate Scan Button - Moved to top of table */}
              <button 
                onClick={handleScanQR}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md mb-4"
              >
                Simulate Scan
              </button>
              
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
              
              {/* Complete Pickup Button - Moved inside modal after table */}
              {scannedBags.length > 0 && (
                <button 
                  onClick={() => {
                    onCompletePickup && onCompletePickup(request.id, scannedBags);
                    setShowQRScanner(false);
                  }}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md flex items-center justify-center"
                >
                  Complete Pickup ({scannedBags.length} bags)
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
