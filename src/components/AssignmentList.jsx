import React, { useState, useEffect } from 'react';
import { calculateDistance } from '../utils/locationUtils';
import { slideIn } from '../utils/animationUtils';

/**
 * Component to display a list of assignments with sorting and filtering options
 */
const AssignmentList = ({ assignments, userLocation }) => {
  const [filteredAssignments, setFilteredAssignments] = useState([]);
  const [sortOption, setSortOption] = useState('distance');
  const [filterStatus, setFilterStatus] = useState('accepted');
  
  // Process assignments when data changes
  useEffect(() => {
    if (!assignments || assignments.length === 0) {
      setFilteredAssignments([]);
      return;
    }
    
    // Filter assignments by status
    let filtered = assignments;
    if (filterStatus !== 'all') {
      filtered = assignments.filter(assignment => assignment.status === filterStatus);
    }
    
    // Calculate distance for each assignment if user location is available
    if (userLocation) {
      filtered = filtered.map(assignment => {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          assignment.latitude,
          assignment.longitude
        );
        
        return {
          ...assignment,
          distance
        };
      });
    }
    
    // Sort assignments based on selected option
    switch (sortOption) {
      case 'distance':
        filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0));
        break;
      case 'name':
        filtered.sort((a, b) => a.customer_name.localeCompare(b.customer_name));
        break;
      case 'location':
        filtered.sort((a, b) => a.location.localeCompare(b.location));
        break;
      default:
        // Default to distance sorting
        filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
    
    setFilteredAssignments(filtered);
    
    // Apply slide-in animation to list items
    setTimeout(() => {
      const listItems = document.querySelectorAll('.assignment-list-item');
      listItems.forEach((item, index) => {
        setTimeout(() => {
          slideIn(item, 'bottom', 20, 300);
        }, index * 100);
      });
    }, 100);
  }, [assignments, userLocation, sortOption, filterStatus]);
  
  // Handle sort change
  const handleSortChange = (e) => {
    setSortOption(e.target.value);
  };
  
  // Handle filter change
  const handleFilterChange = (e) => {
    setFilterStatus(e.target.value);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Assignments</h2>
          <span className="text-sm text-gray-600">{filteredAssignments.length} items</span>
        </div>
        
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="flex-1 min-w-[120px]">
            <label htmlFor="sort" className="block text-xs text-gray-600 mb-1">Sort By</label>
            <select
              id="sort"
              value={sortOption}
              onChange={handleSortChange}
              className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="distance">Distance</option>
              <option value="name">Customer Name</option>
              <option value="location">Location</option>
            </select>
          </div>
          
          <div className="flex-1 min-w-[120px]">
            <label htmlFor="filter" className="block text-xs text-gray-600 mb-1">Status</label>
            <select
              id="filter"
              value={filterStatus}
              onChange={handleFilterChange}
              className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="accepted">Accepted</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="overflow-hidden">
        {filteredAssignments.length === 0 ? (
          <div className="text-center text-gray-600 py-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="mt-2">No assignments found</p>
            <p className="text-sm mt-1">Try changing your filter options</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredAssignments.map((assignment) => (
              <li 
                key={assignment.id} 
                className="assignment-list-item opacity-0 hidden"
              >
                <div className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-800">{assignment.customer_name}</h3>
                      <p className="text-xs text-gray-600 mt-1">{assignment.location}</p>
                    </div>
                    
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        assignment.status === 'available' ? 'bg-blue-100 text-blue-800' :
                        assignment.status === 'accepted' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                      </span>
                      
                      {assignment.distance !== undefined && (
                        <p className="text-xs text-gray-600 mt-1">
                          {assignment.distance.toFixed(1)} km away
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-2 flex justify-end space-x-2">
                    <button
                      className="text-xs bg-white border border-gray-300 rounded px-2 py-1 hover:bg-gray-50 text-gray-700"
                      onClick={() => {
                        // In a real app, this would navigate to the assignment details
                        console.log('View details for assignment:', assignment.id);
                      }}
                    >
                      Details
                    </button>
                    
                    <button
                      className="text-xs bg-green-500 rounded px-2 py-1 hover:bg-green-600 text-white"
                      onClick={() => {
                        // In a real app, this would navigate to the assignment location
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${assignment.latitude},${assignment.longitude}`;
                        window.open(url, '_blank');
                      }}
                    >
                      Navigate
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AssignmentList;
