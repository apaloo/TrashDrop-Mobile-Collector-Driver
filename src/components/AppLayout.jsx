import React from 'react';
import { useLocation } from 'react-router-dom';
import { TopNavBar } from './NavBar';
import BottomNavBar from './BottomNavBar';
// import OfflineIndicator from './OfflineIndicator'; // Removed for faster startup
import { useAuth } from '../context/AuthContext';

/**
 * Layout component that wraps the app content and includes navigation bars and offline indicator
 */
const AppLayout = ({ children }) => {
  const location = useLocation();
  const { user } = useAuth();
  
  // Public routes that don't need navigation bars
  const publicRoutes = ['/login', '/signup', '/welcome', '/terms', '/privacy'];
  const isPublicRoute = publicRoutes.includes(location.pathname);
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 relative">
      {/* Show TopNavBar only on authenticated routes */}
      {!isPublicRoute && <TopNavBar user={user} />}
      
      {/* Main content with padding for nav bars */}
      <main className={`flex-grow relative z-0`} style={location.pathname === '/route-optimization' ? {paddingTop: '3.8rem'} : {}}>
        {children}
      </main>
      
      {/* Show BottomNavBar only on authenticated routes */}
      {!isPublicRoute && <BottomNavBar />}
      
      {/* Offline indicator removed for faster startup */}
    </div>
  );
};

export default AppLayout;
