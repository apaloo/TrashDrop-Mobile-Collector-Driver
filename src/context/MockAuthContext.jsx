import { createContext, useState, useContext } from 'react';
import { logger } from '../utils/logger';

// Create the mock context
export const AuthContext = createContext();

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Mock Auth provider component that doesn't use Supabase
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Simulated OTP sending
  const sendOtp = async (phoneNumber) => {
    logger.debug(`Mock: Sending OTP to ${phoneNumber}`);
    setLoading(true);
    
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        setLoading(false);
        resolve({ success: true });
      }, 1000);
    });
  };
  
  // Simulated login
  const login = async (phoneNumber, otp) => {
    logger.debug(`Mock: Verifying OTP ${otp} for ${phoneNumber}`);
    setLoading(true);
    
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        // Simple validation - OTP must be 6 digits
        if (!/^\d{6}$/.test(otp)) {
          setError('Invalid OTP format');
          setLoading(false);
          resolve({ success: false, error: 'Invalid OTP format' });
          return;
        }
        
        const mockUser = {
          id: 'mock-user-id',
          phone: phoneNumber,
          created_at: new Date().toISOString()
        };
        
        setUser(mockUser);
        setLoading(false);
        resolve({ success: true, user: mockUser });
      }, 1000);
    });
  };
  
  // Simulated signup
  const signup = async (userData) => {
    logger.debug('Mock: Creating new user with data:', userData);
    setLoading(true);
    
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        const mockUser = {
          id: 'mock-user-id',
          phone: userData.phone,
          created_at: new Date().toISOString(),
          profile: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            email: userData.email
          }
        };
        
        setUser(mockUser);
        setLoading(false);
        resolve({ success: true, user: mockUser });
      }, 1500);
    });
  };
  
  // Simulated logout
  const logout = async () => {
    logger.debug('Mock: Logging out');
    setLoading(true);
    
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        setUser(null);
        setLoading(false);
        resolve({ success: true });
      }, 500);
    });
  };

  const value = {
    user,
    loading,
    error,
    sendOtp,
    login,
    signup,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
