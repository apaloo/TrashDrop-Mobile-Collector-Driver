import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import { AssignmentStatus } from '../utils/types';
import AssignmentDetailsModal from '../components/AssignmentDetailsModal';
import CompletionModal from '../components/CompletionModal';
import DisposalModal from '../components/DisposalModal';
import ReportModal from '../components/ReportModal';
import AssignmentNavigationModal from '../components/AssignmentNavigationModal';
import { supabase, authService } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';
import { getCurrentLocation, calculateDistance } from '../utils/geoUtils';

const AssignmentCard = ({ assignment, onAccept, onComplete, onViewMore, onNavigate, onDumpingSite, onDispose, onViewReport }) => {
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
            <h3 className="font-semibold text-base text-gray-800 capitalize">{assignment.type} Assignment</h3>
            <p className="text-sm text-gray-600">{assignment.location}</p>
          </div>
          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full font-medium">#{assignment.id}</span>
        </div>
        
        {/* Main Info */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            {assignment.size || 'N/A'}
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
                    onClick={() => onNavigate(assignment)}
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
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('available');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date().toISOString());
  
  // Modal states
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [disposalModalOpen, setDisposalModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [navigationModalOpen, setNavigationModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  const [assignments, setAssignments] = useState({
    available: [],
    accepted: [],
    completed: []
  });
  const [fetchError, setFetchError] = useState(null);
  
  // Track assignments that have had arrival confirmed via navigation modal
  // This is used as a fallback in geofence check since navigation uses accurate GPS
  const [confirmedArrivals, setConfirmedArrivals] = useState(new Set());

  // Fetch assignments from Supabase
  // Uses collector_assignments_view which maps illegal_dumping_mobile table
  // to the assignment format expected by this app
  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      
      if (!user?.id) {
        logger.warn('⚠️ No user ID available, cannot fetch assignments');
        setLoading(false);
        return;
      }
      
      logger.debug('📥 Fetching assignments for collector:', user.id);
      
      // Fetch from collector_assignments_view (maps illegal_dumping_mobile)
      // - Available: Reports assigned to me by admin with status 'verified' → mapped to 'available'
      // - Accepted: Reports I've accepted with status 'in_progress' → mapped to 'accepted'
      // - Completed: Reports I've completed with status 'completed'
      // Note: Only reports with assigned_to IS NOT NULL are shown (admin must assign first)
      const { data, error } = await supabase
        .from('collector_assignments_view')
        .select('*')
        .eq('collector_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching assignments:', error);
        setFetchError('Failed to load assignments. Please try again.');
        return;
      }

      // Transform data to match expected format
      // Data comes from collector_assignments_view which already maps most fields
      const transformedAssignments = data.map(assignment => ({
        id: assignment.id,
        type: assignment.type,
        location: assignment.location,
        distance: assignment.distance || 'Calculate',
        payment: parseFloat(assignment.payment || 0),
        estimated_time: assignment.estimated_time || 'Unknown',
        priority: assignment.priority,
        authority: assignment.authority || 'Community Report',
        status: assignment.status === 'available' ? AssignmentStatus.AVAILABLE :
                assignment.status === 'accepted' ? AssignmentStatus.ACCEPTED :
                assignment.status === 'completed' ? AssignmentStatus.COMPLETED :
                AssignmentStatus.AVAILABLE,
        created_at: assignment.created_at,
        // Build coordinates from latitude/longitude
        coordinates: assignment.latitude && assignment.longitude 
          ? [parseFloat(assignment.latitude), parseFloat(assignment.longitude)]
          : null,
        accepted_at: assignment.status === 'accepted' ? assignment.updated_at : null,
        completed_at: assignment.status === 'completed' ? assignment.updated_at : null,
        collector_id: assignment.collector_id,
        // Profile ID for database updates (assigned_to stores profile id, not user id)
        collector_profile_id: assignment.collector_profile_id,
        // Additional fields from illegal_dumping_mobile
        size: assignment.size,
        photos: assignment.photos,
        reported_by: assignment.reported_by,
        original_status: assignment.original_status
      }));

      // Deduplicate assignments by ID (keep most recent based on updated_at or created_at)
      const uniqueAssignmentsMap = new Map();
      transformedAssignments.forEach(assignment => {
        const existing = uniqueAssignmentsMap.get(assignment.id);
        if (!existing || new Date(assignment.created_at) > new Date(existing.created_at)) {
          uniqueAssignmentsMap.set(assignment.id, assignment);
        }
      });
      const uniqueAssignments = Array.from(uniqueAssignmentsMap.values());

      // Log if duplicates were found
      if (uniqueAssignments.length < transformedAssignments.length) {
        logger.warn('⚠️ Removed duplicate assignments:', {
          original: transformedAssignments.length,
          unique: uniqueAssignments.length,
          duplicates: transformedAssignments.length - uniqueAssignments.length
        });
      }

      // Group assignments by status:
      // ALL assignments here are already filtered to THIS collector (collector_id = user.id)
      // - Available: Assignments assigned to me by admin but not yet accepted by me
      // - Accepted: Assignments I have accepted to work on
      // - Completed: Assignments I have completed
      const groupedAssignments = {
        available: uniqueAssignments.filter(a => a.status === AssignmentStatus.AVAILABLE),
        accepted: uniqueAssignments.filter(a => a.status === AssignmentStatus.ACCEPTED),
        completed: uniqueAssignments.filter(a => a.status === AssignmentStatus.COMPLETED)
      };

      setAssignments(groupedAssignments);
      setLastUpdated(new Date().toISOString());
      
      logger.debug('📊 Assignments loaded for collector', user.id, ':', {
        available: groupedAssignments.available.length,
        accepted: groupedAssignments.accepted.length,
        completed: groupedAssignments.completed.length,
        total: uniqueAssignments.length
      });
      
    } catch (error) {
      logger.error('Unexpected error fetching assignments:', error);
      setFetchError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      
      try {
        const { success, profile } = await authService.getUserProfile(user.id);
        if (success && profile) {
          setUserProfile({
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone
          });
        }
      } catch (err) {
        logger.error('Error loading user profile for nav:', err);
      }
    };
    
    fetchUserProfile();
  }, [user]);
  
  // Load assignments when component mounts or when user changes
  useEffect(() => {
    if (user?.id) {
      fetchAssignments();
    }
  }, [user?.id]);
  
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
  
  // User location state for geofence checking
  const [userLocation, setUserLocation] = useState(null);
  const locationUpdateRef = useRef(null);

  // Update user location periodically
  useEffect(() => {
    const updateUserLocation = async () => {
      try {
        const location = await getCurrentLocation();
        if (location && !location.isFallback) {
          setUserLocation(location);
          logger.debug('📍 User location updated:', location.lat, location.lng);
        }
      } catch (error) {
        logger.warn('Failed to get user location:', error);
      }
    };

    // Initial location update
    updateUserLocation();

    // Update location every 10 seconds
    locationUpdateRef.current = setInterval(updateUserLocation, 10000);

    return () => {
      if (locationUpdateRef.current) {
        clearInterval(locationUpdateRef.current);
      }
    };
  }, []);

  // Parse assignment coordinates from various formats
  const parseAssignmentCoordinates = useCallback((assignment) => {
    if (!assignment) return null;

    // Try coordinates field first (may be array, object, or string)
    if (assignment.coordinates) {
      const coords = assignment.coordinates;
      
      // Array format [lat, lng]
      if (Array.isArray(coords) && coords.length >= 2) {
        return { lat: coords[0], lng: coords[1] };
      }
      
      // Object format {lat, lng}
      if (typeof coords === 'object' && coords.lat !== undefined) {
        return { lat: coords.lat, lng: coords.lng || coords.lon };
      }
      
      // String format "lat,lng" or PostGIS POINT format
      if (typeof coords === 'string') {
        // PostGIS POINT format: "POINT(lng lat)"
        const pointMatch = coords.match(/POINT\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)/i);
        if (pointMatch) {
          return { lat: parseFloat(pointMatch[2]), lng: parseFloat(pointMatch[1]) };
        }
        
        // PostGIS binary format - cannot parse
        if (coords.startsWith('0101000020')) {
          logger.warn('⚠️ PostGIS binary format detected - cannot verify location');
          return null;
        }
        
        // Simple "lat,lng" format
        const parts = coords.split(',').map(c => parseFloat(c.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return { lat: parts[0], lng: parts[1] };
        }
      }
    }

    // Try latitude/longitude fields
    if (assignment.latitude !== undefined && assignment.longitude !== undefined) {
      return { lat: assignment.latitude, lng: assignment.longitude };
    }

    // Try lat/lng fields
    if (assignment.lat !== undefined && assignment.lng !== undefined) {
      return { lat: assignment.lat, lng: assignment.lng };
    }

    return null;
  }, []);

  // Check if user is within 50m geofence of assignment location
  const isWithinGeofence = useCallback((assignmentId) => {
    // FIRST: Check if arrival was already confirmed via navigation modal
    // The navigation modal uses accurate real-time GPS and is more reliable
    if (confirmedArrivals.has(assignmentId)) {
      logger.info(`✅ Geofence bypassed - arrival already confirmed via navigation for ${assignmentId}`);
      return true;
    }
    
    // Find the assignment
    const assignment = assignments.accepted.find(a => a.id === assignmentId);
    if (!assignment) {
      logger.warn('Assignment not found for geofence check:', assignmentId);
      return false;
    }

    // Check if we have user location
    if (!userLocation) {
      logger.warn('⚠️ Cannot verify location - GPS unavailable');
      showToast('Please enable GPS to verify your location', 'warning');
      return false;
    }

    // DEBUG: Log raw assignment data with exact values
    logger.info('🔍 DEBUG Geofence - Assignment:', {
      id: assignment.id,
      coordinates: assignment.coordinates,
      coordsType: typeof assignment.coordinates,
      coordsIsArray: Array.isArray(assignment.coordinates),
      coordsValues: Array.isArray(assignment.coordinates) ? `[${assignment.coordinates[0]}, ${assignment.coordinates[1]}]` : 'not array'
    });
    logger.info('🔍 DEBUG Geofence - User location:', {
      lat: userLocation?.lat,
      lng: userLocation?.lng,
      raw: userLocation
    });

    // Parse assignment coordinates
    const assignmentCoords = parseAssignmentCoordinates(assignment);
    logger.info('🔍 DEBUG Geofence - Parsed coords:', assignmentCoords);
    
    if (!assignmentCoords) {
      logger.warn('⚠️ Cannot parse assignment coordinates:', assignment.coordinates);
      // Allow completion if we can't parse coordinates (legacy data)
      showToast('Location verification unavailable - proceeding with manual verification', 'warning');
      return true;
    }

    // Calculate distance in km
    const distance = calculateDistance(userLocation, assignmentCoords);
    const distanceMeters = Math.round(distance * 1000);
    
    logger.info(`📍 Distance to assignment: ${distanceMeters}m (geofence: 50m)`);

    // Check if within 50m (0.05km)
    const isWithin = distance <= 0.05;
    
    if (!isWithin) {
      logger.info(`❌ User is ${distanceMeters}m away - outside 50m geofence`);
    } else {
      logger.info(`✅ User is within geofence (${distanceMeters}m)`);
    }

    return isWithin;
  }, [assignments.accepted, userLocation, parseAssignmentCoordinates, confirmedArrivals]);
  
  // Handle accept assignment
  const handleAccept = async (assignmentId) => {
    try {
      const assignmentToAccept = assignments.available.find(assign => assign.id === assignmentId);
      if (!assignmentToAccept) {
        showToast('Assignment not found', 'error');
        return;
      }
      
      if (!user?.id) {
        showToast('User not authenticated', 'error');
        return;
      }

      logger.info('✅ Accepting assignment', assignmentId, 'for collector:', user.id);

      // Update in Supabase - Change status from 'verified' to 'in_progress'
      // Write directly to illegal_dumping_mobile table (not the view)
      // Note: assigned_to stores collector_profile_id (not user_id)
      // We use collector_profile_id from the assignment object for the update
      const { error } = await supabase
        .from('illegal_dumping_mobile')
        .update({ 
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId)
        .eq('assigned_to', assignmentToAccept.collector_profile_id)
        .eq('status', 'verified');

      if (error) {
        logger.error('Error accepting assignment:', error);
        showToast('Failed to accept assignment. Please try again.', 'error');
        // Refresh assignments to get latest state
        fetchAssignments();
        return;
      }

      // Update local state - collector_id remains unchanged (already set by admin)
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
      showToast('✅ Assignment accepted and assigned to you!');
      
    } catch (error) {
      logger.error('Unexpected error accepting assignment:', error);
      showToast('An unexpected error occurred. Please try again.', 'error');
    }
  };
  
  // Handle navigate to assignment - Open in-app navigation modal
  const handleNavigate = (assignment) => {
    logger.debug('🗺️ Opening in-app navigation for assignment:', assignment?.id);
    logger.debug('📍 Assignment coordinates data:', assignment?.coordinates);
    
    setSelectedAssignment(assignment);
    setNavigationModalOpen(true);
    setDetailsModalOpen(false); // Close details modal if open
  };
  
  // Handle assignment arrival (called when navigation modal confirms user is within 50m)
  const handleAssignmentArrival = async (assignmentId) => {
    try {
      logger.info(`✅ Assignment ${assignmentId} arrival confirmed via navigation modal`);
      
      // Mark this assignment as having confirmed arrival (for geofence fallback)
      setConfirmedArrivals(prev => new Set([...prev, assignmentId]));
      
      const assignmentToComplete = assignments.accepted.find(assign => assign.id === assignmentId);
      if (!assignmentToComplete) {
        showToast('Assignment not found', 'error');
        return;
      }

      // Update assignment status to completed in Supabase
      // Write directly to illegal_dumping_mobile table (not the view)
      const { error } = await supabase
        .from('illegal_dumping_mobile')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (error) {
        logger.error('Error auto-completing assignment:', error);
        showToast('Failed to complete assignment. Please try again.', 'error');
        return;
      }

      // Update local state
      const updatedAssignment = {
        ...assignmentToComplete,
        status: AssignmentStatus.COMPLETED,
        completed_at: new Date().toISOString(),
        hasDisposed: false
      };
      
      setAssignments(prev => ({
        available: prev.available,
        accepted: prev.accepted.filter(assign => assign.id !== assignmentId),
        completed: [...prev.completed, updatedAssignment]
      }));
      
      // Switch to completed tab to show the result
      setActiveTab('completed');
      
      // Show success toast
      showToast('🎉 Assignment completed successfully!');
      
    } catch (error) {
      logger.error('Unexpected error auto-completing assignment:', error);
      showToast('An unexpected error occurred. Please try again.', 'error');
    }
  };
  
  // Legacy Google Maps navigation (keeping for fallback)
  const handleLegacyNavigate = (assignment) => {
    logger.debug('🗺️ Opening Google Maps navigation for assignment:', assignment?.id);
    logger.debug('📍 Assignment coordinates data:', assignment?.coordinates);
    
    let googleMapsUrl = '';
    let lat, lng;
    
    // Enhanced GPS coordinate parsing to handle multiple formats
    if (assignment && assignment.coordinates) {
      try {
        // Handle different coordinate formats
        if (Array.isArray(assignment.coordinates) && assignment.coordinates.length >= 2) {
          // Format: [lat, lng]
          lat = parseFloat(assignment.coordinates[0]);
          lng = parseFloat(assignment.coordinates[1]);
          logger.debug('📍 Parsed array coordinates:', { lat, lng });
        } 
        else if (typeof assignment.coordinates === 'object' && assignment.coordinates !== null && !Array.isArray(assignment.coordinates)) {
          // Format: {lat: x, lng: y} or {latitude: x, longitude: y}
          lat = parseFloat(assignment.coordinates.lat || assignment.coordinates.latitude);
          lng = parseFloat(assignment.coordinates.lng || assignment.coordinates.longitude);
          logger.debug('📍 Parsed object coordinates:', { lat, lng });
        } 
        else if (typeof assignment.coordinates === 'string') {
          // Handle PostGIS POINT format: "POINT(lng lat)"
          const pointMatch = assignment.coordinates.match(/POINT\(([+-]?\d+\.?\d*) ([+-]?\d+\.?\d*)\)/);
          if (pointMatch) {
            lng = parseFloat(pointMatch[1]);
            lat = parseFloat(pointMatch[2]);
            logger.debug('📍 Parsed PostGIS POINT coordinates:', { lat, lng });
          } else {
            // Try parsing as "lat,lng" string
            const coordParts = assignment.coordinates.split(',').map(c => c.trim());
            if (coordParts.length === 2) {
              lat = parseFloat(coordParts[0]);
              lng = parseFloat(coordParts[1]);
              logger.debug('📍 Parsed comma-separated coordinates:', { lat, lng });
            }
          }
        }
        
        // Validate GPS coordinates
        if (lat && lng && !isNaN(lat) && !isNaN(lng) && 
            lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
          logger.debug('✅ Using GPS coordinates for navigation:', googleMapsUrl);
        } else {
          logger.warn('⚠️ Invalid GPS coordinates, falling back to address search');
          logger.debug('❌ Invalid coordinates:', { lat, lng, assignment: assignment.coordinates });
          throw new Error('Invalid coordinates');
        }
      } catch (error) {
        logger.warn('⚠️ Error parsing GPS coordinates:', error);
        // Fallback to location string search
        googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(assignment.location || 'assignment location')}`;
        logger.debug('🔄 Using address search fallback:', googleMapsUrl);
      }
    } else {
      // No coordinates available, use location string
      googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(assignment.location || 'assignment location')}`;
      logger.debug('🔄 No coordinates found, using address search:', googleMapsUrl);
    }
    
    // Open Google Maps
    logger.debug('🚀 Opening Google Maps:', googleMapsUrl);
    window.open(googleMapsUrl, '_blank');
    
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
  const handleCompletionSubmit = async (submissionData) => {
    try {
      // Extract photos from submission data (CompletionModal passes { photos, locationVerified, userCoordinates })
      const { photos } = submissionData || {};
      const assignmentId = selectedAssignment?.id;
      
      if (!assignmentId) {
        showToast('No assignment selected', 'error');
        return false;
      }
      
      const assignmentToComplete = assignments.accepted.find(assign => assign.id === assignmentId);
      if (!assignmentToComplete) {
        showToast('Assignment not found', 'error');
        return false;
      }

      // Update in Supabase
      // Write directly to illegal_dumping_mobile table (not the view)
      const { error } = await supabase
        .from('illegal_dumping_mobile')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (error) {
        logger.error('Error completing assignment:', error);
        showToast('Failed to complete assignment. Please try again.', 'error');
        return false;
      }

      // Update local state
      const updatedAssignment = {
        ...assignmentToComplete,
        status: AssignmentStatus.COMPLETED,
        completed_at: new Date().toISOString(),
        photos: photos?.length || 0, // In a real app, we would upload the photos to a server
        hasDisposed: false
      };
      
      setAssignments(prev => ({
        available: prev.available,
        accepted: prev.accepted.filter(assign => assign.id !== assignmentId),
        completed: [...prev.completed, updatedAssignment]
      }));
      
      // Show success toast and close modal
      showToast('Assignment completed successfully!');
      setCompletionModalOpen(false);
      setSelectedAssignment(null);
      
      return true; // Signal success to CompletionModal
      
    } catch (error) {
      logger.error('Unexpected error completing assignment:', error);
      showToast('An unexpected error occurred. Please try again.', 'error');
      return false;
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
  
  // Handle get directions to dumping site with GPS coordinates
  const handleGetDirections = (site) => {
    logger.info('Opening directions for site:', site);
    
    let googleMapsUrl = '';
    
    // Parse GPS coordinates from disposal site
    if (site && site.coordinates) {
      let lat, lng;
      
      // Handle different coordinate formats
      if (Array.isArray(site.coordinates) && site.coordinates.length >= 2) {
        lat = site.coordinates[0];
        lng = site.coordinates[1];
      } else if (typeof site.coordinates === 'object' && site.coordinates !== null) {
        lat = site.coordinates.lat || site.coordinates.latitude;
        lng = site.coordinates.lng || site.coordinates.longitude;
      }
      
      logger.info('Parsed coordinates:', { lat, lng });
      
      // Use GPS coordinates if valid
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
        logger.info('Google Maps URL:', googleMapsUrl);
      } else {
        logger.warn('Invalid coordinates, using address fallback');
        // Fallback to address search
        googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address || site.name || 'disposal site')}`;
      }
    } else {
      logger.warn('No coordinates found, using address fallback');
      // Fallback to address search
      googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address || site.name || 'disposal site')}`;
    }
    
    // Open Google Maps
    logger.info('Opening URL:', googleMapsUrl);
    window.open(googleMapsUrl, '_blank');
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
  
  // Sorting function for assignments
  const sortAssignments = (assignmentsData) => {
    return {
      // Available tab: Sort by proximity (nearest first)
      available: [...assignmentsData.available].sort((a, b) => {
        // Extract distance values (assuming format like "1.7 km")
        const distanceA = parseFloat((a.distance || '0').split(' ')[0]);
        const distanceB = parseFloat((b.distance || '0').split(' ')[0]);
        return distanceA - distanceB; // Ascending order (nearest first)
      }),
      
      // Accepted tab: Sort by timestamp (oldest first) and then by proximity
      accepted: [...assignmentsData.accepted].sort((a, b) => {
        // First sort by timestamp (oldest first)
        const timeA = new Date(a.accepted_at || a.created_at).getTime();
        const timeB = new Date(b.accepted_at || b.created_at).getTime();
        
        if (timeA !== timeB) {
          return timeA - timeB; // Ascending order (oldest first)
        }
        
        // If timestamps are equal, sort by proximity
        const distanceA = parseFloat((a.distance || '0').split(' ')[0]);
        const distanceB = parseFloat((b.distance || '0').split(' ')[0]);
        return distanceA - distanceB; // Ascending order (nearest first)
      }),
      
      // Completed tab: Sort by completion time (newest first)
      completed: [...assignmentsData.completed].sort((a, b) => {
        const timeA = new Date(a.completed_at || a.created_at).getTime();
        const timeB = new Date(b.completed_at || a.created_at).getTime();
        return timeB - timeA; // Descending order (newest first)
      })
    };
  };

  return (
    <div className="app-container bg-gray-100 min-h-screen flex flex-col">
      <TopNavBar user={user} />
      
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
      <main className="flex-1 overflow-y-auto pt-40 pb-20 px-4" style={{paddingTop: '13rem'}}>
        
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
                      onNavigate={handleNavigate}
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
                      onNavigate={handleNavigate}
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
                      onNavigate={handleNavigate}
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
        isGeofenceVerified={true} // Geofence was already verified in handleComplete before opening modal
      />
      
      <DisposalModal
        assignment={selectedAssignment}
        isOpen={disposalModalOpen}
        onClose={() => setDisposalModalOpen(false)}
        onDispose={handleDispose}
        // onGetDirections is NOT provided - let DisposalModal handle in-app navigation internally
      />
      
      <ReportModal
        assignment={selectedAssignment}
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />
      
      {/* Assignment Navigation Modal */}
      <AssignmentNavigationModal
        isOpen={navigationModalOpen}
        onClose={() => setNavigationModalOpen(false)}
        destination={selectedAssignment?.coordinates}
        assignmentId={selectedAssignment?.id}
        assignmentTitle={selectedAssignment?.type}
        onArrival={handleAssignmentArrival}
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
