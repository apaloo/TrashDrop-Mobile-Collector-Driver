import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { FilterProvider } from './context/FilterContext';
import AppLayout from './components/AppLayout';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useEffect } from 'react';
import ImageManager from './utils/imageManager';
// Removed cacheUtils import - no longer using caching

// Clear stale test-user-id session data
const clearStaleSession = () => {
  try {
    const devModeSession = localStorage.getItem('dev_mode_session');
    if (devModeSession) {
      const session = JSON.parse(devModeSession);
      if (session?.user?.id === 'test-user-id') {
        console.log('Clearing stale test-user-id session data');
        localStorage.removeItem('dev_mode_session');
      }
    }
  } catch (err) {
    console.error('Error clearing stale session:', err);
  }
};

// Removed cache cleanup - no longer using caching

// Execute cleanup on app startup
if (process.env.NODE_ENV === 'development') {
  clearStaleSession();
}

// Pages
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import WelcomePage from './pages/Welcome';
import TermsPage from './pages/Terms';
import PrivacyPage from './pages/Privacy';
import MapPage from './pages/Map';
import RequestPage from './pages/Request';
import AssignPage from './pages/Assign';
import EarningsPage from './pages/Earnings';
import ProfilePage from './pages/Profile';
import DiagnosticPage from './pages/DiagnosticPage';
import RouteOptimizationPage from './pages/RouteOptimization';

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
    return <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
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
    return <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
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
                  <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
                  <Route path="/request" element={<ProtectedRoute><RequestPage /></ProtectedRoute>} />
                  <Route path="/request/:id" element={<ProtectedRoute><RequestPage /></ProtectedRoute>} />
                  <Route path="/assign" element={<ProtectedRoute><AssignPage /></ProtectedRoute>} />
                  <Route path="/earnings" element={<ProtectedRoute><EarningsPage /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                  <Route path="/diagnostic" element={<DiagnosticPage />} />
                  <Route path="/route-optimization" element={<ProtectedRoute><RouteOptimizationPage /></ProtectedRoute>} />
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
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
