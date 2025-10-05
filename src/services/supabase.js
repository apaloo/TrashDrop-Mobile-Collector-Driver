import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Development mode completely disabled to use real Supabase data
export const DEV_MODE = false;

// Create dev mode session data with valid JWT claims
const createDevModeSession = (userId) => {
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const exp = now + 3600; // Expires in 1 hour

  // JWT claims required by Supabase
  const claims = {
    aud: 'authenticated',
    exp,
    sub: userId,
    email: 'dev@example.com',
    phone: '+233123456789',
    role: 'authenticated',
    session_id: 'dev-session',
    // Add required Supabase claims
    iss: 'supabase',
    iat: now,
    // Add project reference from URL
    ref: supabaseUrl.split('.')[0].split('//')[1]
  };

  const user = {
    id: userId,
    aud: claims.aud,
    role: claims.role,
    email: claims.email,
    phone: claims.phone,
    app_metadata: {
      provider: 'phone',
      providers: ['phone']
    },
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Skip token generation - we'll generate it in getSession
  return { user, claims };
};

// Create Supabase client with anon key
const DEV_USER_ID = '6fba1031-839f-4985-a180-9ae0a04b7812';
const devModeData = createDevModeSession(DEV_USER_ID);

// Always use anon key for client operations (realtime requires it)
console.log('🔑 Supabase initialized with: ANON_KEY for client operations');

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey, // Use anon key for all client operations
  {
    auth: {
      autoRefreshToken: !DEV_MODE,
      persistSession: !DEV_MODE,
      detectSessionInUrl: !DEV_MODE
    },
    db: {
      schema: 'public'
    },
    realtime: {
      // Disable realtime in DEV_MODE to prevent WebSocket errors
      enabled: !DEV_MODE
    }
  }
);

// Override auth methods in dev mode
if (DEV_MODE) {
  // Patch the auth object to return dev mode session
  supabase.auth.getSession = async () => {
    // Create a session with our claims
    const session = {
      user: devModeData.user,
      // Use anon key as access token since service key isn't available in client
      access_token: supabaseAnonKey,
      refresh_token: null,
      token_type: 'bearer'
    };

    // Save to localStorage for consistency
    localStorage.setItem('dev_mode_session', JSON.stringify(session));

    return { data: { session }, error: null };
  };

  supabase.auth.getUser = async () => ({
    data: { user: devModeData.user },
    error: null
  });
}

// Helper to format phone number to E.164 format
export const formatPhoneNumber = (phoneNumber) => {
  // Remove any non-digit characters
  let digits = phoneNumber.replace(/\D/g, '');
  
  // Default to Ghana country code for demo purposes if no + prefix
  if (!phoneNumber.startsWith('+')) {
    // Remove leading zeros
    digits = digits.replace(/^0+/, '');
    return `+233${digits}`;
  }
  
  return phoneNumber;
};

// Phone authentication helper methods
export const authService = {
  // Send OTP to phone number
  sendOtp: async (phoneNumber) => {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      // Use mock data in development mode
      if (DEV_MODE) {
        console.log(`[DEV MODE] OTP sent to ${formattedPhone}. Use '123456' as the verification code.`);
        return { 
          success: true, 
          data: { 
            user: null,
            session: null,
            // Store the phone number for later verification
            __devPhone: formattedPhone 
          } 
        };
      }
      
      // Real Supabase call in production
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error sending OTP:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Verify OTP
  verifyOtp: async (phoneNumber, otp) => {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      // Use mock data in development mode
      if (DEV_MODE) {
        // In dev mode, we accept '123456' as the valid OTP
        if (otp === '123456') {
          // Generate a proper UUID format for development mode
          const generateUUID = () => {
            // This creates a RFC4122 compliant UUID
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              const r = Math.random() * 16 | 0,
                    v = c === 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });
          };
          
          const mockUser = {
            id: generateUUID(), // Use a proper UUID format
            phone: formattedPhone,
            role: 'collector',
            app_metadata: {
              provider: 'phone'
            }
          };
          
          console.log(`[DEV MODE] OTP verified successfully for ${formattedPhone}`);
          
          // Create a mock session
          const mockSession = {
            access_token: 'dev-mode-token',
            expires_in: 3600,
            refresh_token: 'dev-mode-refresh-token',
            user: mockUser
          };
          
          // Store in localStorage for persistence
          localStorage.setItem('dev_mode_session', JSON.stringify(mockSession));
          
          // Set headers for dev mode
          supabase.rest.headers.set('x-rls-bypass', 'true');
          supabase.rest.headers.set('x-dev-mode', 'true');
          
          // Set auth session
          supabase.auth.setSession({
            access_token: mockSession.access_token,
            refresh_token: mockSession.refresh_token,
            user: mockUser
          });
          
          return {
            success: true,
            session: mockSession,
            user: mockUser
          };
        } else {
          console.log(`[DEV MODE] Invalid OTP. Expected '123456', got '${otp}'`);
          return {
            success: false,
            error: 'Invalid verification code'
          };
        }
      }
      
      // Real Supabase call in production
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms'
      });
      
      if (error) throw error;
      return { success: true, session: data.session, user: data.user };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Get current user session
  getSession: async () => {
    console.time('[AuthService] getSession Duration');
    console.log('[AuthService] getSession called at:', Date.now());
    
    try {
      // Check if we have a dev mode session in localStorage
      if (DEV_MODE) {
        // First try to get from localStorage
        const devSession = localStorage.getItem('dev_mode_session');
        if (devSession) {
          try {
            const session = JSON.parse(devSession);
            // Ensure the session has the correct access_token
            if (!session.access_token || session.access_token === 'dev-mode-token') {
              // Fix the token to use supabaseAnonKey
              session.access_token = supabaseAnonKey;
              localStorage.setItem('dev_mode_session', JSON.stringify(session));
              console.log('[DEV MODE] Updated session token in localStorage');
            }
            console.log('[DEV MODE] Retrieved session from localStorage:', session);
            return { session: session, user: session.user };
          } catch (e) {
            console.error('Error parsing dev_mode_session:', e);
            // Clear corrupted session data
            localStorage.removeItem('dev_mode_session');
          }
        }
        
        // If no valid dev session in localStorage, create one
        const newSession = {
          user: devModeData.user,
          access_token: supabaseAnonKey,
          refresh_token: null,
          token_type: 'bearer'
        };
        localStorage.setItem('dev_mode_session', JSON.stringify(newSession));
        console.log('[DEV MODE] Created new dev session with proper token');
        return { session: newSession, user: newSession.user };
      }
      
      // Real Supabase call ONLY for non-DEV_MODE (this was causing 15s delays!)
      if (!DEV_MODE) {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return { session: data.session, user: data.session?.user || null };
      }
      
      // If we're in DEV_MODE but somehow reached here, return null session
      console.warn('[DEV MODE] Reached fallback case - returning null session');
      return { session: null, user: null };
    } catch (error) {
      console.error('Error getting session:', error);
      return { session: null, user: null, error: error.message };
    } finally {
      console.timeEnd('[AuthService] getSession Duration');
      console.log('[AuthService] getSession completed at:', Date.now());
    }
  },
  
  // Sign out user
  signOut: async () => {
    try {
      // Handle sign out in development mode
      if (DEV_MODE) {
        localStorage.removeItem('dev_mode_session');
        console.log('[DEV MODE] User signed out successfully');
        return { success: true };
      }
      
      // Real Supabase call in production
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error signing out:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Create a new user profile after authentication
  createUserProfile: async (userId, profileData) => {
    try {
      // Mock profile creation in development mode
      if (DEV_MODE) {
        const mockProfile = {
          id: `profile-${Date.now()}`,
          user_id: userId,
          created_at: new Date().toISOString(),
          ...profileData
        };
        
        console.log('[DEV MODE] Created mock profile:', mockProfile);
        return { success: true, profile: mockProfile };
      }
      
      // Real Supabase call in production
      const { data, error } = await supabase
        .from('collector_profiles')
        .insert([{ user_id: userId, ...profileData }])
        .select();
      
      if (error) throw error;
      return { success: true, profile: data[0] };
    } catch (error) {
      console.error('Error creating profile:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Get user profile
  getUserProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('collector_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      return { success: true, profile: data };
    } catch (error) {
      console.error('Error getting profile:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Update user profile
  updateUserProfile: async (userId, profileData) => {
    try {
      const { data, error } = await supabase
        .from('collector_profiles')
        .update(profileData)
        .eq('user_id', userId)
        .select();
      
      if (error) throw error;
      return { success: true, profile: data[0] };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
  }
};

// Export the supabase client
export { supabase };
