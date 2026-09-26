import React, { Suspense, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { saveLastPage, getLastPage } from './utils/pagePersistence';

// Context providers
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { FilterProvider } from './context/FilterContext';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import { LanguageProvider } from './context/LanguageContext';

// Services
import { audioAlertService } from './services/audioAlertService';
import { lazyWithRetry, prefetchLazyRoutes } from './utils/lazyWithRetry';

// Components
import AppLayout from './components/AppLayout';
import InstallPrompt from './components/InstallPrompt';
import NewJobAlerts from './components/NewJobAlerts';
import ImageManager from './utils/imageManager';
import { logger } from './utils/logger';

// Reusable loading fallback for Suspense boundaries
const PageLoader = ({ message = 'Loading...' }) => (
  <div className="flex h-screen items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
      <p className="mt-4 text-gray-700 font-medium">{message}</p>
    </div>
  </div>
);

// LAZY: All pages loaded on demand to minimize initial bundle
const WelcomePage = lazyWithRetry(() => import('./pages/Welcome'));
const TermsPage = lazyWithRetry(() => import('./pages/Terms'));
const PrivacyPage = lazyWithRetry(() => import('./pages/Privacy'));
const LoginPage = lazyWithRetry(() => import('./pages/Login'));
const SignupPage = lazyWithRetry(() => import('./pages/Signup'));

const MapPage = lazyWithRetry(() => import('./pages/Map'));
const RequestPage = lazyWithRetry(() => import('./pages/Request'));
const AssignPage = lazyWithRetry(() => import('./pages/Assign'));
const EarningsPage = lazyWithRetry(() => import('./pages/Earnings'));
const ProfilePage = lazyWithRetry(() => import('./pages/Profile'));
const RouteOptimizationPage = lazyWithRetry(() => import('./pages/RouteOptimization'));

// Clean up image resources when navigating away from request pages
const RouteCleanup = () => {
  const location = useLocation();
  const lastCleanedPath = useRef(null);
  
  useEffect(() => {
    // Clean up images when navigating away from request pages
    // Only run once per path change, not on every render
    if (!location.pathname.includes('/request/') && lastCleanedPath.current !== location.pathname) {
      lastCleanedPath.current = location.pathname;
      logger.debug('🚀 Navigating away from request page, cleaning up images');
      // Don't clear all images, just revoke blob URLs to free memory
      const photos = ImageManager.getAllCapturedPhotos();
      ImageManager.revokeBlobURLs(photos);
    }
  }, [location.pathname]);
  
  return null;
};

// Component to handle page persistence
const PagePersistence = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Save the current page whenever it changes
    saveLastPage(location.pathname);
  }, [location.pathname]);
  
  return null;
};

// Shown for unknown addresses. Icon-first with one large button so it works
// without reading. Links straight to /map: "/" restores the last saved page,
// which can be this same unknown address.
const NotFound = () => (
  <div className="flex h-screen flex-col items-center justify-center gap-8 bg-gray-50 p-4 text-center">
    <div className="text-8xl" aria-hidden="true">🤷🏾</div>
    <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
    <Link
      to="/map"
      replace
      className="flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-5 text-2xl font-bold text-white shadow-lg active:bg-primary-dark"
    >
      <span aria-hidden="true">🏠</span> Home
    </Link>
  </div>
);

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
  const { isAuthenticated, hasLoggedOut, isCompletingSignup } = useAuth();
  
  // IMMEDIATE: No loading check - redirect immediately if authenticated
  // BUT don't redirect if user is in the middle of completing signup
  if (isAuthenticated && !hasLoggedOut && !isCompletingSignup) {
    return <Navigate to="/map" replace />;
  }
  
  return children;
};

function App() {
  const startTime = Date.now();
  logger.debug('🏁 App component rendering at:', startTime);

  useEffect(() => {
    prefetchLazyRoutes([
      () => import('./pages/Map'),
      () => import('./pages/Request'),
      () => import('./pages/Assign'),
      () => import('./pages/Profile')
    ]);
  }, []);
  
  return (
    <AuthProvider>
      <LanguageProvider>
      <OfflineProvider>
        <CurrencyProvider>
          <FilterProvider>
            <Router>
              <AppStateProvider>
                <AudioInteractionHandler />
                <NewJobAlerts />
                <InstallPrompt />
                <AppLayout>
                  <RouteCleanup />
                  <PagePersistence />
                  <Routes>
                    <Route path="/" element={<DefaultRedirect />} />
                    <Route path="/welcome" element={<Suspense fallback={<PageLoader />}><WelcomePage /></Suspense>} />
                    <Route path="/terms" element={<Suspense fallback={<PageLoader />}><TermsPage /></Suspense>} />
                    <Route path="/privacy" element={<Suspense fallback={<PageLoader />}><PrivacyPage /></Suspense>} />
                    <Route path="/login" element={<PublicRoute><Suspense fallback={<PageLoader message="Loading login..." />}><LoginPage /></Suspense></PublicRoute>} />
                    <Route path="/signup" element={<PublicRoute><Suspense fallback={<PageLoader message="Loading signup..." />}><SignupPage /></Suspense></PublicRoute>} />
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
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  <ToastContainer position="top-center" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                </AppLayout>
              </AppStateProvider>
            </Router>
          </FilterProvider>
        </CurrencyProvider>
      </OfflineProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

// Component to handle user interactions for AudioContext
const AudioInteractionHandler = () => {
  const audioInitializedRef = useRef(false);
  
  useEffect(() => {
    const handleUserInteraction = async () => {
      if (!audioInitializedRef.current) {
        try {
          await audioAlertService.resumeOnUserInteraction();
          audioInitializedRef.current = true;
          logger.info('🔊 AudioContext resumed on user interaction');
        } catch (error) {
          logger.warn('🔊 Failed to resume AudioContext:', error);
        }
      }
    };

    // Add event listeners for user interactions
    const events = ['click', 'touchstart', 'keydown', 'mousedown'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, []);

  return null;
};

// Component to handle default route redirect based on auth state
const DefaultRedirect = () => {
  const { isAuthenticated, hasLoggedOut, user, isCompletingSignup } = useAuth();
  const { getRestoredRoute, isRestoring } = useAppState();
  
  // Log state for debugging
  logger.debug('DefaultRedirect:', { isAuthenticated, hasLoggedOut, hasUser: !!user, isCompletingSignup, isRestoring });
  
  // If user is completing signup, redirect to signup page
  if (isCompletingSignup) {
    logger.debug('DefaultRedirect: User completing signup, redirecting to signup');
    return <Navigate to="/signup" replace />;
  }
  
  // IMMEDIATE: Redirect without waiting for loading
  // If authenticated and hasn't logged out, go to restored route or map
  if (isAuthenticated && !hasLoggedOut) {
    const restoredRoute = getRestoredRoute();
    if (restoredRoute) {
      logger.debug('DefaultRedirect: Restoring to previous route:', restoredRoute);
      return <Navigate to={restoredRoute} replace />;
    }
    
    // Check for last saved page (for app resume from background)
    const lastPage = getLastPage();
    if (lastPage && lastPage !== '/' && lastPage !== '/login') {
      logger.debug('DefaultRedirect: Restoring to last saved page:', lastPage);
      return <Navigate to={lastPage} replace />;
    }
    
    logger.debug('DefaultRedirect: Redirecting authenticated user to map');
    return <Navigate to="/map" replace />;
  }
  
  // Default to login for non-authenticated users
  logger.debug('DefaultRedirect: Redirecting to login');
  return <Navigate to="/login" replace />;
}

export default App;
