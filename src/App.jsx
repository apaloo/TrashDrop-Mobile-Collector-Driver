import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context providers
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { FilterProvider } from './context/FilterContext';

// Components
import AppLayout from './components/AppLayout';
import ImageManager from './utils/imageManager';

// IMMEDIATE: Critical pages loaded immediately for fast startup
import WelcomePage from './pages/Welcome';
import TermsPage from './pages/Terms';
import PrivacyPage from './pages/Privacy';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import DiagnosticPage from './pages/DiagnosticPage';

// LAZY: Heavy pages loaded on demand to reduce initial bundle
const MapPage = lazy(() => import('./pages/Map'));
const RequestPage = lazy(() => import('./pages/Request'));
const AssignPage = lazy(() => import('./pages/Assign'));
const EarningsPage = lazy(() => import('./pages/Earnings'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const RouteOptimizationPage = lazy(() => import('./pages/RouteOptimization'));

// Clear stale test-user-id session data
const clearStaleSession = () => {
    const devModeSession = localStorage.getItem('dev_mode_session');
    if (devModeSession) {
      const session = JSON.parse(devModeSession);
      if (session?.user?.id === 'test-user-id') {
        console.log('Clearing stale test-user-id session data');
        localStorage.removeItem('dev_mode_session');
      }
    }
  }
  
  // Execute cleanup on app startup
  if (process.env.NODE_ENV === 'development') {
    clearStaleSession();
  }

// Component to handle cleanup on route changes
const RouteCleanup = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Clean up images when navigating away from request pages
    if (!location.pathname.includes('/request/')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🚀 Navigating away from request page, cleaning up images');
      }
      // Don't clear all images, just revoke blob URLs to free memory
      const photos = ImageManager.getAllCapturedPhotos();
      ImageManager.revokeBlobURLs(photos);
    }
  }, [location.pathname]);
  
  return null;
};

// RouteGuard components to protect routes
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user, hasLoggedOut } = useAuth();
  
  // Check for dev mode session in localStorage directly for extra safety
  const hasDevModeSession = localStorage.getItem('dev_mode_session') !== null;
  
  // Debug logging
  console.log('ProtectedRoute check:', { 
    isAuthenticated, 
    loading, 
    hasUser: !!user,
    hasDevModeSession,
    hasLoggedOut
  });
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-gray-700 font-medium">🔐 Checking access...</p>
          <p className="mt-1 text-sm text-gray-500">Verifying your permissions</p>
        </div>
      </div>
    );
  }
  
  // Allow access if authenticated OR if we have a dev mode session AND user hasn't logged out
  if ((!isAuthenticated && !hasDevModeSession) || hasLoggedOut) {
    console.log('Access denied: User not authenticated or has logged out');
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, hasLoggedOut } = useAuth();
  
  // Check for dev mode session in localStorage directly for extra safety
  const hasDevModeSession = localStorage.getItem('dev_mode_session') !== null;
  
  // Debug logging
  console.log('PublicRoute check:', { 
    isAuthenticated, 
    loading, 
    hasDevModeSession,
    hasLoggedOut
  });
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-gray-700 font-medium">⚡ Loading app...</p>
          <p className="mt-1 text-sm text-gray-500">Setting up your workspace</p>
        </div>
      </div>
    );
  }
  
  // Only redirect to map if authenticated OR if we have a dev mode session AND user hasn't logged out
  if ((isAuthenticated || hasDevModeSession) && !hasLoggedOut) {
    console.log('Redirecting to map: User is authenticated or has dev mode session and has not logged out');
    return <Navigate to="/map" replace />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <OfflineProvider>
        <CurrencyProvider>
          <FilterProvider>
            <Router>
              <AppLayout>
                <RouteCleanup />
                <Routes>
                  <Route path="/" element={<DefaultRedirect />} />
                  <Route path="/welcome" element={<WelcomePage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                  <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
                  <Route path="/map" element={
                    <ProtectedRoute>
                      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                          <p className="mt-4 text-gray-700 font-medium">🗺️ Loading Map...</p>
                        </div>
                      </div>}>
                        <MapPage />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/request" element={
                    <ProtectedRoute>
                      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                          <p className="mt-4 text-gray-700 font-medium">📋 Loading Requests...</p>
                        </div>
                      </div>}>
                        <RequestPage />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/request/:id" element={
                    <ProtectedRoute>
                      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                          <p className="mt-4 text-gray-700 font-medium">📋 Loading Request...</p>
                        </div>
                      </div>}>
                        <RequestPage />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/assign" element={
                    <ProtectedRoute>
                      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                          <p className="mt-4 text-gray-700 font-medium">📦 Loading Assignments...</p>
                        </div>
                      </div>}>
                        <AssignPage />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/earnings" element={
                    <ProtectedRoute>
                      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                          <p className="mt-4 text-gray-700 font-medium">💰 Loading Earnings...</p>
                        </div>
                      </div>}>
                        <EarningsPage />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                          <p className="mt-4 text-gray-700 font-medium">👤 Loading Profile...</p>
                        </div>
                      </div>}>
                        <ProfilePage />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/diagnostic" element={<DiagnosticPage />} />
                  <Route path="/route-optimization" element={
                    <ProtectedRoute>
                      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                          <p className="mt-4 text-gray-700 font-medium">🚗 Loading Route Optimization...</p>
                        </div>
                      </div>}>
                        <RouteOptimizationPage />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="*" element={
                    <div className="flex flex-col h-screen items-center justify-center p-4">
                      <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
                      <p className="mb-6">The page you are looking for doesn't exist or has been moved.</p>
                      <button 
                        onClick={() => window.location.href = '/'}
                        className="btn btn-primary"
                      >
                        Go Home
                      </button>
                    </div>
                  } />
                </Routes>
                <ToastContainer position="top-center" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
              </AppLayout>
            </Router>
          </FilterProvider>
        </CurrencyProvider>
      </OfflineProvider>
    </AuthProvider>
  );
}

// Component to handle default route redirect based on auth state
const DefaultRedirect = () => {
  const { isAuthenticated, loading, hasLoggedOut } = useAuth();
  
  // Check for dev mode session in localStorage directly for extra safety
  const hasDevModeSession = localStorage.getItem('dev_mode_session') !== null;
  
  // Debug logging
  console.log('DefaultRedirect check:', { 
    isAuthenticated, 
    loading, 
    hasDevModeSession,
    hasLoggedOut
  });
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-gray-700 font-medium">🚀 Starting up...</p>
          <p className="mt-1 text-sm text-gray-500">Preparing your dashboard</p>
        </div>
      </div>
    );
  }
  
  // Redirect based on authentication status OR dev mode session, but respect logout state
  if ((isAuthenticated || hasDevModeSession) && !hasLoggedOut) {
    console.log('DefaultRedirect: Redirecting to map');
    return <Navigate to="/map" replace />;
  } else {
    console.log('DefaultRedirect: Redirecting to login');
    return <Navigate to="/login" replace />;
  }
}

export default App;
