import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.svg';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/supabase';
import { logger } from '../utils/logger';
import { SignoutConfirmationModal } from './SignoutConfirmationModal';

// Cache key for user profile in localStorage
const PROFILE_CACHE_KEY = 'trashdrop_user_profile';

/**
 * Top navigation bar component with logo and profile dropdown
 */
export const TopNavBar = ({ user }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSignoutModalOpen, setIsSignoutModalOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isDropdownOpen]);
  
  // Initialize from localStorage cache for instant display on refresh
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const cached = localStorage.getItem(PROFILE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Only use cache if it matches current user
        if (parsed.user_id === user?.id) {
          return { first_name: parsed.first_name, last_name: parsed.last_name };
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
    return null;
  });
  const { logout, loading } = useAuth();
  const navigate = useNavigate();

  // Fetch user profile to get first_name and last_name
  const hasAttemptedFetch = useRef(false);
  
  // Load from cache when user becomes available (handles timing issues on refresh)
  useEffect(() => {
    if (user?.id && !userProfile) {
      try {
        const cached = localStorage.getItem(PROFILE_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.user_id === user.id && parsed.first_name) {
            setUserProfile({ first_name: parsed.first_name, last_name: parsed.last_name });
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [user?.id, userProfile]);
  
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id || hasAttemptedFetch.current) return;
      hasAttemptedFetch.current = true;
      
      try {
        const { success, profile } = await authService.getUserProfile(user.id);
        if (success && profile) {
          const profileData = {
            first_name: profile.first_name,
            last_name: profile.last_name
          };
          setUserProfile(profileData);
          // Cache in localStorage for next refresh
          try {
            localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
              user_id: user.id,
              first_name: profile.first_name,
              last_name: profile.last_name
            }));
          } catch (e) {
            // Ignore storage errors
          }
        }
        // If no profile found (success=false), silently use defaults - user may not have completed signup
      } catch (err) {
        // Only log unexpected errors, not missing profile (PGRST116)
        if (!err?.code?.includes('PGRST116')) {
          logger.warn('Failed to fetch user profile for NavBar:', err);
        }
      }
    };
    
    fetchProfile();
  }, [user?.id]);

  return (
    <>
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/map" className="flex items-center">
                <img src={logo} alt="TrashDrop" className="h-8 w-auto" />
              </Link>
            </div>
            
            <div className="flex items-center">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium">
                    {userProfile?.first_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </button>
                
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-gray-700 border-b">
                        <div className="font-medium">
                          {userProfile?.first_name || 'User'} {userProfile?.last_name || ''}
                        </div>
                        <div className="text-gray-500 truncate">
                          {user?.phone || user?.email || 'No contact info'}
                        </div>
                      </div>
                      <Link
                        to="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Profile
                      </Link>
                      <Link
                        to="/earnings"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Earnings
                      </Link>
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          setIsSignoutModalOpen(true);
                        }}
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Signout Confirmation Modal */}
      <SignoutConfirmationModal
        isOpen={isSignoutModalOpen}
        onClose={() => setIsSignoutModalOpen(false)}
        onConfirmSignout={async () => {
          logger.info('👋 User confirmed signout from modal...');
          const result = await logout();
          
          if (result.success) {
            logger.info('✅ Signout successful, navigating to login page...');
            navigate('/login');
          }
          
          return result;
        }}
        isLoading={loading}
      />
    </>
  );
};
