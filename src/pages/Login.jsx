import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPhoneNumber } from '../services/supabase';
import logo from '../assets/logo.svg';

const LoginPage = () => {
  const navigate = useNavigate();
  const { sendOtp, login, loading: authLoading, error: authError } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Force transition to OTP verification
  const goToOtpVerification = () => {
    console.log('Transitioning to OTP verification screen');
    setOtpSent(true);
  };

  // Send OTP to phone number
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Format phone number using our helper
      const formattedPhone = formatPhoneNumber(phoneNumber);
      console.log(`Sending OTP to ${formattedPhone}...`);
      
      // Use our AuthContext sendOtp method that calls Supabase
      const { success, error } = await sendOtp(formattedPhone);
      
      if (!success) {
        throw new Error(error || 'Failed to send OTP');
      }
      
      // OTP sent successfully, move to verification step
      setOtpSent(true);
      console.log('OTP sent successfully');
    } catch (err) {
      console.error('OTP send error:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Validate OTP format
      if (otp.length !== 6 || !/^\d+$/.test(otp)) {
        throw new Error('Invalid OTP. Please enter a valid 6-digit code.');
      }
      
      // Format phone number consistently
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      // Use our AuthContext login method which now uses real Supabase verification
      const { success, user, error } = await login(formattedPhone, otp);
      
      if (success) {
        console.log('OTP verification successful:', user);
        // Navigate to map page after successful login
        navigate('/map');
      } else if (error) {
        throw new Error(error);
      }
    } catch (err) {
      console.error('OTP verification error:', err);
      setError(err.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-4">
      <div className="w-full max-w-md animate-slideUp">
        {/* Logo and App Name */}
        <div className="flex flex-col items-center mb-8 animate-fadeIn">
          <img 
            src={logo} 
            alt="TrashDrop Logo" 
            className="w-24 h-24 rounded-xl shadow-lg mb-3 transform hover:scale-105 transition-transform"
          />
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">TrashDrop</h1>
          <p className="text-gray-600 dark:text-gray-300">TrashDrop Collector</p>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md shadow-sm dark:bg-red-900/20 dark:border-red-600 dark:text-red-400 flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        
        {!otpSent ? (
          /* Phone Number Form */
          <div className="card shadow-lg border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-6 text-center text-gray-800 dark:text-white">Login with Phone</h2>
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="mb-6">
                <label htmlFor="phoneNumber" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                  </div>
                  <input
                    id="phoneNumber"
                    type="tel"
                    placeholder="e.g., +233501234567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white transition-colors"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 pl-2">
                  Enter your phone number with country code
                </p>
              </div>
              
              <button
                type="button"
                className="w-full btn btn-primary py-3 text-base font-medium rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-150"
                disabled={loading || !phoneNumber}
                onClick={(e) => {
                  e.preventDefault();
                  // Validate and format phone number
                  if (phoneNumber && phoneNumber.length >= 9) {
                    const formattedPhone = formatPhoneNumber(phoneNumber);
                    setPhoneNumber(formattedPhone);
                    console.log(`[DEV MODE] Simulating OTP sent to ${formattedPhone}. Use '123456' as verification code.`);
                    goToOtpVerification();
                  } else {
                    setError('Please enter a valid phone number');
                  }
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </span>
                ) : 'Send OTP'}
              </button>
            </form>
          </div>
        ) : (
          /* OTP Verification Form */
          <div className="card shadow-lg border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-6 text-center text-gray-800 dark:text-white">Enter OTP</h2>
            <div className="flex items-center justify-center mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-full p-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-300 text-center">
              We've sent a one-time password to <span className="font-medium text-gray-800 dark:text-gray-200">{phoneNumber}</span>
            </p>
            
            <form onSubmit={handleVerifyOtp}>
              <div className="mb-6">
                <label htmlFor="otp" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  One-Time Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    id="otp"
                    type="text"
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-center tracking-widest focus:ring-2 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white transition-colors"
                    maxLength={6}
                    required
                  />
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full btn btn-primary py-3 text-base font-medium rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-150"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying...
                  </span>
                ) : 'Verify & Login'}
              </button>
              
              <div className="mt-6 flex flex-col items-center space-y-3">
                <button 
                  type="button" 
                  className="text-primary text-sm hover:text-primary-dark transition-colors flex items-center"
                  onClick={() => setOtpSent(false)}
                  disabled={loading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Change phone number
                </button>
                <button 
                  type="button" 
                  className="text-primary text-sm hover:text-primary-dark transition-colors flex items-center"
                  onClick={handleSendOtp}
                  disabled={loading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Resend OTP
                </button>
              </div>
            </form>
          </div>
        )}
        
        {/* Other Options */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            Don't have an account?{' '}
            <a href="/signup" className="text-primary font-medium">
              Sign up
            </a>
          </p>
          <p className="mt-2 text-xs text-gray-500">
            By continuing, you agree to our{' '}
            <a href="/terms" className="text-primary">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-primary">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
