import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Top navigation bar component with logo and profile dropdown
 */
export const TopNavBar = ({ user }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-md px-4 py-2 z-10">
      <div className="flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <span className="text-primary text-xl font-bold">TrashDrop</span>
        </Link>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            className="flex items-center focus:outline-none"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-700">
              {user?.first_name?.[0] || 'U'}
            </div>
            <span className="ml-2 hidden md:inline">{user?.first_name || 'User'}</span>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-20">
              <Link
                to="/profile"
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setIsDropdownOpen(false)}
              >
                Profile
              </Link>
              <Link
                to="/settings"
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setIsDropdownOpen(false)}
              >
                Settings
              </Link>
              <button
                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  // Handle logout logic here
                  setIsDropdownOpen(false);
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

/**
 * Bottom navigation bar component with tabs for main app sections
 */
export const BottomNavBar = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { label: 'Map', path: '/', icon: '🗺️' },
    { label: 'Request', path: '/request', icon: '📦' },
    { label: 'Assign', path: '/assign', icon: '📋' },
    { label: 'Earnings', path: '/earnings', icon: '💰' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg px-2 py-1 z-10">
      <div className="flex justify-around items-center">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center py-1 px-3 rounded-md ${
              currentPath === item.path
                ? 'text-primary'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs mt-1">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};
