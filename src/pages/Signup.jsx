import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPhoneNumber, authService } from '../services/supabase';
import { logger } from '../utils/logger';

const SignupPage = () => {
  const navigate = useNavigate();
  const { sendOtp, signup, loading: authLoading, error: authError } = useAuth();
  
  // Use a reference to track current step to avoid closure issues
  const [step, setStep] = useState(1); // Multi-step form
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Dedicated function to force step transition
  const goToStep = (nextStep) => {
    logger.debug(`Transitioning from step ${step} to step ${nextStep}`);
    // Force update by setting state directly
    setStep(nextStep);
  };
  
  // Form state
  const [formData, setFormData] = useState({
    // Personal info
    first_name: '',
    last_name: '',
    phone: '',
    region: '',
    otp: '',
    
    // ID Verification
    id_type: 'Ghana Card',
    id_front_photo: null,
    id_back_photo: null,
    
    // Vehicle info
    vehicle_type: 'Motorcycle',
    license_plate: '',
    vehicle_color: '',
    vehicle_photo: null,
    
    // Company info
    company_id: '',
    company_name: '',
    role: 'Driver'
  });
  
  // File preview URLs
  const [previewUrls, setPreviewUrls] = useState({
    id_front: null,
    id_back: null,
    vehicle: null
  });
  
  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle camera capture
  const handleCameraCapture = (e, fieldName, previewKey) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please capture an image using your camera');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        [fieldName]: file
      }));
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrls(prev => ({
          ...prev,
          [previewKey]: reader.result
        }));
      };
      reader.readAsDataURL(file);
      
      setError(null);
      logger.debug(`📸 Photo captured for ${fieldName}`);
    }
  };
  
  // Trigger camera capture
  const triggerCamera = (inputRef) => {
    inputRef.current?.click();
  };
  
  // Send OTP to verify phone
  const handleSendOtp = async (e) => {
    // Prevent any form submission
    if (e) e.preventDefault();
    
    logger.debug('handleSendOtp called, current step:', step);
    setLoading(true);
    setError(null);
    
    try {
      if (!formData.phone || formData.phone.length < 9) {
        throw new Error('Please enter a valid phone number');
      }
      
      // Format phone number using our helper
      const formattedPhone = formatPhoneNumber(formData.phone);
      logger.debug(`Sending OTP to ${formattedPhone}...`);
      
      // Use our AuthContext sendOtp method that calls Supabase
      const { success, error } = await sendOtp(formattedPhone);
      logger.debug('OTP send response:', { success, error });
      
      if (!success) {
        throw new Error(error || 'Failed to send OTP');
      }
      
      // Update phone in form data with formatted version
      setFormData(prev => ({ ...prev, phone: formattedPhone }));
      
      // Move to OTP verification step - direct state update
      logger.debug('OTP sent successfully, moving to verification step');
      setStep(2);
      logger.debug('Step updated to 2');
      
    } catch (err) {
      logger.error('OTP send error:', err);
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
      
      // CRITICAL: Verify OTP with Supabase directly (without setting user in context)
      // This authenticates the user and creates their session in Supabase
      // BUT we don't update AuthContext yet - that happens after profile creation
      logger.debug('Verifying OTP with Supabase...');
      const { success, error: verifyError } = await authService.verifyOtp(formData.phone, formData.otp);
      
      if (!success) {
        throw new Error(verifyError || 'Invalid verification code. Please try again.');
      }
      
      // OTP verified successfully - user is now authenticated in Supabase
      // Session exists, but we haven't set user in AuthContext yet
      logger.info('✅ OTP verified successfully - Supabase session created');
      logger.debug('📝 User can now proceed to fill profile information');
      setStep(3); // Move to personal info
    } catch (err) {
      logger.error('❌ OTP verification error:', err);
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
      logger.debug('📤 Starting file uploads...');
      
      // Upload photos to Supabase Storage
      const photoUrls = {
        id_front_photo_url: null,
        id_back_photo_url: null,
        vehicle_photo_url: null
      };
      
      // Upload ID front photo
      if (formData.id_front_photo) {
        const result = await authService.uploadPhoto(formData.id_front_photo, 'id_front');
        if (!result.success) throw new Error('Failed to upload ID front photo');
        photoUrls.id_front_photo_url = result.url;
      }
      
      // Upload ID back photo
      if (formData.id_back_photo) {
        const result = await authService.uploadPhoto(formData.id_back_photo, 'id_back');
        if (!result.success) throw new Error('Failed to upload ID back photo');
        photoUrls.id_back_photo_url = result.url;
      }
      
      // Upload vehicle photo
      if (formData.vehicle_photo) {
        const result = await authService.uploadPhoto(formData.vehicle_photo, 'vehicle');
        if (!result.success) throw new Error('Failed to upload vehicle photo');
        photoUrls.vehicle_photo_url = result.url;
      }
      
      logger.debug('✅ All photos uploaded successfully');
      
      // Prepare signup data (without email, with photo URLs)
      const signupData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        region: formData.region,
        id_type: formData.id_type,
        ...photoUrls,
        vehicle_type: formData.vehicle_type,
        license_plate: formData.license_plate,
        vehicle_color: formData.vehicle_color,
        company_id: formData.company_id,
        company_name: formData.company_name,
        role: formData.role
      };
      
      // Use our AuthContext signup method
      const { success, error } = await signup(signupData);
      
      if (success) {
        // Log success for demo purposes
        logger.info('✅ Registration successful with data:', signupData);
        
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
              onClick={handleSendOtp}
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
            <h2 className="text-xl font-bold mb-4">ID Verification</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              📸 Use your camera to capture clear photos of your ID
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">ID Type</label>
              <select
                name="id_type"
                value={formData.id_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="Ghana Card">Ghana Card</option>
                <option value="Passport">Passport</option>
                <option value="Voters ID">Voters ID</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            {/* ID Front Photo */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Front View of ID Card</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleCameraCapture(e, 'id_front_photo', 'id_front')}
                className="hidden"
                id="id-front-camera"
                required
              />
              {!previewUrls.id_front ? (
                <button
                  type="button"
                  onClick={() => document.getElementById('id-front-camera').click()}
                  className="w-full py-12 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary transition-colors bg-gray-50 hover:bg-gray-100 flex flex-col items-center justify-center"
                >
                  <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-600 font-medium">Capture ID Front</span>
                  <span className="text-xs text-gray-500 mt-1">Tap to open camera</span>
                </button>
              ) : (
                <div className="relative">
                  <img 
                    src={previewUrls.id_front} 
                    alt="ID Front" 
                    className="w-full h-48 object-cover rounded-md border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrls(prev => ({ ...prev, id_front: null }));
                      setFormData(prev => ({ ...prev, id_front_photo: null }));
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById('id-front-camera').click()}
                    className="mt-2 w-full py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retake Photo
                  </button>
                </div>
              )}
            </div>
            
            {/* ID Back Photo */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Back View of ID Card</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleCameraCapture(e, 'id_back_photo', 'id_back')}
                className="hidden"
                id="id-back-camera"
                required
              />
              {!previewUrls.id_back ? (
                <button
                  type="button"
                  onClick={() => document.getElementById('id-back-camera').click()}
                  className="w-full py-12 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary transition-colors bg-gray-50 hover:bg-gray-100 flex flex-col items-center justify-center"
                >
                  <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-600 font-medium">Capture ID Back</span>
                  <span className="text-xs text-gray-500 mt-1">Tap to open camera</span>
                </button>
              ) : (
                <div className="relative">
                  <img 
                    src={previewUrls.id_back} 
                    alt="ID Back" 
                    className="w-full h-48 object-cover rounded-md border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrls(prev => ({ ...prev, id_back: null }));
                      setFormData(prev => ({ ...prev, id_back_photo: null }));
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById('id-back-camera').click()}
                    className="mt-2 w-full py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retake Photo
                  </button>
                </div>
              )}
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
                disabled={!formData.id_front_photo || !formData.id_back_photo}
              >
                Continue
              </button>
            </div>
          </>
        );
        
      case 4:
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
                onClick={() => setStep(3)}
              >
                Back
              </button>
              <button
                type="button"
                className="flex-1 btn btn-primary"
                onClick={() => setStep(5)}
                disabled={!formData.first_name || !formData.last_name || !formData.region}
              >
                Continue
              </button>
            </div>
          </>
        );
        
      case 5:
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
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Vehicle Photo</label>
              <p className="text-xs text-gray-500 mb-2">
                📸 Use your camera to capture a clear photo of your vehicle
              </p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleCameraCapture(e, 'vehicle_photo', 'vehicle')}
                className="hidden"
                id="vehicle-camera"
                required
              />
              {!previewUrls.vehicle ? (
                <button
                  type="button"
                  onClick={() => document.getElementById('vehicle-camera').click()}
                  className="w-full py-12 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary transition-colors bg-gray-50 hover:bg-gray-100 flex flex-col items-center justify-center"
                >
                  <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-600 font-medium">Capture Vehicle Photo</span>
                  <span className="text-xs text-gray-500 mt-1">Tap to open camera</span>
                </button>
              ) : (
                <div className="relative">
                  <img 
                    src={previewUrls.vehicle} 
                    alt="Vehicle" 
                    className="w-full h-48 object-cover rounded-md border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrls(prev => ({ ...prev, vehicle: null }));
                      setFormData(prev => ({ ...prev, vehicle_photo: null }));
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById('vehicle-camera').click()}
                    className="mt-2 w-full py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retake Photo
                  </button>
                </div>
              )}
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
                type="button"
                className="flex-1 btn btn-primary"
                onClick={() => setStep(6)}
                disabled={!formData.license_plate || !formData.vehicle_color || !formData.vehicle_photo}
              >
                Continue
              </button>
            </div>
          </>
        );
        
      case 6:
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
                onClick={() => setStep(5)}
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
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= s ? 'bg-primary text-white' : 'bg-gray-300 text-gray-600'}`}>
                  {s}
                </div>
                {s < 6 && (
                  <div className={`w-6 h-1 ${step > s ? 'bg-primary' : 'bg-gray-300'}`}></div>
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
