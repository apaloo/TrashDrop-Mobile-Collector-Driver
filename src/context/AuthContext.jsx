import { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { supabase, authService } from '../services/supabase';
import { statusService } from '../services/statusService';
import { COLLECTOR_TYPE } from '../utils/volunteer';
import { requestVolunteerAccess } from '../services/volunteerService';
import { logger } from '../utils/logger';
import { PROFILE_STATE, getProfileState, NO_ACCOUNT_MESSAGE } from '../utils/collectorProfile';
import { clearAllJobs } from '../utils/offlineJobsCache';
import { locationBroadcast } from '../services/locationBroadcast';

// Supabase's error when shouldCreateUser is false and the number is unknown
const isSignupDisallowedError = (message = '') =>
  /signups? not allowed|user not found/i.test(message);

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
  
  // Track if user is in the middle of signup flow (prevents redirect to map)
  const [isCompletingSignup, setIsCompletingSignup] = useState(
    localStorage.getItem('is_completing_signup') === 'true'
  );
  
  // IMMEDIATE: Start with true to allow immediate rendering
  // Auth check happens in background without blocking UI
  const [hasInitiallyChecked, setHasInitiallyChecked] = useState(true);

  // Collector profile, loaded once per signed-in user and shared by every page.
  // profileUserId records which user the profile belongs to, so a new user is
  // never shown the previous user's state while their profile loads.
  const [profile, setProfile] = useState(null);
  const [profileLoadState, setProfileLoadState] = useState(PROFILE_STATE.IDLE);
  const [profileUserId, setProfileUserId] = useState(null);
  const profileRequestRef = useRef(0);

  // While login() is checking for a collector profile, ignore the SIGNED_IN
  // event so an unregistered user never appears signed in, even briefly.
  const verifyingLoginRef = useRef(false);

  useEffect(() => {
    // Helper function to check if 1-month session has expired
    const isSessionExpired = () => {
      const lastLoginTime = localStorage.getItem('last_login_time');
      if (!lastLoginTime) {
        logger.debug('📭 No login time found - treating as not expired for new session');
        return false; // Don't force logout if no login time exists yet
      }

      const loginDate = new Date(parseInt(lastLoginTime));
      const now = new Date();
      
      // Calculate expiry: 30 days (1 month) from login time
      const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
      const expiryTime = new Date(loginDate.getTime() + SESSION_DURATION_MS);
      
      if (now >= expiryTime) {
        logger.info('⏰ 1-month session expired');
        logger.info(`   Login: ${loginDate.toLocaleString()}`);
        logger.info(`   Expiry: ${expiryTime.toLocaleString()}`);
        return true;
      }
      
      // Calculate time remaining
      const daysRemaining = Math.floor((expiryTime - now) / (24 * 60 * 60 * 1000));
      const hoursRemaining = Math.floor(((expiryTime - now) % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      logger.debug(`⏱️ Session valid for ${daysRemaining}d ${hoursRemaining}h (expires at ${expiryTime.toLocaleString()})`);
      return false;
    };

    const checkAuth = async () => {
      const startTime = Date.now();
      logger.debug('🔐 Starting authentication check at:', startTime);
      
      // CRITICAL: Don't set loading=true for immediate checks
      // Only set loading for operations that might take time
      
      try {
        // IMMEDIATE: First check if user has explicitly logged out
        const isLoggedOut = localStorage.getItem('user_logged_out') === 'true';
        if (isLoggedOut) {
          logger.debug('🚫 User is logged out, clearing any existing sessions');
          setUser(null);
          setHasLoggedOut(true);
          setHasInitiallyChecked(true);
          return;
        }

        // Check if 1-month session has expired
        if (isSessionExpired()) {
          logger.info('🕐 1-month session expired, logging out...');
          // Clear session and logout
          localStorage.removeItem('last_login_time');
          await authService.signOut();
          setUser(null);
          setHasLoggedOut(true);
          localStorage.setItem('user_logged_out', 'true');
          setHasInitiallyChecked(true);
          return;
        }

        // Check for current Supabase session
        logger.debug('🔐 Checking Supabase session...');
        const { session, user, error } = await authService.getSession();
        
        if (user && !error) {
          logger.debug('✅ Found existing Supabase session:', user?.id);
          setUser(user);
          setHasLoggedOut(false);
          setHasInitiallyChecked(true);
          return;
        }

        // No session found
        logger.debug('🔍 No session found, user remains logged out');
        setUser(null);
        setHasInitiallyChecked(true);
        
      } catch (err) {
        logger.error('❌ Auth check error:', err);
        
        // Detect invalid refresh token errors and auto-cleanup
        if (err.message?.includes('refresh_token_not_found') || 
            err.message?.includes('Invalid Refresh Token') ||
            err.code === 'refresh_token_not_found') {
          logger.warn('🧹 Detected invalid refresh token, clearing auth data...');
          
          // Clear all Supabase auth data from localStorage
          try {
            Object.keys(localStorage).forEach(key => {
              if (key.includes('supabase') || key.includes('sb-')) {
                localStorage.removeItem(key);
              }
            });
            
            // Sign out from Supabase to clean up any lingering sessions
            await supabase.auth.signOut();
            
            logger.info('✅ Invalid auth data cleared successfully');
          } catch (cleanupError) {
            logger.error('Failed to cleanup auth data:', cleanupError);
          }
        }
        
        setError(err.message);
        setUser(null);
        setHasInitiallyChecked(true); // Always mark as checked even on error
      } finally {
        const duration = Date.now() - startTime;
        logger.debug(`🔐 Auth check completed in ${duration}ms`);
      }
    };
    
    // Check auth on load - non-blocking for cached sessions
    checkAuth();
    
    // Set up auth state change listener with error handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          logger.debug('Auth state changed:', _event, session ? 'session exists' : 'no session');
          
          // CRITICAL: Respect the user_logged_out flag to prevent infinite loops
          // If user explicitly logged out, don't auto-login even if Supabase has a session
          // EXCEPTION: If user is completing signup, allow the auth change (new user registration)
          const isLoggedOut = localStorage.getItem('user_logged_out') === 'true';
          const isSigningUp = localStorage.getItem('is_completing_signup') === 'true';
          if (isLoggedOut && session?.user && !isSigningUp) {
            logger.debug('🚫 Ignoring auth state change - user has explicitly logged out');
            return; // Don't update state, keep user logged out
          }
          
          if (verifyingLoginRef.current && session?.user) {
            logger.debug('⏳ Ignoring auth state change - login is checking the collector profile');
            return;
          }

          const user = session?.user || null;
          
          if (user) {
            logger.debug('User authenticated:', user.id);
            setUser(user);
            setHasLoggedOut(false); // Clear logout flag when legitimately signing in
          } else {
            logger.debug('No session found, clearing user state');
            setUser(null);
          }
        } catch (err) {
          // Handle invalid refresh token errors during state changes
          if (err.message?.includes('refresh_token_not_found') || 
              err.message?.includes('Invalid Refresh Token')) {
            logger.warn('🧹 Auth state change error - clearing invalid tokens');
            
            try {
              Object.keys(localStorage).forEach(key => {
                if (key.includes('supabase') || key.includes('sb-')) {
                  localStorage.removeItem(key);
                }
              });
              await supabase.auth.signOut();
            } catch (cleanupError) {
              logger.error('Cleanup failed:', cleanupError);
            }
          }
          
          setUser(null);
        }
      }
    );
    
    // Clean up subscription on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, []);
  
  // Load the collector profile for a user. Returns the fetch result so callers
  // (login) can act on it; also updates the shared context state.
  const loadProfile = useCallback(async (userId) => {
    const requestId = ++profileRequestRef.current;
    setProfileLoadState(PROFILE_STATE.LOADING);
    const result = await authService.getUserProfile(userId);
    if (requestId !== profileRequestRef.current) return result; // superseded

    if (result.success) {
      setProfile(result.profile);
      setProfileLoadState(getProfileState(result.profile));
    } else if (result.notFound) {
      setProfile(null);
      setProfileLoadState(PROFILE_STATE.MISSING);
    } else {
      setProfile(null);
      setProfileLoadState(PROFILE_STATE.ERROR);
    }
    setProfileUserId(userId);
    return result;
  }, []);

  const refreshProfile = useCallback(
    () => (user?.id ? loadProfile(user.id) : Promise.resolve(null)),
    [user?.id, loadProfile]
  );

  // Load the profile whenever the signed-in user changes
  useEffect(() => {
    if (!user?.id) {
      profileRequestRef.current++;
      setProfile(null);
      setProfileUserId(null);
      setProfileLoadState(PROFILE_STATE.IDLE);
      return;
    }
    if (profileUserId !== user.id) {
      loadProfile(user.id);
    }
  }, [user?.id, profileUserId, loadProfile]);

  // Until the current user's profile has loaded, report LOADING
  const profileState = user?.id && profileUserId !== user.id
    ? PROFILE_STATE.LOADING
    : profileLoadState;

  // Only a complete, active collector may go On-Duty
  useEffect(() => {
    statusService.setOnlineEligibility(profileState === PROFILE_STATE.READY);
  }, [profileState]);

  // Send OTP code. Accounts are only created when allowCreate is true (sign-up).
  const sendOtp = async (phoneNumber, { allowCreate = false } = {}) => {
    try {
      setLoading(true);
      const result = await authService.sendOtp(phoneNumber, { allowCreate });
      
      if (!result.success) {
        if (!allowCreate && isSignupDisallowedError(result.error)) {
          return { success: false, noAccount: true, error: NO_ACCOUNT_MESSAGE };
        }
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

  // Login step 1: only text a code to numbers that belong to a collector
  const sendLoginOtp = async (phoneNumber) => {
    const check = await authService.isRegisteredCollectorPhone(phoneNumber);
    if (check.success && !check.registered) {
      return { success: false, noAccount: true, error: NO_ACCOUNT_MESSAGE };
    }
    // If the check itself failed (e.g. offline), fall through: sendOtp still
    // refuses to create an account, and login() checks the profile afterwards.
    return sendOtp(phoneNumber, { allowCreate: false });
  };
  
  // Verify OTP and sign in
  const login = async (phoneNumber, otp) => {
    try {
      setLoading(true);
      verifyingLoginRef.current = true;
      const { success, user, error } = await authService.verifyOtp(phoneNumber, otp);
      
      if (!success) {
        throw new Error(error || 'Failed to verify OTP');
      }

      // A code alone is not enough: the number must belong to a collector
      const profileResult = await loadProfile(user.id);
      if (profileResult.notFound) {
        logger.warn('🚫 Signed-in user has no collector profile - signing out');
        await authService.signOut();
        return { success: false, noAccount: true, error: NO_ACCOUNT_MESSAGE };
      }

      // New sessions always start Off-Duty, on this device and on the server
      statusService.forceOffline();
      statusService.setServerDuty(false);
      
      // Store login time for 24-hour session tracking
      const loginTime = Date.now();
      localStorage.setItem('last_login_time', loginTime.toString());
      logger.info('🕐 Login time stored:', new Date(loginTime).toISOString());
      
      // Reset logout flag and set user after successful verification
      setHasLoggedOut(false);
      localStorage.removeItem('user_logged_out');
      
      // Clear signup flag - login means user already has an account
      localStorage.removeItem('is_completing_signup');
      setIsCompletingSignup(false);
      
      setUser(user);
      logger.debug('User verified successfully, logout flag cleared');
      return { success: true, user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      verifyingLoginRef.current = false;
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
      const isVolunteer = userData.collector_type === COLLECTOR_TYPE.VOLUNTEER;

      // Route guard shows "Checking your account..." until the profile is saved
      profileRequestRef.current++;
      setProfileUserId(user.id);
      setProfileLoadState(PROFILE_STATE.LOADING);
      
      // Create user profile with additional data
      // EMAIL STRATEGY: Auto-generate from phone number (no email collection in signup form)
      // Priority: 1) Supabase session email, 2) phone number, 3) generated {phone}@trashdrop.app
      // This approach is intentional - collectors primarily use phone-based communication
      const profileData = {
        user_id: user.id,
        email: user.email || user.phone || `${user.phone}@trashdrop.app`,
        first_name: userData.first_name,
        last_name: userData.last_name,
        phone: userData.phone,
        region: userData.region,
        preferred_language: userData.preferred_language || 'tw',
        id_type: userData.id_type,
        id_front_photo_url: userData.id_front_photo_url,
        id_back_photo_url: userData.id_back_photo_url,
        // Volunteer clean-up groups have no vehicle
        vehicle_type: isVolunteer ? null : (userData.vehicle_type?.toLowerCase() || 'motorcycle'), // Normalize to lowercase for CHECK constraint
        license_plate: userData.license_plate,
        vehicle_color: userData.vehicle_color,
        vehicle_photo_url: userData.vehicle_photo_url,
        company_id: userData.company_id,
        company_name: userData.company_name,
        role: userData.role?.toLowerCase() || 'driver', // Normalize to lowercase
        ...(isVolunteer ? { collector_type: COLLECTOR_TYPE.VOLUNTEER } : {})
      };
      
      let { success: profileSuccess, profile: createdProfile, error: profileError } = 
        await authService.createUserProfile(user.id, profileData);
      
      // If preferred_language column doesn't exist yet, retry without it
      if (!profileSuccess && profileError?.includes('preferred_language')) {
        logger.warn('⚠️ preferred_language column not found, creating profile without it');
        const { preferred_language, ...dataWithoutLang } = profileData;
        ({ success: profileSuccess, profile: createdProfile, error: profileError } = 
          await authService.createUserProfile(user.id, dataWithoutLang));
      }
      
      if (!profileSuccess) {
        throw new Error(profileError || 'Failed to create user profile');
      }

      // A volunteer group asks TrashDrop for Volunteer access; until an admin
      // approves it the group can sign in but not claim reports
      if (isVolunteer && userData.volunteer_request) {
        try {
          await requestVolunteerAccess(userData.volunteer_request);
        } catch (requestError) {
          logger.warn('⚠️ Volunteer access request failed; the group can send it again from the Claim tab:', requestError.message);
        }
      }

      // Share the new profile so the route guard lets the collector in
      profileRequestRef.current++;
      setProfile(createdProfile);
      setProfileLoadState(getProfileState(createdProfile));
      setProfileUserId(user.id);
      
      // Store login time for 24-hour session tracking
      const loginTime = Date.now();
      localStorage.setItem('last_login_time', loginTime.toString());
      logger.info('🕐 Signup login time stored:', new Date(loginTime).toISOString());
      
      // Reset logout flag and set user
      setHasLoggedOut(false);
      localStorage.removeItem('user_logged_out');
      
      // Clear signup flag - signup is complete
      localStorage.removeItem('is_completing_signup');
      setIsCompletingSignup(false);
      
      setUser(user);
      logger.info('✅ User signup completed successfully - profile created');
      return { success: true, user };
    } catch (err) {
      logger.error('❌ Signup error:', err.message);
      setError(err.message);
      // Re-check what the database actually holds for this user
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) loadProfile(session.user.id);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };
  
  // Sign out
  const logout = async () => {
    try {
      setLoading(true);
      logger.debug('Logging out user...');
      // Stop sharing location with the user of any job still in progress
      locationBroadcast.stopTracking();
      // Go Off-Duty on the server while the session can still write
      await statusService.setServerDuty(false);
      const { success, error } = await authService.signOut();
      
      if (!success) {
        throw new Error(error || 'Failed to sign out');
      }
      
      // Clear login time
      localStorage.removeItem('last_login_time');

      // Never carry On-Duty over to whoever signs in next
      statusService.forceOffline();
      // Job lists saved for offline use belong to this collector only
      clearAllJobs();
      
      // Clear signup flag if user was in the middle of signup
      localStorage.removeItem('is_completing_signup');
      setIsCompletingSignup(false);
      
      // Set logout flag to prevent automatic session restoration
      setHasLoggedOut(true);
      
      // Save logout state to localStorage to persist across refreshes
      localStorage.setItem('user_logged_out', 'true');
      
      // Clear user from state
      setUser(null);
      
      logger.info('✅ User logged out successfully, session cleared, logout flag set');
      
      // Force a small delay to ensure state changes propagate
      // before the navigation happens
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return { success: true };
    } catch (err) {
      logger.error('Logout error:', err);
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
    sendLoginOtp,
    login,
    signup,
    logout,
    hasLoggedOut,
    isAuthenticated: !!user,
    hasInitiallyChecked, // Expose initial check status
    profile,
    profileState,
    refreshProfile,
    isCompletingSignup,
    setIsCompletingSignup: (value) => {
      setIsCompletingSignup(value);
      if (value) {
        localStorage.setItem('is_completing_signup', 'true');
      } else {
        localStorage.removeItem('is_completing_signup');
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
