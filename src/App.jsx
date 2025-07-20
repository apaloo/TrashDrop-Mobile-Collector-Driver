import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { FilterProvider } from './context/FilterContext';
import AppLayout from './components/AppLayout';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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

// RouteGuard components to protect routes
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }
  
  if (isAuthenticated) {
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
          <ToastContainer position="top-center" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
          <AppLayout>
            <Routes>
          {/* Public Routes (only when not logged in) */}
          <Route path="/login" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />
          <Route path="/signup" element={
            <PublicRoute>
              <SignupPage />
            </PublicRoute>
          } />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          
          {/* Protected Routes (only when logged in) */}
          <Route path="/map" element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          } />
          <Route path="/request" element={
            <ProtectedRoute>
              <RequestPage />
            </ProtectedRoute>
          } />
          <Route path="/assign" element={
            <ProtectedRoute>
              <AssignPage />
            </ProtectedRoute>
          } />
          <Route path="/earnings" element={
            <ProtectedRoute>
              <EarningsPage />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
          
          <Route path="/route-optimization" element={
            <ProtectedRoute>
              <RouteOptimizationPage />
            </ProtectedRoute>
          } />
          
          {/* Diagnostic route */}
          <Route path="/diagnostic" element={<DiagnosticPage />} />
          
          {/* Default redirect */}
          <Route path="/" element={
            <DefaultRedirect />
          } />
          
          {/* 404 fallback */}
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
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return isAuthenticated ? <Navigate to="/map" replace /> : <Navigate to="/login" replace />;
}

export default App;
