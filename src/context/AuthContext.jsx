import { createContext, useState, useEffect, useContext } from 'react';
import { supabase, authService } from '../services/supabase';

// Create the context
export const AuthContext = createContext();

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Initialize hasLoggedOut from localStorage to persist across refreshes
  const [hasLoggedOut, setHasLoggedOut] = useState(
    localStorage.getItem('user_logged_out') === 'true'
  );

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      try {
        // First check if user has explicitly logged out
        const isLoggedOut = localStorage.getItem('user_logged_out') === 'true';
        if (isLoggedOut) {
          console.log('User is logged out, clearing any existing sessions');
          localStorage.removeItem('dev_mode_session');
          setUser(null);
          setHasLoggedOut(true);
          return;
        }

        // Get current session from Supabase
        const { session, user, error } = await authService.getSession();
        
        // If we have a valid user from session, use it
        if (user && !error) {
          console.log('Found existing user session:', user?.id);
          setUser(user);
          setHasLoggedOut(false);
          return;
        }

        // Check for existing dev mode session
        const existingDevSession = localStorage.getItem('dev_mode_session');
        if (existingDevSession) {
          console.log('Found existing dev mode session');
          const mockUser = JSON.parse(existingDevSession).user;
          setUser(mockUser);
          setHasLoggedOut(false);
          return;
        }

        // If we get here, we have no session and no dev mode session
        console.log('No session found, user remains logged out');
        setUser(null);
        
      } catch (err) {
        console.error('Auth check error:', err);
        setError(err.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    // Check auth on load
    checkAuth();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('Auth state changed:', _event, session ? 'session exists' : 'no session');
        const user = session?.user || null;
        
        if (user) {
          console.log('User authenticated:', user.id);
          setUser(user);
        } else {
          // Don't clear user if we're in dev mode and have a persisted session
          const devSession = localStorage.getItem('dev_mode_session');
          if (!devSession) {
            console.log('No session found, clearing user state');
            setUser(null);
          } else {
            console.log('Dev mode session exists, maintaining user state');
            // We don't need to set user here as it should already be set from checkAuth
          }
        }
      }
    );
    
    // Clean up subscription on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, []);
  
  // Send OTP code
  const sendOtp = async (phoneNumber) => {
    try {
      setLoading(true);
      const result = await authService.sendOtp(phoneNumber);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send OTP');
      }
      
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };
  
  // Verify OTP and sign in
  const login = async (phoneNumber, otp) => {
    try {
      setLoading(true);
      const { success, session, user, error } = await authService.verifyOtp(phoneNumber, otp);
      
      if (!success) {
        throw new Error(error || 'Failed to verify OTP');
      }
      
      // Reset logout flag and set user after successful verification
      setHasLoggedOut(false);
      localStorage.removeItem('user_logged_out');
      setUser(user);
      console.log('User verified successfully, logout flag cleared');
      return { success: true, user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };
  
  // Create a new user account and profile
  const signup = async (userData) => {
    try {
      setLoading(true);
      
      // First, verify OTP to create the user
      const { success: otpSuccess, user, error: otpError } = 
        await authService.verifyOtp(userData.phone, userData.otp);
      
      if (!otpSuccess) {
        throw new Error(otpError || 'Failed to verify phone number');
      }
      
      // Then create a user profile with additional data
      const profileData = {
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        phone: userData.phone,
        region: userData.region,
        vehicle_type: userData.vehicle_type,
        license_plate: userData.license_plate,
        vehicle_color: userData.vehicle_color,
        company_id: userData.company_id,
        company_name: userData.company_name,
        role: userData.role
      };
      
      const { success: profileSuccess, error: profileError } = 
        await authService.createUserProfile(user.id, profileData);
      
      if (!profileSuccess) {
        throw new Error(profileError || 'Failed to create user profile');
      }
      
      // Reset logout flag and set user
      setHasLoggedOut(false);
      localStorage.removeItem('user_logged_out');
      setUser(user);
      console.log('User signed up successfully, logout flag cleared');
      return { success: true, user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };
  
  // Sign out
  const logout = async () => {
    try {
      setLoading(true);
      console.log('Logging out user...');
      const { success, error } = await authService.signOut();
      
      if (!success) {
        throw new Error(error || 'Failed to sign out');
      }
      
      // Set logout flag to prevent automatic re-creation of mock session
      setHasLoggedOut(true);
      
      // Save logout state to localStorage to persist across refreshes
      localStorage.setItem('user_logged_out', 'true');
      
      // Clear user from state
      setUser(null);
      
      // Ensure we clear any persisted session
      localStorage.removeItem('dev_mode_session');
      console.log('User logged out successfully, session cleared, logout flag set');
      
      // Force a small delay to ensure state changes propagate
      // before the navigation happens
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return { success: true };
    } catch (err) {
      console.error('Logout error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    error,
    sendOtp,
    login,
    signup,
    logout,
    hasLoggedOut,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
