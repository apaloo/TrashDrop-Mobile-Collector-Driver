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
import { logger } from './utils/logger';

// IMMEDIATE: Critical pages loaded immediately for fast startup
import WelcomePage from './pages/Welcome';
import TermsPage from './pages/Terms';
import PrivacyPage from './pages/Privacy';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import DiagnosticPage from './pages/DiagnosticPage';
import PaymentTest from './pages/PaymentTest';

// LAZY: Heavy pages loaded on demand to reduce initial bundle
const MapPage = lazy(() => import('./pages/Map'));
const RequestPage = lazy(() => import('./pages/Request'));
const AssignPage = lazy(() => import('./pages/Assign'));
const EarningsPage = lazy(() => import('./pages/Earnings'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const RouteOptimizationPage = lazy(() => import('./pages/RouteOptimization'));

// Clean up image resources when navigating away from request pages
const RouteCleanup = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Clean up images when navigating away from request pages
    if (!location.pathname.includes('/request/')) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('🚀 Navigating away from request page, cleaning up images');
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
  const { isAuthenticated, hasLoggedOut } = useAuth();
  
  // IMMEDIATE: No loading check - redirect immediately if not authenticated
  if (!isAuthenticated || hasLoggedOut) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, hasLoggedOut } = useAuth();
  
  // IMMEDIATE: No loading check - redirect immediately if authenticated
  if (isAuthenticated && !hasLoggedOut) {
    return <Navigate to="/map" replace />;
  }
  
  return children;
};

function App() {
  const startTime = Date.now();
  logger.debug('🏁 App component rendering at:', startTime);
  
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
                  <Route path="/payment-test" element={<PaymentTest />} />
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
  const { isAuthenticated, hasLoggedOut, user } = useAuth();
  
  // Log state for debugging
  logger.debug('DefaultRedirect:', { isAuthenticated, hasLoggedOut, hasUser: !!user });
  
  // IMMEDIATE: Redirect without waiting for loading
  // If authenticated and hasn't logged out, go to map
  if (isAuthenticated && !hasLoggedOut) {
    logger.debug('DefaultRedirect: Redirecting authenticated user to map');
    return <Navigate to="/map" replace />;
  }
  
  // Default to login for non-authenticated users
  logger.debug('DefaultRedirect: Redirecting to login');
  return <Navigate to="/login" replace />;
}

export default App;
