import React, { useState, useEffect } from 'react';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import { AssignmentStatus } from '../utils/types';
import AssignmentDetailsModal from '../components/AssignmentDetailsModal';
import CompletionModal from '../components/CompletionModal';
import DisposalModal from '../components/DisposalModal';
import ReportModal from '../components/ReportModal';

const AssignmentCard = ({ assignment, onAccept, onComplete, onViewMore, onDumpingSite, onDispose, onViewReport }) => {
  const [expanded, setExpanded] = useState(false);
  
  const getStatusRibbonColor = (status) => {
    switch (status) {
      case AssignmentStatus.AVAILABLE:
        return 'bg-blue-500';
      case AssignmentStatus.ACCEPTED:
        return 'bg-amber-500';
      case AssignmentStatus.COMPLETED:
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case AssignmentStatus.AVAILABLE:
        return 'Available';
      case AssignmentStatus.ACCEPTED:
        return 'Accepted';
      case AssignmentStatus.COMPLETED:
        return 'Completed';
      default:
        return status;
    }
  };

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
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md mb-4 overflow-hidden relative">
      {/* Status Corner Ribbon */}
      <div className={`absolute top-0 right-0 w-20 h-20 overflow-hidden`}>
        <div className={`${getStatusRibbonColor(assignment.status)} text-white font-semibold py-1 text-center text-xs rotate-45 origin-bottom-right absolute top-0 right-0 w-28`}>
          {getStatusText(assignment.status)}
        </div>
      </div>
      
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-lg">{assignment.type} Assignment</h3>
            <p className="text-sm text-gray-600">{assignment.location}</p>
          </div>
          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full font-medium">#{assignment.id}</span>
        </div>
        
        {/* Main Info */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {assignment.estimated_time}
          </span>
          
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {assignment.distance}
          </span>
          
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ₵{assignment.payment}
          </span>
          
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getPriorityBadgeColor(assignment.priority)} border`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {assignment.priority.charAt(0).toUpperCase() + assignment.priority.slice(1)} Priority
          </span>
        </div>
        
        {/* Expandable Details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-500">Authority</p>
                <p className="font-medium">{assignment.authority}</p>
              </div>
              <div>
                <p className="text-gray-500">Created</p>
                <p className="font-medium">{formatDate(assignment.created_at)}</p>
              </div>
              {assignment.accepted_at && (
                <div>
                  <p className="text-gray-500">Accepted</p>
                  <p className="font-medium">{formatDate(assignment.accepted_at)}</p>
                </div>
              )}
              {assignment.completed_at && (
                <div>
                  <p className="text-gray-500">Completed</p>
                  <p className="font-medium">{formatDate(assignment.completed_at)}</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="flex flex-col mt-3 pt-3 border-t border-gray-100">
          {/* View More/Less Button */}
          <div className="mb-3">
            <button 
              onClick={(e) => {
                e.preventDefault();
                if (onViewMore) {
                  onViewMore(assignment);
                } else {
                  setExpanded(!expanded);
                }
              }} 
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
            >
              {expanded ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  View Less
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  View More
                </>
              )}
            </button>
          </div>
          
          {/* Action Buttons */}
          <div className="w-full">
            {assignment.status === AssignmentStatus.AVAILABLE && (
              <button 
                onClick={() => onAccept(assignment.id)} 
                className="w-full py-3 bg-green-500 text-white rounded-md flex items-center justify-center hover:bg-green-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Accept
              </button>
            )}
            
            {assignment.status === AssignmentStatus.ACCEPTED && (
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <button 
                    onClick={() => {
                      // Open Google Maps with the location
                      const location = encodeURIComponent(assignment.location);
                      window.open(`https://www.google.com/maps/search/?api=1&query=${location}`, '_blank');
                    }}
                    className="py-3 bg-indigo-500 text-white rounded-md flex items-center justify-center hover:bg-indigo-600 transition-colors w-full"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Navigate
                  </button>
                </div>
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
              assignment.hasDisposed ? (
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
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => onDumpingSite(assignment.id)}
                    className="py-3 bg-blue-500 text-white rounded-md flex items-center justify-center hover:bg-blue-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Dumping Site
                  </button>
                  <button 
                    onClick={() => onDispose(assignment.id)}
                    className="py-3 bg-green-500 text-white rounded-md flex items-center justify-center hover:bg-green-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Dispose
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AssignPage = () => {
  const [activeTab, setActiveTab] = useState('available');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date().toISOString());
  
  // Modal states
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [disposalModalOpen, setDisposalModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  const [assignments, setAssignments] = useState({
    available: [
      {
        id: 'A001',
        type: 'Street Cleaning',
        location: '123 Main St, Accra',
        distance: '1.7 km',
        payment: 30,
        estimated_time: '45 mins',
        priority: 'high',
        authority: 'Accra City Council',
        status: AssignmentStatus.AVAILABLE,
        created_at: '2025-07-14T12:30:00Z'
      },
      {
        id: 'A002',
        type: 'Bin Collection',
        location: '456 Beach Rd, Accra',
        distance: '0.9 km',
        payment: 25,
        estimated_time: '30 mins',
        priority: 'medium',
        authority: 'Waste Management Dept',
        status: AssignmentStatus.AVAILABLE,
        created_at: '2025-07-14T11:45:00Z'
      }
    ],
    accepted: [
      {
        id: 'A003',
        type: 'Waste Sorting',
        location: '789 Market Ave, Accra',
        distance: '2.3 km',
        payment: 40,
        estimated_time: '1 hour',
        priority: 'medium',
        authority: 'Recycling Center',
        status: AssignmentStatus.ACCEPTED,
        created_at: '2025-07-14T10:15:00Z'
      }
    ],
    completed: [
      {
        id: 'A004',
        type: 'Roadside Cleanup',
        location: '321 Harbor St, Accra',
        distance: '1.5 km',
        payment: 35,
        estimated_time: '50 mins',
        priority: 'low',
        authority: 'Highway Authority',
        status: AssignmentStatus.COMPLETED,
        created_at: '2025-07-14T09:00:00Z'
      }
    ]
  });
  
  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };
  
  // Open assignment details modal
  const openDetailsModal = (assignment) => {
    setSelectedAssignment(assignment);
    setDetailsModalOpen(true);
  };
  
  // Check if user is within geofence (simulated)
  const isWithinGeofence = (assignmentId) => {
    // In a real app, this would use the device's GPS to check if the user is within 50m of the assignment location
    // For now, we'll simulate this with a random check that returns true 70% of the time
    return Math.random() > 0.3;
  };
  
  // Handle accept assignment
  const handleAccept = (assignmentId) => {
    const assignmentToAccept = assignments.available.find(assign => assign.id === assignmentId);
    if (assignmentToAccept) {
      const updatedAssignment = {
        ...assignmentToAccept,
        status: AssignmentStatus.ACCEPTED,
        accepted_at: new Date().toISOString()
      };
      
      setAssignments(prev => ({
        available: prev.available.filter(assign => assign.id !== assignmentId),
        accepted: [...prev.accepted, updatedAssignment],
        completed: prev.completed
      }));
      
      // Close modal if open
      setDetailsModalOpen(false);
      
      // Show success toast
      showToast('Assignment accepted successfully!');
    }
  };
  
  // Handle navigate to assignment
  const handleNavigate = (assignment) => {
    // In a real app, this would open Google Maps with directions to the assignment location
    alert(`Navigating to: ${assignment.location}`);
    
    // Close modal
    setDetailsModalOpen(false);
  };
  
  // Handle complete assignment
  const handleComplete = (assignmentId) => {
    // Check if user is within geofence
    if (!isWithinGeofence(assignmentId)) {
      showToast('You must be within 50m of the assignment location to complete it', 'error');
      return;
    }
    
    const assignmentToComplete = assignments.accepted.find(assign => assign.id === assignmentId);
    if (assignmentToComplete) {
      setSelectedAssignment(assignmentToComplete);
      setCompletionModalOpen(true);
      setDetailsModalOpen(false);
    }
  };
  
  // Handle completion submission
  const handleCompletionSubmit = (assignmentId, photos) => {
    const assignmentToComplete = assignments.accepted.find(assign => assign.id === assignmentId);
    if (assignmentToComplete) {
      const updatedAssignment = {
        ...assignmentToComplete,
        status: AssignmentStatus.COMPLETED,
        completed_at: new Date().toISOString(),
        photos: photos.length, // In a real app, we would upload the photos to a server
        hasDisposed: false
      };
      
      setAssignments(prev => ({
        available: prev.available,
        accepted: prev.accepted.filter(assign => assign.id !== assignmentId),
        completed: [...prev.completed, updatedAssignment]
      }));
      
      // Show success toast
      showToast('Assignment completed successfully!');
    }
  };
  
  // Handle dumping site
  const handleDumpingSite = (assignmentId) => {
    const assignmentToDispose = assignments.completed.find(assign => assign.id === assignmentId);
    if (assignmentToDispose) {
      setSelectedAssignment(assignmentToDispose);
      setDisposalModalOpen(true);
      setDetailsModalOpen(false);
    }
  };
  
  // Handle get directions to dumping site
  const handleGetDirections = (site) => {
    // In a real app, this would open Google Maps with directions to the dumping site
    alert(`Getting directions to: ${site.name} at ${site.address}`);
  };
  
  // Handle dispose
  const handleDispose = (assignmentId, site) => {
    // If site is not provided, we need to open the disposal modal instead
    if (!site) {
      handleDumpingSite(assignmentId);
      return;
    }
    
    const assignmentToDispose = assignments.completed.find(assign => assign.id === assignmentId);
    if (assignmentToDispose) {
      const updatedAssignment = {
        ...assignmentToDispose,
        hasDisposed: true,
        disposedAt: new Date().toISOString(),
        disposalSite: site.name
      };
      
      setAssignments(prev => ({
        available: prev.available,
        accepted: prev.accepted,
        completed: prev.completed.map(assign => 
          assign.id === assignmentId ? updatedAssignment : assign
        )
      }));
      
      // Show success toast
      showToast('Waste disposed successfully!');
    }
  };
  
  // Handle view report
  const handleViewReport = (assignmentId) => {
    const assignment = assignments.completed.find(assign => assign.id === assignmentId && assign.hasDisposed);
    
    if (assignment) {
      // Open the report modal with the selected assignment
      setSelectedAssignment(assignment);
      setReportModalOpen(true);
      
      // Close details modal if open
      setDetailsModalOpen(false);
    }
  };
  
  // Function to fetch assignments (simulated)
  const fetchAssignments = () => {
    setLoading(true);
    
    // Simulate API call with timeout
    setTimeout(() => {
      // Sort assignments according to requirements
      const sortedAssignments = {
        // Available tab: Sort by proximity (nearest first)
        available: [...assignments.available].sort((a, b) => {
          // Extract distance values (assuming format like "1.7 km")
          const distanceA = parseFloat(a.distance.split(' ')[0]);
          const distanceB = parseFloat(b.distance.split(' ')[0]);
          return distanceA - distanceB; // Ascending order (nearest first)
        }),
        
        // Accepted tab: Sort by timestamp (oldest first) and then by proximity
        accepted: [...assignments.accepted].sort((a, b) => {
          // First sort by timestamp (oldest first)
          const timeA = new Date(a.accepted_at || a.created_at).getTime();
          const timeB = new Date(b.accepted_at || b.created_at).getTime();
          
          if (timeA !== timeB) {
            return timeA - timeB; // Ascending order (oldest first)
          }
          
          // If timestamps are equal, sort by proximity
          const distanceA = parseFloat(a.distance.split(' ')[0]);
          const distanceB = parseFloat(b.distance.split(' ')[0]);
          return distanceA - distanceB; // Ascending order (nearest first)
        }),
        
        // Completed tab: Sort by completion time (newest first)
        completed: [...assignments.completed].sort((a, b) => {
          const timeA = new Date(a.completed_at || a.created_at).getTime();
          const timeB = new Date(b.completed_at || b.created_at).getTime();
          return timeB - timeA; // Descending order (newest first)
        })
      };
      
      setAssignments(sortedAssignments);
      setLoading(false);
      setLastUpdated(new Date().toISOString());
    }, 1500); // 1.5 second delay to show loading state
  };
  
  // Call fetchAssignments on initial load
  useEffect(() => {
    fetchAssignments();
  }, []);

  return (
    <div className="app-container bg-gray-100 min-h-screen flex flex-col">
      <TopNavBar />
      
      {/* Fixed Header Section */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md pt-16 pb-0">
        {/* Page Header */}
        <div className="px-4 pb-2">
          <h1 className="text-3xl font-bold text-black">Assignments</h1>
        </div>
        
        {/* Tab Navigation - Fixed */}
        <div className="flex border-b bg-white text-black">
          <button
            className={`flex-1 py-3 text-center font-medium ${activeTab === 'available' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-600'}`}
            onClick={() => setActiveTab('available')}
          >
            Available
          </button>
          <button
            className={`flex-1 py-3 text-center font-medium ${activeTab === 'accepted' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-600'}`}
            onClick={() => setActiveTab('accepted')}
          >
            Accepted
          </button>
          <button
            className={`flex-1 py-3 text-center font-medium ${activeTab === 'completed' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-600'}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed
          </button>
        </div>
        
        {/* Last Updated Info */}
        {lastUpdated && (
          <div className="text-xs text-gray-500 text-center py-2 bg-white">
            Last updated: {new Date(lastUpdated).toLocaleString()}
            <button 
              onClick={fetchAssignments} 
              className="ml-2 text-green-600"
              disabled={loading}
            >
              ↻
            </button>
          </div>
        )}
      </div>
      
      {/* Scrollable Content Area with padding to account for fixed header */}
      <main className="flex-1 overflow-y-auto pt-40 pb-20 px-4">
        
        {/* Assignment Cards */}
        <div className="assignments-container">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="animate-spin h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full"></div>
                  <div className="animate-ping absolute inset-0 h-12 w-12 rounded-full border-2 border-green-400 opacity-30"></div>
                </div>
                <span className="text-gray-600 mt-4 font-medium">Loading assignments...</span>
                <div className="mt-2 text-xs text-gray-500">Fetching latest data</div>
              </div>
            </div>
          ) : activeTab === 'available' && assignments.available.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No available assignments at the moment.</p>
            </div>
          ) : activeTab === 'accepted' && assignments.accepted.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">You haven't accepted any assignments yet.</p>
            </div>
          ) : activeTab === 'completed' && assignments.completed.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">You haven't completed any assignments yet.</p>
            </div>
          ) : (
            <>
              {activeTab === 'available' && (
                <div>
                  {assignments.available.map(assignment => (
                    <AssignmentCard 
                      key={assignment.id} 
                      assignment={assignment} 
                      onAccept={handleAccept}
                      onComplete={handleComplete}
                      onViewMore={openDetailsModal}
                      onDumpingSite={handleDumpingSite}
                      onDispose={handleDispose}
                      onViewReport={handleViewReport}
                    />
                  ))}
                </div>
              )}
              
              {activeTab === 'accepted' && (
                <div>
                  {assignments.accepted.map(assignment => (
                    <AssignmentCard 
                      key={assignment.id} 
                      assignment={assignment}
                      onAccept={handleAccept}
                      onComplete={handleComplete}
                      onViewMore={openDetailsModal}
                      onDumpingSite={handleDumpingSite}
                      onDispose={handleDispose}
                      onViewReport={handleViewReport}
                    />
                  ))}
                </div>
              )}
              
              {activeTab === 'completed' && (
                <div>
                  {assignments.completed.map(assignment => (
                    <AssignmentCard 
                      key={assignment.id} 
                      assignment={assignment}
                      onAccept={handleAccept}
                      onComplete={handleComplete}
                      onViewMore={openDetailsModal}
                      onDumpingSite={handleDumpingSite}
                      onDispose={handleDispose}
                      onViewReport={handleViewReport}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      
      <BottomNavBar activeTab="assign" />
      
      {/* Modals */}
      <AssignmentDetailsModal
        assignment={selectedAssignment}
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        onAccept={handleAccept}
        onNavigate={handleNavigate}
        onComplete={handleComplete}
        onDumpingSite={handleDumpingSite}
        onDispose={handleDispose}
        onViewReport={handleViewReport}
        tabContext={activeTab} // Pass the active tab context
      />
      
      <CompletionModal
        assignment={selectedAssignment}
        isOpen={completionModalOpen}
        onClose={() => setCompletionModalOpen(false)}
        onSubmit={handleCompletionSubmit}
      />
      
      <DisposalModal
        assignment={selectedAssignment}
        isOpen={disposalModalOpen}
        onClose={() => setDisposalModalOpen(false)}
        onDispose={handleDispose}
        onGetDirections={handleGetDirections}
      />
      
      <ReportModal
        assignment={selectedAssignment}
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />
      
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-md shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default AssignPage;
