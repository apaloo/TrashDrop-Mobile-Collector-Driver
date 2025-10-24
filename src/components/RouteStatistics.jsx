import React, { useState, useEffect } from 'react';
import { 
  calculateNearestNeighborRoute, 
  calculateRouteDistance, 
  estimateRouteTime 
} from '../utils/routeOptimizationUtils';
import { logger } from '../utils/logger';

/**
 * Component to display route statistics and metrics
 * Now enhanced with real analytics data from Supabase
 */
const RouteStatistics = ({ assignments, userLocation, analyticsService }) => {
  const [stats, setStats] = useState({
    totalDistance: 0,
    estimatedTime: 0,
    assignmentCount: 0,
    fuelEstimate: 0,
    co2Savings: 0
  });
  
  const [performanceAnalytics, setPerformanceAnalytics] = useState(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  
  // Fetch performance analytics
  useEffect(() => {
    const fetchPerformanceAnalytics = async () => {
      if (!analyticsService) return;
      
      setIsLoadingAnalytics(true);
      try {
        const result = await analyticsService.getRoutePerformanceAnalytics('7d');
        if (result.success) {
          setPerformanceAnalytics(result.data);
        }
      } catch (error) {
        logger.error('Error fetching performance analytics:', error);
      } finally {
        setIsLoadingAnalytics(false);
      }
    };
    
    fetchPerformanceAnalytics();
  }, [analyticsService]);
  
  useEffect(() => {
    if (!assignments || assignments.length === 0 || !userLocation) {
      return;
    }
    
    // Filter only accepted assignments
    const acceptedAssignments = assignments.filter(assignment => 
      assignment.status === 'accepted'
    );
    
    if (acceptedAssignments.length === 0) {
      setStats({
        totalDistance: 0,
        estimatedTime: 0,
        assignmentCount: 0,
        fuelEstimate: 0,
        co2Savings: 0
      });
      return;
    }
    
    // Calculate optimized route
    const startPosition = {
      lat: userLocation.latitude,
      lng: userLocation.longitude
    };
    
    const route = calculateNearestNeighborRoute(acceptedAssignments, startPosition);
    const distance = calculateRouteDistance(route, startPosition);
    const time = estimateRouteTime(route, startPosition);
    
    // Calculate fuel estimate (assuming 10 km/L average)
    const fuelEstimate = distance / 10;
    
    // Calculate CO2 savings compared to non-optimized route
    // Assuming non-optimized is 20% longer and 2.3 kg CO2 per liter of fuel
    const nonOptimizedDistance = distance * 1.2;
    const co2Savings = ((nonOptimizedDistance - distance) / 10) * 2.3;
    
    setStats({
      totalDistance: distance,
      estimatedTime: time,
      assignmentCount: acceptedAssignments.length,
      fuelEstimate,
      co2Savings
    });
  }, [assignments, userLocation]);
  
  // Format time to hours and minutes
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins} min`;
    }
    
    return `${hours} hr ${mins} min`;
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-800">Route Statistics</h2>
      </div>
      
      <div className="p-4">
        {stats.assignmentCount === 0 ? (
          <div className="text-center text-gray-600 py-4">
            <p>No accepted requests to analyze.</p>
            <p className="text-sm mt-1">Accept requests to view route statistics.</p>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Total Distance</p>
                <p className="text-xl font-bold text-blue-800">{stats.totalDistance.toFixed(1)} km</p>
              </div>
              
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Estimated Time</p>
                <p className="text-xl font-bold text-green-800">{formatTime(stats.estimatedTime)}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 font-medium">Pickups</p>
                <p className="text-lg font-bold text-gray-800">{stats.assignmentCount}</p>
              </div>
              
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-xs text-yellow-600 font-medium">Est. Fuel</p>
                <p className="text-lg font-bold text-yellow-800">{stats.fuelEstimate.toFixed(1)} L</p>
              </div>
              
              <div className="bg-emerald-50 p-3 rounded-lg">
                <p className="text-xs text-emerald-600 font-medium">CO₂ Saved</p>
                <p className="text-lg font-bold text-emerald-800">{stats.co2Savings.toFixed(1)} kg</p>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Efficiency Insights</h3>
              <ul className="text-xs text-gray-600 space-y-1">
                <li className="flex items-start">
                  <svg className="h-4 w-4 text-green-500 mr-1 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Optimized route saves approximately {(stats.co2Savings / 2.3 * 10).toFixed(1)} km of driving</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-4 w-4 text-green-500 mr-1 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Average of {(stats.totalDistance / stats.assignmentCount).toFixed(1)} km between each pickup</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-4 w-4 text-green-500 mr-1 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Estimated {(stats.estimatedTime / stats.assignmentCount).toFixed(0)} minutes per pickup on average</span>
                </li>
                
                {/* Performance Analytics from last 7 days */}
                {performanceAnalytics && (
                  <>
                    <li className="flex items-start">
                      <svg className="h-4 w-4 text-blue-500 mr-1 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Last 7 days: {performanceAnalytics.totalPickups} completed pickups, ₵{performanceAnalytics.totalEarnings.toFixed(2)} earned</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-4 w-4 text-purple-500 mr-1 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Your efficiency: {performanceAnalytics.timeEfficiency.toFixed(1)} pickups/hour, {performanceAnalytics.fuelEfficiency.toFixed(1)} km/L fuel</span>
                    </li>
                  </>
                )}
                
                {isLoadingAnalytics && (
                  <li className="flex items-start">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600 mr-1 mt-0.5"></div>
                    <span>Loading performance data...</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteStatistics;
