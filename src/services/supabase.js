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
      
      // Real Supabase call - send OTP via SMS
      // Note: Sender ID must be configured in Supabase Dashboard → Auth → SMS Provider
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          // Channel can be 'sms' or 'whatsapp'
          channel: 'sms',
          // Data can include custom variables for SMS template
          data: {
            app_name: 'TrashDrop'
          }
        }
      });
      
      if (error) throw error;
      console.log('✅ OTP sent successfully to:', formattedPhone);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error sending OTP:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Verify OTP
  verifyOtp: async (phoneNumber, otp) => {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      // Real Supabase call - verify OTP code
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms'
      });
      
      if (error) throw error;
      console.log('✅ OTP verified successfully for:', formattedPhone);
      return { success: true, session: data.session, user: data.user };
    } catch (error) {
      console.error('❌ Error verifying OTP:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Get current user session - OPTIMIZED for immediate startup
  getSession: async () => {
    console.time('[AuthService] getSession Duration');
    console.log('[AuthService] getSession called at:', Date.now());
    
    // CRITICAL: Return immediately if in non-production mode
    if (DEV_MODE) {
      console.log('⚡ DEV_MODE: Returning session immediately for startup optimization');
      const devSession = localStorage.getItem('dev_mode_session');
      if (devSession) {
        try {
          const session = JSON.parse(devSession);
          console.timeEnd('[AuthService] getSession Duration');
          return { session: session, user: session.user };
        } catch (e) {
          localStorage.removeItem('dev_mode_session');
        }
      }
      console.timeEnd('[AuthService] getSession Duration');
      return { session: null, user: null };
    }
    
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
  // If profile already exists, update it instead (useful for testing/re-registration)
  createUserProfile: async (userId, profileData) => {
    try {
      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('collector_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      if (existingProfile) {
        // Profile exists - update it
        console.log('⚠️ Profile already exists for user, updating instead:', userId);
        const { data, error } = await supabase
          .from('collector_profiles')
          .update(profileData)
          .eq('user_id', userId)
          .select();
        
        if (error) throw error;
        console.log('✅ Profile updated successfully for user:', userId);
        return { success: true, profile: data[0] };
      } else {
        // Profile doesn't exist - create new one
        const { data, error } = await supabase
          .from('collector_profiles')
          .insert([{ user_id: userId, ...profileData }])
          .select();
        
        if (error) throw error;
        console.log('✅ Profile created successfully for user:', userId);
        return { success: true, profile: data[0] };
      }
    } catch (error) {
      console.error('❌ Error creating/updating profile:', error);
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
  },
  
  // Upload photo to Supabase Storage
  uploadPhoto: async (file, type) => {
    try {
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}_${timestamp}.${fileExt}`;
      const filePath = `collector-documents/${fileName}`;
      
      console.log(`📤 Uploading ${type} photo...`);
      
      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from('collector-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('collector-photos')
        .getPublicUrl(filePath);
      
      console.log(`✅ ${type} photo uploaded successfully:`, publicUrl);
      return { success: true, url: publicUrl };
    } catch (error) {
      console.error(`❌ Error uploading ${type} photo:`, error);
      return { success: false, error: error.message };
    }
  }
};

// Export the supabase client
export { supabase };
