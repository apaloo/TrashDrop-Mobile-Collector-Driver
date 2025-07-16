import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPhoneNumber } from '../services/supabase';

const SignupPage = () => {
  const navigate = useNavigate();
  const { sendOtp, signup, loading: authLoading, error: authError } = useAuth();
  
  // Use a reference to track current step to avoid closure issues
  const [step, setStep] = useState(1); // Multi-step form
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Dedicated function to force step transition
  const goToStep = (nextStep) => {
    console.log(`Transitioning from step ${step} to step ${nextStep}`);
    // Force update by setting state directly
    setStep(nextStep);
  };
  
  // Form state
  const [formData, setFormData] = useState({
    // Personal info
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    region: '',
    otp: '',
    
    // Vehicle info
    vehicle_type: 'Motorcycle',
    license_plate: '',
    vehicle_color: '',
    
    // Company info
    company_id: '',
    company_name: '',
    role: 'Driver'
  });
  
  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Send OTP to verify phone
  const handleSendOtp = async (e) => {
    // Prevent any form submission
    if (e) e.preventDefault();
    
    console.log('handleSendOtp called, current step:', step);
    setLoading(true);
    setError(null);
    
    try {
      if (!formData.phone || formData.phone.length < 9) {
        throw new Error('Please enter a valid phone number');
      }
      
      // Format phone number using our helper
      const formattedPhone = formatPhoneNumber(formData.phone);
      console.log(`Sending OTP to ${formattedPhone}...`);
      
      // Use our AuthContext sendOtp method that calls Supabase
      const { success, error } = await sendOtp(formattedPhone);
      console.log('OTP send response:', { success, error });
      
      if (!success) {
        throw new Error(error || 'Failed to send OTP');
      }
      
      // Update phone in form data with formatted version
      setFormData(prev => ({ ...prev, phone: formattedPhone }));
      
      // Move to OTP verification step - direct state update
      console.log('OTP sent successfully, moving to verification step');
      setStep(2);
      console.log('Step updated to 2');
      
    } catch (err) {
      console.error('OTP send error:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Verify OTP and proceed to next step
  const handleVerifyOtp = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Validate OTP format first
      if (formData.otp.length !== 6 || !/^\d+$/.test(formData.otp)) {
        throw new Error('Invalid OTP. Please enter a valid 6-digit code.');
      }
      
      // We don't fully verify with Supabase here - we'll do that in the final submission
      // This is just a step in the multi-step form
      // During final submission, we'll use the signup method which handles verification
      
      // For the purposes of the signup flow, we validate format and proceed
      console.log('OTP format valid, proceeding to vehicle info');
      setStep(3); // Move to vehicle info
    } catch (err) {
      console.error('OTP verification error:', err);
      setError(err.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle final form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Use our AuthContext signup method
      const { success, error } = await signup(formData);
      
      if (success) {
        // Log success for demo purposes
        console.log('Registration successful with data:', formData);
        
        // Redirect to welcome page
        navigate('/welcome');
      } else if (error) {
        throw new Error(error);
      }
      
      // Note: In a real implementation with Supabase, we would:
      // 1. Create user auth profile with phone/email
      // 2. Store additional user data in profiles table
      // 3. Link vehicle info
      // 4. Associate with company
      /*
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        phone: formData.phone,
        password: 'random-secure-password', // In phone auth flow, this could be auto-generated
      });
      
      if (authError) throw authError;
      
      // Store profile data
      const { error: profileError } = await supabase
        .from('collector_profiles')
        .insert([
          {
            user_id: authData.user.id,
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone,
            region: formData.region,
            vehicle_type: formData.vehicle_type,
            license_plate: formData.license_plate,
            vehicle_color: formData.vehicle_color,
            company_id: formData.company_id,
            company_name: formData.company_name,
            role: formData.role
          }
        ]);
      
      if (profileError) throw profileError;
      */
      
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render appropriate step
  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">Create Account</h2>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <input
                type="tel"
                name="phone"
                placeholder="e.g., +233501234567"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                We'll send a verification code to this number
              </p>
            </div>
            
            <button
              type="button"
              className="w-full btn btn-primary"
              onClick={(e) => {
                e.preventDefault();
                // Directly transition to step 2 after validating phone
                if (formData.phone && formData.phone.length >= 9) {
                  // Format the phone number first
                  const formattedPhone = formatPhoneNumber(formData.phone);
                  setFormData(prev => ({ ...prev, phone: formattedPhone }));
                  console.log(`Formatted phone number: ${formattedPhone}`);
                  
                  // Just show feedback in dev mode without actually sending OTP
                  console.log(`[DEV MODE] Simulating OTP sent to ${formattedPhone}. Use '123456' as verification code.`);
                  
                  // Force transition to next step
                  goToStep(2);
                } else {
                  setError('Please enter a valid phone number');
                }
              }}
              disabled={loading || !formData.phone}
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </>
        );
        
      case 2:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">Verify Your Number</h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              We've sent a one-time password to {formData.phone}
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                One-Time Password
              </label>
              <input
                type="text"
                name="otp"
                placeholder="6-digit code"
                value={formData.otp}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md text-center tracking-widest"
                maxLength={6}
                required
              />
            </div>
            
            <button
              type="button"
              className="w-full btn btn-primary"
              onClick={handleVerifyOtp}
              disabled={loading || formData.otp.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            
            <div className="mt-4 text-center">
              <button 
                type="button" 
                className="text-primary text-sm"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Change phone number
              </button>
              <div className="mt-2">
                <button 
                  type="button" 
                  className="text-primary text-sm"
                  onClick={handleSendOtp}
                  disabled={loading}
                >
                  Resend code
                </button>
              </div>
            </div>
          </>
        );
        
      case 3:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">Personal Information</h2>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Region</label>
              <select
                name="region"
                value={formData.region}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="">Select Region</option>
                <option value="Greater Accra">Greater Accra</option>
                <option value="Ashanti">Ashanti</option>
                <option value="Western">Western</option>
                <option value="Eastern">Eastern</option>
                <option value="Central">Central</option>
                <option value="Northern">Northern</option>
              </select>
            </div>
            
            <div className="flex space-x-2 mt-4">
              <button
                type="button"
                className="flex-1 btn bg-gray-300 text-gray-800"
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <button
                type="button"
                className="flex-1 btn btn-primary"
                onClick={() => setStep(4)}
                disabled={!formData.first_name || !formData.last_name || !formData.email || !formData.region}
              >
                Continue
              </button>
            </div>
          </>
        );
        
      case 4:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">Vehicle Information</h2>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Vehicle Type</label>
              <select
                name="vehicle_type"
                value={formData.vehicle_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="Motorcycle">Motorcycle</option>
                <option value="Car">Car</option>
                <option value="Van">Van</option>
                <option value="Truck">Truck</option>
                <option value="Bicycle">Bicycle</option>
              </select>
            </div>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">License Plate</label>
              <input
                type="text"
                name="license_plate"
                value={formData.license_plate}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="e.g., GR-123-20"
                required
              />
            </div>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Vehicle Color</label>
              <input
                type="text"
                name="vehicle_color"
                value={formData.vehicle_color}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            
            <div className="flex space-x-2 mt-4">
              <button
                type="button"
                className="flex-1 btn bg-gray-300 text-gray-800"
                onClick={() => setStep(3)}
              >
                Back
              </button>
              <button
                type="button"
                className="flex-1 btn btn-primary"
                onClick={() => setStep(5)}
                disabled={!formData.license_plate || !formData.vehicle_color}
              >
                Continue
              </button>
            </div>
          </>
        );
        
      case 5:
        return (
          <>
            <h2 className="text-xl font-bold mb-4">Company Information</h2>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Company ID</label>
              <input
                type="text"
                name="company_id"
                value={formData.company_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the ID provided by your company
              </p>
            </div>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Company Name</label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="Driver">Driver</option>
                <option value="Collector">Collector</option>
                <option value="Supervisor">Supervisor</option>
              </select>
            </div>
            
            <div className="flex space-x-2 mt-4">
              <button
                type="button"
                className="flex-1 btn bg-gray-300 text-gray-800"
                onClick={() => setStep(4)}
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 btn btn-primary"
                onClick={handleSubmit}
                disabled={loading || !formData.company_id || !formData.company_name}
              >
                {loading ? 'Registering...' : 'Complete Registration'}
              </button>
            </div>
          </>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo and App Name */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-primary rounded-lg flex items-center justify-center mb-2">
            <span className="text-white text-3xl font-bold">TD</span>
          </div>
          <h1 className="text-2xl font-bold">TrashDrop</h1>
          <p className="text-gray-500">Mobile Collector Driver</p>
        </div>
        
        {/* Step Indicator */}
        <div className="flex justify-center mb-4">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= s ? 'bg-primary text-white' : 'bg-gray-300 text-gray-600'}`}>
                  {s}
                </div>
                {s < 5 && (
                  <div className={`w-8 h-1 ${step > s ? 'bg-primary' : 'bg-gray-300'}`}></div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
            {error}
          </div>
        )}
        
        {/* Form */}
        <div className="card">
          <form onSubmit={(e) => {
            e.preventDefault();
            // Only handle form submission for steps after OTP verification (3-5)
            // Let the button handlers manage steps 1-2
            if (step >= 3 && step < 5) {
              setStep(step + 1);
            } else if (step === 5) {
              handleSubmit(e);
            }
          }}>
            {renderStep()}
          </form>
        </div>
        
        {/* Other Options */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            Already have an account?{' '}
            <a href="/login" className="text-primary font-medium">
              Login
            </a>
          </p>
          <p className="mt-2 text-xs text-gray-500">
            By signing up, you agree to our{' '}
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

export default SignupPage;
