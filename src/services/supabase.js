import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Load environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Initialize Supabase client with anon key for real authentication
logger.info('🔑 Supabase initialized with real authentication');

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    db: {
      schema: 'public'
    },
    realtime: {
      enabled: true
    }
  }
);


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
      logger.info('✅ OTP sent successfully to:', formattedPhone);
      return { success: true, data };
    } catch (error) {
      logger.error('❌ Error sending OTP:', error);
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
      logger.info('✅ OTP verified successfully for:', formattedPhone);
      return { success: true, session: data.session, user: data.user };
    } catch (error) {
      logger.error('❌ Error verifying OTP:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Get current user session
  getSession: async () => {
    const startTime = Date.now();
    logger.debug('[AuthService] getSession called at:', Date.now());
    
    try {
      // Real Supabase call for authentication
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return { session: data.session, user: data.session?.user || null };
    } catch (error) {
      logger.error('Error getting session:', error);
      return { session: null, user: null, error: error.message };
    } finally {
      const duration = Date.now() - startTime;
      logger.debug(`[AuthService] getSession completed in ${duration}ms`);
    }
  },
  
  // Sign out user
  signOut: async () => {
    try {
      // Real Supabase call for sign out
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      logger.info('User signed out successfully');
      return { success: true };
    } catch (error) {
      logger.error('Error signing out:', error);
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
        logger.warn('⚠️ Profile already exists for user, updating instead:', userId);
        const { data, error } = await supabase
          .from('collector_profiles')
          .update(profileData)
          .eq('user_id', userId)
          .select();
        
        if (error) throw error;
        logger.info('✅ Profile updated successfully for user:', userId);
        return { success: true, profile: data[0] };
      } else {
        // Profile doesn't exist - create new one
        // Note: profileData already contains user_id, so we don't duplicate it
        const { data, error } = await supabase
          .from('collector_profiles')
          .insert([profileData])
          .select();
        
        if (error) throw error;
        logger.info('✅ Profile created successfully for user:', userId);
        return { success: true, profile: data[0] };
      }
    } catch (error) {
      logger.error('❌ Error creating/updating profile:', error);
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
      logger.error('Error getting profile:', error);
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
      logger.error('Error updating profile:', error);
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
      
      logger.debug(`📤 Uploading ${type} photo...`);
      
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
      
      logger.info(`✅ ${type} photo uploaded successfully:`, publicUrl);
      return { success: true, url: publicUrl };
    } catch (error) {
      logger.error(`❌ Error uploading ${type} photo:`, error);
      return { success: false, error: error.message };
    }
  }
};

// Export the supabase client
export { supabase };
