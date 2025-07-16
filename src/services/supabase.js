import { createClient } from '@supabase/supabase-js';

// These will be replaced with environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Development mode to bypass actual SMS sending
// Set to true during development/testing to avoid Twilio errors
const DEV_MODE = true;

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
          
          // Store in localStorage for persistence across page refreshes
          localStorage.setItem('dev_mode_session', JSON.stringify(mockSession));
          
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
    try {
      // Check if we have a dev mode session in localStorage
      if (DEV_MODE) {
        const devSession = localStorage.getItem('dev_mode_session');
        if (devSession) {
          const session = JSON.parse(devSession);
          console.log('[DEV MODE] Retrieved session from localStorage:', session);
          return { session: session, user: session.user };
        }
      }
      
      // Real Supabase call
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return { session: data.session, user: data.session?.user || null };
    } catch (error) {
      console.error('Error getting session:', error);
      return { session: null, user: null, error: error.message };
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
