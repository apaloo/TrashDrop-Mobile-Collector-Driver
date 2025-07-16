import { useState } from 'react';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import { AssignmentStatus } from '../utils/types';

const AssignmentCard = ({ assignment, onAccept, onComplete }) => {
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
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
          <button 
            onClick={() => setExpanded(!expanded)} 
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
              <div className="grid grid-cols-2 gap-2">
                <button 
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
          </div>
        </div>
      </div>
    </div>
  );
};

const AssignPage = () => {
  const [activeTab, setActiveTab] = useState('available');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date().toISOString());
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
        created_at: '2025-07-14T09:00:00Z',
        completed_at: '2025-07-14T10:00:00Z'
      }
    ]
  });

  const handleAccept = (assignmentId) => {
    const assignmentToAccept = assignments.available.find(assign => assign.id === assignmentId);
    
    if (assignmentToAccept) {
      const updatedAssignment = {
        ...assignmentToAccept,
        status: AssignmentStatus.ACCEPTED,
        accepted_at: new Date().toISOString()
      };
      
      const newAvailable = assignments.available.filter(assign => assign.id !== assignmentId);
      const newAccepted = [...assignments.accepted, updatedAssignment];
      
      setAssignments({
        ...assignments,
        available: newAvailable,
        accepted: newAccepted
      });
    }
  };

  const handleComplete = (assignmentId) => {
    const assignmentToComplete = assignments.accepted.find(assign => assign.id === assignmentId);
    
    if (assignmentToComplete) {
      const updatedAssignment = {
        ...assignmentToComplete,
        status: AssignmentStatus.COMPLETED,
        completed_at: new Date().toISOString()
      };
      
      const newAccepted = assignments.accepted.filter(assign => assign.id !== assignmentId);
      const newCompleted = [...assignments.completed, updatedAssignment];
      
      setAssignments({
        ...assignments,
        accepted: newAccepted,
        completed: newCompleted
      });
    }
  };
  
  // Function to fetch assignments (simulated)
  const fetchAssignments = () => {
    setIsLoading(true);
    
    // Simulate API call with timeout
    setTimeout(() => {
      // Update last updated timestamp
      setLastUpdated(new Date().toISOString());
      setIsLoading(false);
    }, 1500); // 1.5 second delay to show loading state
  };

  return (
    <div className="app-container bg-gray-100 min-h-screen">
      <TopNavBar />
      
      <main className="main-content p-4 pt-16 pb-20">
        {/* Tab Navigation */}
        <div className="flex border-b mb-4">
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
          <div className="text-xs text-gray-500 text-center mb-4">
            Last updated: {new Date(lastUpdated).toLocaleString()}
            <button 
              onClick={fetchAssignments} 
              className="ml-2 text-green-600"
              disabled={isLoading}
            >
              ↻
            </button>
          </div>
        )}
        
        {/* Assignment Cards */}
        <div className="assignments-container">
          {isLoading ? (
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
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      
      <BottomNavBar activeTab="assign" />
    </div>
  );
};

export default AssignPage;
