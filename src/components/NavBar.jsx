import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.svg';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/supabase';
import { logger } from '../utils/logger';

// Cache key for user profile in localStorage
const PROFILE_CACHE_KEY = 'trashdrop_user_profile';

/**
 * Top navigation bar component with logo and profile dropdown
 */
export const TopNavBar = ({ user }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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
  const { logout } = useAuth();
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
    <nav className="fixed top-0 left-0 right-0 bg-white shadow-md px-4 py-2 z-[2500] nav-top-bar">
      <div className="flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <img src={logo} alt="TrashDrop Logo" className="h-8 mr-2" />
          <span className="text-green-500 text-xl font-bold">TrashDrop Carter</span>
        </Link>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            className="flex items-center focus:outline-none"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-medium">
              {userProfile?.first_name?.[0]?.toUpperCase() || ''}{userProfile?.last_name?.[0]?.toUpperCase() || (userProfile ? '' : 'U')}
            </div>
            <span className="ml-2 hidden md:inline text-gray-700">
              {userProfile?.first_name && userProfile?.last_name 
                ? `${userProfile.first_name} ${userProfile.last_name}` 
                : 'User'}
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-[3000]">
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
                onClick={async () => {
                  setIsDropdownOpen(false);
                  logger.info('Logging out user from NavBar...');
                  const { success } = await logout();
                  if (success) {
                    logger.info('Logout successful, navigating to login page...');
                    navigate('/login');
                  }
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

