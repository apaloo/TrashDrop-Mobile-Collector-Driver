import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Bottom navigation bar component with tabs for main app sections
 */
const BottomNavBar = () => {
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

export default BottomNavBar;
