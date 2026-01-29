import React, { useEffect, useState } from 'react';
import { AssignmentStatus } from '../utils/types';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with webpack/vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

/**
 * Modal component for displaying detailed assignment information
 * Includes map view and action buttons based on assignment status
 */
const AssignmentDetailsModal = ({ 
  assignment, 
  isOpen, 
  onClose, 
  onAccept, 
  onNavigate, 
  onComplete,
  onDumpingSite,
  onDispose,
  onViewReport,
  tabContext = null // New prop to determine which tab opened the modal
}) => {
  if (!isOpen || !assignment) return null;
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get priority badge color
  const getPriorityBadgeColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Initialize map when modal opens
  // Parse coordinates from assignment - NO HARDCODED FALLBACK
  const [coordinates, setCoordinates] = useState(null); // Will be set from assignment data

  useEffect(() => {
    if (isOpen && assignment) {
      // In a real app, you would get actual coordinates from the assignment
      // For now, we'll use a geocoding simulation based on the location string
      const simulateGeocode = (locationString) => {
        // This is a simplified simulation - in a real app you would use a geocoding service
        // Add some randomness around Accra for demo purposes
        const baseLatitude = 5.6037;
        const baseLongitude = -0.1870;
        
        // Generate a "unique" but consistent coordinate based on the location string
        const hash = locationString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const latOffset = (hash % 100) / 1000;
        const lngOffset = ((hash * 13) % 100) / 1000;
        
        return [baseLatitude + latOffset, baseLongitude + lngOffset];
      };
      
      // Set coordinates based on the assignment location
      setCoordinates(simulateGeocode(assignment.location));
    }
  }, [isOpen, assignment]);
  
  // Determine if this modal should float under Available tab
  const isAvailableTab = tabContext === 'available';
  
  // Different styling based on which tab opened the modal
  const modalContainerClass = isAvailableTab
    ? "fixed inset-x-0 top-[130px] bottom-[80px] z-[1000] flex flex-col items-center p-4 pt-0 pointer-events-none"
    : "fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-center justify-center p-4";
    
  const modalContentClass = isAvailableTab
    ? "bg-white rounded-lg shadow-xl w-full max-w-lg h-full overflow-hidden pointer-events-auto relative flex flex-col"
    : "bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden relative";
  
  return (
    <div className={modalContainerClass}>
      <div className={modalContentClass}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Assignment Details</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className={`overflow-y-auto p-4 flex-1 ${isAvailableTab ? 'pb-20' : 'max-h-[calc(90vh-8rem)]'}`}>
          {/* Basic Info */}
          <div className="mb-4">
            <h3 className="font-bold text-lg">{assignment.type} Assignment</h3>
            <p className="text-sm text-gray-600">{assignment.location}</p>
            <div className="flex items-center mt-1">
              <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full font-medium mr-2">#{assignment.id}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityBadgeColor(assignment.priority)}`}>
                {assignment.priority.charAt(0).toUpperCase() + assignment.priority.slice(1)} Priority
              </span>
            </div>
          </div>
          
          {/* Map */}
          <div className="mb-4 bg-gray-100 rounded-lg overflow-hidden">
            <div className="h-48">
              <MapContainer 
                center={coordinates} 
                zoom={15} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={coordinates}>
                  <Popup>
                    {assignment.location}
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
            <div className="p-2 bg-gray-50 border-t border-gray-200">
              <p className="text-sm text-gray-600 font-medium">{assignment.location}</p>
              <p className="text-xs text-gray-500">Distance: {assignment.distance}</p>
            </div>
          </div>
          
          {/* Details */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-gray-500 text-sm">Authority</p>
              <p className="font-medium">{assignment.authority}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Payment</p>
              <p className="font-medium">₵{assignment.payment}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Estimated Time</p>
              <p className="font-medium">{assignment.estimated_time}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Created</p>
              <p className="font-medium">{formatDate(assignment.created_at)}</p>
            </div>
            {assignment.accepted_at && (
              <div>
                <p className="text-gray-500 text-sm">Accepted</p>
                <p className="font-medium">{formatDate(assignment.accepted_at)}</p>
              </div>
            )}
            {assignment.completed_at && (
              <div>
                <p className="text-gray-500 text-sm">Completed</p>
                <p className="font-medium">{formatDate(assignment.completed_at)}</p>
              </div>
            )}
          </div>
          
          {/* Additional Notes */}
          <div className="mb-4">
            <h4 className="font-medium text-gray-700 mb-1">Notes</h4>
            <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded-md">
              {assignment.notes || "No additional notes for this assignment."}
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="p-4 border-t border-gray-200 bg-white sticky bottom-0">
          {assignment.status === AssignmentStatus.AVAILABLE && (
            <button 
              onClick={() => onAccept(assignment.id)} 
              className="w-full py-3 bg-green-500 text-white rounded-md flex items-center justify-center hover:bg-green-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Accept Assignment
            </button>
          )}
          
          {assignment.status === AssignmentStatus.ACCEPTED && (
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => onNavigate(assignment)}
                className="py-3 bg-blue-500 text-white rounded-md flex items-center justify-center hover:bg-blue-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Navigate
              </button>
              <button 
                onClick={() => onComplete(assignment.id)}
                className="py-3 bg-green-500 text-white rounded-md flex items-center justify-center hover:bg-green-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Complete
              </button>
            </div>
          )}
          
          {assignment.status === AssignmentStatus.COMPLETED && (
            <div>
              {assignment.hasDisposed ? (
                <button 
                  onClick={() => onViewReport(assignment.id)}
                  className="w-full py-3 bg-purple-500 text-white rounded-md flex items-center justify-center hover:bg-purple-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Report
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => onDumpingSite(assignment.id)}
                    className="py-3 bg-blue-500 text-white rounded-md flex items-center justify-center hover:bg-blue-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Dumping Site
                  </button>
                  <button 
                    onClick={() => onDispose(assignment.id)}
                    className="py-3 bg-green-500 text-white rounded-md flex items-center justify-center hover:bg-green-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Dispose
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentDetailsModal;
