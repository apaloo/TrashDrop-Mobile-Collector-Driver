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
  // CRITICAL: Start with loading = false for immediate UI render
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Initialize hasLoggedOut from localStorage to persist across refreshes
  const [hasLoggedOut, setHasLoggedOut] = useState(
    localStorage.getItem('user_logged_out') === 'true'
  );
  
  // IMMEDIATE: Track if we've done the initial auth check
  const [hasInitiallyChecked, setHasInitiallyChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔐 Starting authentication check at:', Date.now());
      console.time('🔐 Auth Check Duration');
      
      // CRITICAL: Don't set loading=true for immediate checks
      // Only set loading for operations that might take time
      
      try {
        // IMMEDIATE: First check if user has explicitly logged out
        const isLoggedOut = localStorage.getItem('user_logged_out') === 'true';
        if (isLoggedOut) {
          console.log('🚫 User is logged out, clearing any existing sessions');
          setUser(null);
          setHasLoggedOut(true);
          setHasInitiallyChecked(true);
          return;
        }

        // Check for current Supabase session
        console.log('🔐 Checking Supabase session...');
        const { session, user, error } = await authService.getSession();
        
        if (user && !error) {
          console.log('✅ Found existing Supabase session:', user?.id);
          setUser(user);
          setHasLoggedOut(false);
          setHasInitiallyChecked(true);
          return;
        }

        // No session found
        console.log('🔍 No session found, user remains logged out');
        setUser(null);
        setHasInitiallyChecked(true);
        
      } catch (err) {
        console.error('❌ Auth check error:', err);
        setError(err.message);
        setUser(null);
      } finally {
        console.timeEnd('🔐 Auth Check Duration');
        console.log('🔐 Auth check completed at:', Date.now());
      }
    };
    
    // Check auth on load - non-blocking for cached sessions
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
          console.log('No session found, clearing user state');
          setUser(null);
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
  // NOTE: User must already be authenticated (OTP verified at Step 2)
  const signup = async (userData) => {
    try {
      setLoading(true);
      
      // User is already authenticated from OTP verification at Step 2
      // Just get the current session to confirm authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !session.user) {
        throw new Error('User must be authenticated before completing signup. Please verify your phone number first.');
      }
      
      const user = session.user;
      
      // Create user profile with additional data (no email required)
      const profileData = {
        first_name: userData.first_name,
        last_name: userData.last_name,
        phone: userData.phone,
        region: userData.region,
        id_type: userData.id_type,
        id_front_photo_url: userData.id_front_photo_url,
        id_back_photo_url: userData.id_back_photo_url,
        vehicle_type: userData.vehicle_type,
        license_plate: userData.license_plate,
        vehicle_color: userData.vehicle_color,
        vehicle_photo_url: userData.vehicle_photo_url,
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
      console.log('✅ User signup completed successfully - profile created');
      return { success: true, user };
    } catch (err) {
      console.error('❌ Signup error:', err.message);
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
      
      // Set logout flag to prevent automatic session restoration
      setHasLoggedOut(true);
      
      // Save logout state to localStorage to persist across refreshes
      localStorage.setItem('user_logged_out', 'true');
      
      // Clear user from state
      setUser(null);
      
      console.log('✅ User logged out successfully, session cleared, logout flag set');
      
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
