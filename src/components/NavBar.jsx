import { useState, useEffect, useRef, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Use public logo.png (preloaded in index.html) for instant rendering during navigation
const logo = '/logo.png';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';
import { LogoutConfirmationModal } from './LogoutConfirmationModal';

/**
 * Top navigation bar component with logo and profile dropdown
 */
export const TopNavBar = memo(({ user }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef(null);
  
  // Taps outside the open menu land on a full-screen backdrop (below) that only
  // closes it. The menu used to close on touchstart instead, so on phones the
  // click from that same tap arrived after the menu had gone and hit whatever
  // was underneath, e.g. the Map's On-/Off-Duty button.
  useEffect(() => {
    if (!isDropdownOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsDropdownOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isDropdownOpen]);
  
  // Collector profile is loaded once by AuthContext (the route guard waits for it)
  const { logout, profile: userProfile } = useAuth();
  const navigate = useNavigate();

  // Handle logout confirmation
  const handleLogoutClick = () => {
    setIsDropdownOpen(false);
    setIsLogoutModalOpen(true);
  };

  // Handle confirmed logout
  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    try {
      logger.info('Logging out user from NavBar...');
      const { success } = await logout();
      if (success) {
        logger.info('Logout successful, navigating to login page...');
        navigate('/login');
      }
    } catch (error) {
      logger.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
    }
  };

  // Handle logout cancellation
  const handleLogoutCancel = () => {
    setIsLogoutModalOpen(false);
  };

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 bg-white shadow-md px-4 py-2 z-[2500] nav-top-bar${isDropdownOpen ? ' nav-menu-open' : ''}`}>
        {isDropdownOpen && (
          <div
            className="fixed inset-0 z-[2900]"
            data-testid="nav-menu-backdrop"
            aria-hidden="true"
            onClick={() => setIsDropdownOpen(false)}
          />
        )}
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src={logo} alt="TrashDrop Logo" className="h-8 mr-2" width="32" height="32" loading="eager" decoding="sync" />
            <span className="text-green-500 text-xl font-bold">TrashDrop Carter</span>
          </Link>

          {/* Profile Dropdown */}
          <div className="relative z-[3000]" ref={dropdownRef}>
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
                  onClick={handleLogoutClick}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      
      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
        isLoading={isLoggingOut}
      />
    </>
  );
}, (prevProps, nextProps) => {
  // Only re-render if user identity actually changes
  return prevProps.user?.id === nextProps.user?.id;
});
