import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPhoneNumber, authService } from '../services/supabase';
import { logger } from '../utils/logger';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../config/languageConfig';

// ─── Plain-language error messages ───────────────────────────────────────────
const friendlyError = (raw = '') => {
  const msg = raw.toLowerCase();
  if (msg.includes('otp') || msg.includes('token') || msg.includes('invalid') || msg.includes('expired'))
    return 'Wrong code. Check your messages and try again.';
  if (msg.includes('phone') || msg.includes('number'))
    return 'Please check your phone number and try again.';
  if (msg.includes('photo') || msg.includes('image') || msg.includes('upload'))
    return 'Photo is too large or unclear. Try taking it again.';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch'))
    return 'No internet connection. Please check your network and try again.';
  if (msg.includes('profile') || msg.includes('database'))
    return 'Something went wrong saving your details. Please try again.';
  return raw || 'Something went wrong. Please try again.';
};

// ─── Milestone step definitions ───────────────────────────────────────────────
const MILESTONES = [
  { step: 1, icon: '📱', label: 'Phone'    },
  { step: 2, icon: '🔑', label: 'Verify'   },
  { step: 3, icon: '🪪', label: 'Your ID'  },
  { step: 4, icon: '👤', label: 'Your Info'},
  { step: 5, icon: '🚛', label: 'Vehicle'  },
  { step: 6, icon: '🏢', label: 'Company'  },
];

// ─── ID type visual options ───────────────────────────────────────────────────
const ID_TYPES = [
  {
    value: 'Ghana Card',
    label: 'Ghana Card',
    icon: (
      /* NIA Ghana Card — green body, gold star stripe, photo box, chip, MRZ */
      <svg viewBox="0 0 72 46" className="w-16 h-10 mb-1" fill="none">
        {/* Card body */}
        <rect width="72" height="46" rx="4" fill="#0a6b3c"/>
        {/* Gold top stripe */}
        <rect x="0" y="0" width="72" height="8" rx="0" fill="#c8a400"/>
        <rect x="0" y="0" width="72" height="4" rx="0" fill="#ffd700"/>
        {/* Ghana flag mini */}
        <rect x="3" y="1" width="5" height="2" fill="#cc0000"/>
        <rect x="3" y="3" width="5" height="2" fill="#ffd700"/>
        <rect x="3" y="5" width="5" height="2" fill="#006b3c"/>
        <polygon points="5.5,2 6.2,4 4.8,4" fill="#000"/>
        {/* Photo placeholder */}
        <rect x="4" y="11" width="16" height="20" rx="2" fill="#1a8a52"/>
        <circle cx="12" cy="17" r="4" fill="#b2dfca" opacity="0.8"/>
        <rect x="6" y="23" width="12" height="6" rx="1" fill="#b2dfca" opacity="0.5"/>
        {/* Chip */}
        <rect x="23" y="11" width="7" height="5" rx="1" fill="#c8a400" opacity="0.9"/>
        <rect x="24" y="12" width="5" height="3" rx="0.5" fill="#ffd700" opacity="0.7"/>
        {/* Text lines */}
        <rect x="23" y="19" width="40" height="2.5" rx="1" fill="#fff" opacity="0.8"/>
        <rect x="23" y="23" width="30" height="2" rx="1" fill="#fff" opacity="0.6"/>
        <rect x="23" y="27" width="22" height="2" rx="1" fill="#fff" opacity="0.5"/>
        {/* MRZ */}
        <rect x="4" y="34" width="64" height="2" rx="1" fill="#ffd700" opacity="0.35"/>
        <rect x="4" y="37" width="64" height="2" rx="1" fill="#ffd700" opacity="0.25"/>
        {/* NIA text */}
        <text x="58" y="44" fontSize="4" fill="#ffd700" fontWeight="bold" opacity="0.9">NIA</text>
      </svg>
    ),
  },
  {
    value: 'Passport',
    label: 'Passport',
    icon: (
      <svg viewBox="0 0 40 56" className="w-8 h-12 mb-1" fill="none">
        <rect width="40" height="56" rx="4" fill="#1a3a6b"/>
        <rect x="4" y="4" width="32" height="48" rx="2" fill="#2952a3" opacity="0.5"/>
        <circle cx="20" cy="22" r="8" fill="#fff" opacity="0.8"/>
        <rect x="8" y="36" width="24" height="3" rx="1.5" fill="#fff" opacity="0.6"/>
        <rect x="8" y="42" width="24" height="3" rx="1.5" fill="#fff" opacity="0.4"/>
        <text x="12" y="14" fontSize="6" fill="#ffd700" fontWeight="bold">GH</text>
      </svg>
    ),
  },
  {
    value: 'Voters ID',
    label: "Voter's ID",
    icon: (
      <svg viewBox="0 0 56 36" className="w-12 h-8 mb-1" fill="none">
        <rect width="56" height="36" rx="4" fill="#7b1a1a"/>
        <rect x="4" y="4" width="48" height="28" rx="2" fill="#a52a2a" opacity="0.5"/>
        <circle cx="14" cy="18" r="6" fill="#fff" opacity="0.8"/>
        <rect x="24" y="13" width="20" height="3" rx="1.5" fill="#fff" opacity="0.7"/>
        <rect x="24" y="19" width="14" height="3" rx="1.5" fill="#fff" opacity="0.5"/>
        <text x="4" y="32" fontSize="5" fill="#ffd700" fontWeight="bold">EC</text>
      </svg>
    ),
  },
];

// ─── Vehicle type visual options ──────────────────────────────────────────────
const VEHICLE_TYPES = [
  { value: 'tricycle', label: 'Tricycle (Aboboyaa)', emoji: '🛺' },
  { value: 'truck',      label: 'Truck',      emoji: '🚛' },
  { value: 'van',        label: 'Van',        emoji: '🚐' },
  { value: 'bicycle',    label: 'Bicycle',    emoji: '🚲' },
  { value: 'cart',       label: 'Cart',       emoji: '🛒' },
  { value: 'other',      label: 'Other',      emoji: '🚗' },
];

const SignupPage = () => {
  const navigate = useNavigate();
  const { sendOtp, signup, loading: authLoading, error: authError, setIsCompletingSignup } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Field-level errors for inline feedback
  const [fieldErrors, setFieldErrors] = useState({});
  // Camera overlay: null | 'id_front' | 'id_back' | 'vehicle'
  const [cameraGuide, setCameraGuide] = useState(null);
  // Company search
  const [companySearch, setCompanySearch] = useState('');
  // OTP digit refs for 6-box input
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);

  // Haptic feedback helper
  const hapticError = () => { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); };
  const hapticSuccess = () => { if (navigator.vibrate) navigator.vibrate([80, 40, 80]); };

  // Set error with haptic
  const showError = useCallback((msg, field = null) => {
    const friendly = friendlyError(msg);
    hapticError();
    if (field) {
      setFieldErrors(prev => ({ ...prev, [field]: friendly }));
    } else {
      setError(friendly);
    }
  }, []);

  const clearFieldError = (field) => setFieldErrors(prev => { const n = {...prev}; delete n[field]; return n; });

  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    region: '',
    preferred_language: DEFAULT_LANGUAGE,
    otp: '',
    id_type: 'Ghana Card',
    id_front_photo: null,
    id_back_photo: null,
    vehicle_type: 'tricycle',
    license_plate: '',
    vehicle_color: '',
    vehicle_photo: null,
    company_id: '',
    company_name: '',
    role: 'driver'
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
    clearFieldError(name);
    setError(null);
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle OTP digit boxes
  const handleOtpDigit = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digits = [...otpDigits];
    digits[index] = value.slice(-1);
    setOtpDigits(digits);
    setFormData(prev => ({ ...prev, otp: digits.join('') }));
    clearFieldError('otp');
    setError(null);
    if (value && index < 5) otpRefs[index + 1].current?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };
  
  // Handle camera capture
  const handleCameraCapture = (e, fieldName, previewKey) => {
    const file = e.target.files[0];
    setCameraGuide(null);
    if (file) {
      if (!file.type.startsWith('image/')) {
        showError('Please capture an image using your camera', fieldName);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showError('Photo is too large. Try taking it again.', fieldName);
        return;
      }
      setFormData(prev => ({ ...prev, [fieldName]: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrls(prev => ({ ...prev, [previewKey]: reader.result }));
      };
      reader.readAsDataURL(file);
      clearFieldError(fieldName);
      hapticSuccess();
      logger.debug(`📸 Photo captured for ${fieldName}`);
    }
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
        throw new Error('Please check your phone number and try again.');
      }
      
      const formattedPhone = formatPhoneNumber(formData.phone);
      logger.debug(`Sending OTP to ${formattedPhone}...`);
      
      const { success, error } = await sendOtp(formattedPhone);
      logger.debug('OTP send response:', { success, error });
      
      if (!success) {
        throw new Error(error || 'Failed to send OTP');
      }
      
      setFormData(prev => ({ ...prev, phone: formattedPhone }));
      setOtpDigits(['', '', '', '', '', '']);
      logger.debug('OTP sent successfully, moving to verification step');
      setStep(2);
      setTimeout(() => otpRefs[0].current?.focus(), 300);
      
    } catch (err) {
      logger.error('OTP send error:', err);
      showError(err.message, 'phone');
    } finally {
      setLoading(false);
    }
  };
  
  // Verify OTP and proceed to next step
  const handleVerifyOtp = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (formData.otp.length !== 6 || !/^\d+$/.test(formData.otp)) {
        throw new Error('Wrong code. Please enter all 6 numbers.');
      }
      
      // CRITICAL: Set signup flag BEFORE verifying OTP
      // This allows auth listener to recognize this as a new signup, not an auto-login
      localStorage.setItem('is_completing_signup', 'true');
      
      // CRITICAL: Verify OTP with Supabase directly (without setting user in context)
      // This authenticates the user and creates their session in Supabase
      // BUT we don't update AuthContext yet - that happens after profile creation
      logger.debug('Verifying OTP with Supabase...');
      const { success, error: verifyError } = await authService.verifyOtp(formData.phone, formData.otp);
      
      if (!success) {
        localStorage.removeItem('is_completing_signup');
        throw new Error(verifyError || 'Wrong code. Check your messages and try again.');
      }
      
      // OTP verified successfully - user is now authenticated in Supabase
      // Session exists, but we haven't set user in AuthContext yet
      logger.info('✅ OTP verified successfully - Supabase session created');
      logger.debug('📝 User can now proceed to fill profile information');
      
      // Clear the logout flag from previous sessions
      localStorage.removeItem('user_logged_out');
      
      // Update React state to match localStorage
      setIsCompletingSignup(true);
      
      setStep(3); // Move to personal info
    } catch (err) {
      logger.error('❌ OTP verification error:', err);
      showError(err.message, 'otp');
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle final form submission — navigate immediately, finish uploads in background
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Navigate straight away so the collector never waits on a spinner
    setIsCompletingSignup(false);
    navigate('/welcome');

    // Run the rest in the background — failures are logged but don't block the UX
    (async () => {
      try {
        logger.debug('📤 Starting file uploads...');

        const photoUrls = {
          id_front_photo_url: null,
          id_back_photo_url: null,
          vehicle_photo_url: null
        };

        if (formData.id_front_photo) {
          const result = await authService.uploadPhoto(formData.id_front_photo, 'id_front');
          if (result.success) photoUrls.id_front_photo_url = result.url;
        }
        if (formData.id_back_photo) {
          const result = await authService.uploadPhoto(formData.id_back_photo, 'id_back');
          if (result.success) photoUrls.id_back_photo_url = result.url;
        }
        if (formData.vehicle_photo) {
          const result = await authService.uploadPhoto(formData.vehicle_photo, 'vehicle');
          if (result.success) photoUrls.vehicle_photo_url = result.url;
        }

        logger.debug('✅ All photos uploaded successfully');

        const signupData = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          region: formData.region,
          preferred_language: formData.preferred_language,
          id_type: formData.id_type,
          ...photoUrls,
          vehicle_type: formData.vehicle_type,
          license_plate: formData.license_plate,
          vehicle_color: formData.vehicle_color || '',
          company_id: formData.company_id,
          company_name: formData.company_name,
          role: formData.role
        };

        const { success, error } = await signup(signupData);
        if (success) {
          logger.info('✅ Registration successful with data:', signupData);
        } else if (error) {
          logger.warn('⚠️ Background signup error (user already on welcome):', error);
        }
      } catch (err) {
        logger.warn('⚠️ Background registration error (user already on welcome):', err.message);
      }
    })();

    setLoading(false);
  };

  // ─── Reusable field error display ────────────────────────────────────────────
  const FieldError = ({ field }) => fieldErrors[field] ? (
    <p className="mt-2 text-sm font-semibold text-red-400 flex items-center gap-1">
      <span>⚠️</span> {fieldErrors[field]}
    </p>
  ) : null;

  // ─── Reusable camera capture button ──────────────────────────────────────────
  const CaptureButton = ({ id, label, fieldName, previewKey, guideType }) => (
    <div className="mb-5">
      <p className="text-base font-bold mb-1 text-gray-800 dark:text-gray-100">{label}</p>
      <input
        type="file" accept="image/*" capture="environment"
        onChange={(e) => handleCameraCapture(e, fieldName, previewKey)}
        className="hidden" id={id}
      />
      {!previewUrls[previewKey] ? (
        <button
          type="button"
          onClick={() => setCameraGuide(guideType)}
          className="w-full py-10 border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-primary transition-colors flex flex-col items-center justify-center gap-2"
        >
          <span className="text-5xl">📷</span>
          <span className="text-gray-900 dark:text-white font-bold text-lg">Tap to take photo</span>
          <span className="text-gray-400 text-sm">Make sure it's clear and not blurry</span>
        </button>
      ) : (
        <div className="relative">
          <img src={previewUrls[previewKey]} alt={label} className="w-full h-48 object-cover rounded-xl border-2 border-green-500" />
          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <button
            type="button"
            onClick={() => setCameraGuide(guideType)}
            className="mt-2 w-full py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center gap-2 font-medium"
          >
            <span>🔄</span> Take again
          </button>
        </div>
      )}
      <FieldError field={fieldName} />
    </div>
  );

  // ─── Camera framing overlay ───────────────────────────────────────────────────
  const CameraGuideOverlay = () => {
    if (!cameraGuide) return null;
    const isVehicle = cameraGuide === 'vehicle';
    const inputId = isVehicle ? 'vehicle-camera' : cameraGuide === 'id_front' ? 'id-front-camera' : 'id-back-camera';
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
        <p className="text-white text-xl font-bold mb-4 text-center">
          {isVehicle ? '📸 Take a clear photo of your vehicle' : '📸 Place your ID card in the frame'}
        </p>
        {/* Framing area */}
        <div className={`relative border-4 border-dashed border-white rounded-2xl flex items-center justify-center mb-4 overflow-hidden ${isVehicle ? 'w-72 h-48 bg-gray-900/60' : 'w-72 h-44 bg-gray-900/60'}`}>
          {isVehicle ? (
            <span className="text-8xl opacity-40">�</span>
          ) : (
            /* NIA Ghana Card sample illustration inside frame */
            <svg viewBox="0 0 200 126" className="w-64 h-40" fill="none">
              {/* Card */}
              <rect x="6" y="6" width="188" height="114" rx="8" fill="#0a6b3c"/>
              {/* Gold top stripe */}
              <rect x="6" y="6" width="188" height="18" rx="0" fill="#c8a400"/>
              <rect x="6" y="6" width="188" height="10" rx="0" fill="#ffd700"/>
              {/* Ghana flag */}
              <rect x="12" y="8" width="14" height="4" fill="#cc0000"/>
              <rect x="12" y="12" width="14" height="4" fill="#ffd700"/>
              <rect x="12" y="16" width="14" height="4" fill="#006b3c"/>
              <polygon points="19,9 21,13 17,13" fill="#000"/>
              {/* NIA GHANA text */}
              <text x="90" y="20" textAnchor="middle" fontSize="9" fill="#0a3d20" fontWeight="bold" opacity="0.9">NIA GHANA CARD</text>
              {/* Photo box */}
              <rect x="14" y="26" width="40" height="52" rx="4" fill="#1a8a52"/>
              <circle cx="34" cy="42" r="10" fill="#b2dfca" opacity="0.7"/>
              <rect x="18" y="55" width="32" height="18" rx="2" fill="#b2dfca" opacity="0.45"/>
              {/* Chip */}
              <rect x="60" y="26" width="18" height="13" rx="2" fill="#c8a400" opacity="0.9"/>
              <rect x="62" y="28" width="14" height="9" rx="1" fill="#ffd700" opacity="0.7"/>
              {/* Name/ID lines */}
              <text x="84" y="38" fontSize="7" fill="#fff" opacity="0.5">SURNAME</text>
              <rect x="84" y="41" width="100" height="6" rx="3" fill="#fff" opacity="0.7"/>
              <text x="84" y="56" fontSize="7" fill="#fff" opacity="0.5">GIVEN NAMES</text>
              <rect x="84" y="59" width="80" height="6" rx="3" fill="#fff" opacity="0.6"/>
              <text x="84" y="74" fontSize="7" fill="#fff" opacity="0.5">GHA-XXXXXXXXX-X</text>
              <rect x="84" y="77" width="60" height="5" rx="2.5" fill="#ffd700" opacity="0.5"/>
              {/* MRZ */}
              <rect x="14" y="84" width="172" height="5" rx="2" fill="#ffd700" opacity="0.3"/>
              <rect x="14" y="92" width="172" height="5" rx="2" fill="#ffd700" opacity="0.2"/>
              {/* Corner guides */}
              <rect x="0" y="0" width="12" height="4" fill="white" opacity="0.9"/>
              <rect x="0" y="0" width="4" height="12" fill="white" opacity="0.9"/>
              <rect x="188" y="0" width="12" height="4" fill="white" opacity="0.9"/>
              <rect x="196" y="0" width="4" height="12" fill="white" opacity="0.9"/>
              <rect x="0" y="122" width="12" height="4" fill="white" opacity="0.9"/>
              <rect x="0" y="114" width="4" height="12" fill="white" opacity="0.9"/>
              <rect x="188" y="122" width="12" height="4" fill="white" opacity="0.9"/>
              <rect x="196" y="114" width="4" height="12" fill="white" opacity="0.9"/>
            </svg>
          )}
        </div>
        <p className="text-gray-300 text-sm text-center mb-6">
          {isVehicle ? 'Stand back so the whole vehicle is visible' : 'Lay the card flat on a dark surface. Make sure all 4 corners are inside the frame.'}
        </p>
        <button
          type="button"
          onClick={() => document.getElementById(inputId).click()}
          className="w-full max-w-xs py-4 bg-primary text-white text-xl font-bold rounded-2xl shadow-lg active:scale-95 transition-transform"
        >
          📷 Open Camera
        </button>
        <button
          type="button"
          onClick={() => setCameraGuide(null)}
          className="mt-4 text-gray-400 underline text-sm"
        >
          Cancel
        </button>
      </div>
    );
  };

  // Render appropriate step
  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <>
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Create Account</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-base">Enter your phone number to get started</p>
            <div className="mb-5">
              <label className="block text-base font-bold mb-2 text-gray-800 dark:text-gray-100">📱 Your Phone Number</label>
              {/* Visible +233 prefix badge */}
              <div className={`flex rounded-xl overflow-hidden border-2 transition-colors ${fieldErrors.phone ? 'border-red-500' : 'border-gray-400 dark:border-gray-600 focus-within:border-primary'}`}>
                <div className="flex items-center px-3 bg-gray-200 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-600 shrink-0">
                  <span className="text-lg mr-1">🇬🇭</span>
                  <span className="font-bold text-gray-800 dark:text-white text-base">+233</span>
                </div>
                <input
                  type="tel"
                  name="phone"
                  inputMode="numeric"
                  placeholder="0501234567"
                  value={formData.phone}
                  onChange={handleChange}
                  className="flex-1 px-4 py-4 text-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                  required
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                We will send a code to this number
              </p>
              <FieldError field="phone" />
            </div>
            
            <button
              type="button"
              className="w-full py-4 bg-primary text-white text-lg font-bold rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50"
              onClick={handleSendOtp}
              disabled={loading || !formData.phone}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Sending code...
                </span>
              ) : '📨 Send Code'}
            </button>
          </>
        );
        
      case 2:
        return (
          <>
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Enter your code</h2>
            {/* SMS illustration */}
            <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-3 mb-5">
              <div className="text-3xl shrink-0">💬</div>
              <p className="text-sm text-blue-800 dark:text-blue-200 leading-snug">
                Open your <strong>Messages app</strong>. Find the 6-number code from <strong>TrashDrop</strong> and enter it below.
              </p>
            </div>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              Code sent to <span className="font-bold text-gray-900 dark:text-white">{formData.phone}</span>
            </p>

            {/* 6 separate digit boxes */}
            <div className="mb-2">
              <label className="block text-base font-bold mb-3 text-gray-800 dark:text-gray-100">🔑 Code from your messages</label>
              <div className="flex gap-2 justify-center">
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={otpRefs[i]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigit(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none transition-colors ${
                      fieldErrors.otp ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                      digit ? 'border-primary bg-green-50 dark:bg-green-900/20' :
                      'border-gray-400 dark:border-gray-600 focus:border-primary'
                    }`}
                  />
                ))}
              </div>
              {fieldErrors.otp && (
                <p className="mt-3 text-sm font-semibold text-red-500 text-center flex items-center justify-center gap-1">
                  <span>⚠️</span> {fieldErrors.otp}
                </p>
              )}
            </div>

            <button
              type="button"
              className="w-full py-4 bg-primary text-white text-lg font-bold rounded-xl mt-4 shadow-md active:scale-95 transition-all disabled:opacity-50"
              onClick={handleVerifyOtp}
              disabled={loading || formData.otp.length !== 6}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Checking...
                </span>
              ) : '✅ Confirm Code'}
            </button>

            <div className="mt-5 flex flex-col items-center gap-3">
              <button type="button" className="text-primary font-medium text-sm underline" onClick={() => setStep(1)} disabled={loading}>
                ← Use a different number
              </button>
              <button type="button" className="text-gray-500 dark:text-gray-400 text-sm" onClick={handleSendOtp} disabled={loading}>
                🔄 Send the code again
              </button>
            </div>
          </>
        );

      case 3:
        return (
          <>
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Your ID Card</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-5 text-base">Tap the card that looks like yours</p>

            {/* Visual ID type picker */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {ID_TYPES.map((idType) => (
                <button
                  key={idType.value}
                  type="button"
                  onClick={() => { setFormData(prev => ({ ...prev, id_type: idType.value })); setError(null); }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                    formData.id_type === idType.value
                      ? 'border-primary bg-green-50 dark:bg-green-900/30 shadow-lg scale-105'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400'
                  }`}
                >
                  {idType.icon}
                  <span className={`text-xs font-bold mt-1 text-center ${formData.id_type === idType.value ? 'text-primary' : 'text-gray-700 dark:text-gray-200'}`}>
                    {idType.label}
                  </span>
                  {formData.id_type === idType.value && (
                    <span className="text-primary text-lg mt-1">✓</span>
                  )}
                </button>
              ))}
            </div>

            {/* Hidden file inputs */}
            <input type="file" accept="image/*" capture="environment"
              onChange={(e) => handleCameraCapture(e, 'id_front_photo', 'id_front')}
              className="hidden" id="id-front-camera" />
            <input type="file" accept="image/*" capture="environment"
              onChange={(e) => handleCameraCapture(e, 'id_back_photo', 'id_back')}
              className="hidden" id="id-back-camera" />

            <CaptureButton id="id-front-camera" label="📷 Front of your ID" fieldName="id_front_photo" previewKey="id_front" guideType="id_front" />
            <CaptureButton id="id-back-camera" label="📷 Back of your ID" fieldName="id_back_photo" previewKey="id_back" guideType="id_back" />

            <div className="flex gap-3 mt-2">
              <button type="button" className="flex-1 py-3 rounded-xl font-bold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-base" onClick={() => setStep(2)}>← Back</button>
              <button type="button" className="flex-1 py-3 rounded-xl font-bold bg-primary text-white text-base disabled:opacity-50"
                onClick={() => setStep(4)} disabled={!formData.id_front_photo || !formData.id_back_photo}>
                Continue →
              </button>
            </div>
          </>
        );

      case 4:
        return (
          <>
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Your Information</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-5 text-base">Tell us about yourself</p>

            <div className="mb-4">
              <label className="block text-base font-bold mb-2 text-gray-800 dark:text-gray-100">👤 First Name</label>
              <input type="text" name="first_name" value={formData.first_name} onChange={handleChange}
                className={`w-full px-4 py-4 text-lg rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary transition-colors ${fieldErrors.first_name ? 'border-red-500' : 'border-gray-400 dark:border-gray-600'}`}
                placeholder="Your first name" />
              <FieldError field="first_name" />
            </div>

            <div className="mb-4">
              <label className="block text-base font-bold mb-2 text-gray-800 dark:text-gray-100">👤 Last Name</label>
              <input type="text" name="last_name" value={formData.last_name} onChange={handleChange}
                className={`w-full px-4 py-4 text-lg rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary transition-colors ${fieldErrors.last_name ? 'border-red-500' : 'border-gray-400 dark:border-gray-600'}`}
                placeholder="Your last name" />
              <FieldError field="last_name" />
            </div>

            <div className="mb-4">
              <label className="block text-base font-bold mb-2 text-gray-800 dark:text-gray-100">📍 Where do you work?</label>
              <select name="region" value={formData.region} onChange={handleChange}
                className={`w-full px-4 py-4 text-lg rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary transition-colors ${fieldErrors.region ? 'border-red-500' : 'border-gray-400 dark:border-gray-600'}`}>
                <option value="">Select your region</option>
                <option value="Greater Accra">Greater Accra</option>
                <option value="Ashanti">Ashanti</option>
                <option value="Western">Western</option>
                <option value="Eastern">Eastern</option>
                <option value="Central">Central</option>
                <option value="Northern">Northern</option>
              </select>
              <FieldError field="region" />
            </div>

            <div className="mb-4">
              <label className="block text-base font-bold mb-2 text-gray-800 dark:text-gray-100">🗣️ Navigation Language</label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Which language do you want to hear directions in?</p>
              <div className="space-y-2">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <label key={lang.code}
                    className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.preferred_language === lang.code
                        ? 'border-primary bg-green-50 dark:bg-green-900/30'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400'
                    }`}>
                    <input type="radio" name="preferred_language" value={lang.code}
                      checked={formData.preferred_language === lang.code} onChange={handleChange} className="sr-only" />
                    <span className="text-2xl mr-3">{lang.flag}</span>
                    <div className="flex-1">
                      <span className="font-bold text-base text-gray-900 dark:text-white">{lang.nativeLabel}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({lang.label})</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{lang.description}</p>
                    </div>
                    {formData.preferred_language === lang.code && (
                      <svg className="w-5 h-5 text-primary shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button type="button" className="flex-1 py-3 rounded-xl font-bold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-base" onClick={() => setStep(3)}>← Back</button>
              <button type="button" className="flex-1 py-3 rounded-xl font-bold bg-primary text-white text-base disabled:opacity-50"
                onClick={() => setStep(5)} disabled={!formData.first_name || !formData.last_name || !formData.region}>
                Continue →
              </button>
            </div>
          </>
        );

      case 5:
        return (
          <>
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Your Vehicle</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-5 text-base">Tap the vehicle you use for collections</p>

            {/* Visual vehicle type picker */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {VEHICLE_TYPES.map((v) => (
                <button key={v.value} type="button"
                  onClick={() => { setFormData(prev => ({ ...prev, vehicle_type: v.value })); setError(null); }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                    formData.vehicle_type === v.value
                      ? 'border-primary bg-green-50 dark:bg-green-900/30 shadow-lg scale-105'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400'
                  }`}>
                  <span className="text-4xl mb-1">{v.emoji}</span>
                  <span className={`text-xs font-bold text-center ${formData.vehicle_type === v.value ? 'text-primary' : 'text-gray-700 dark:text-gray-200'}`}>{v.label}</span>
                  {formData.vehicle_type === v.value && <span className="text-primary text-base mt-1">✓</span>}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-base font-bold mb-2 text-gray-800 dark:text-gray-100">🎫 Number Plate</label>
              <input type="text" name="license_plate" value={formData.license_plate} onChange={handleChange}
                className={`w-full px-4 py-4 text-lg rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary transition-colors ${fieldErrors.license_plate ? 'border-red-500' : 'border-gray-400 dark:border-gray-600'}`}
                placeholder="e.g., GR-123-20" />
              <FieldError field="license_plate" />
            </div>

            <div className="mb-4">
              <label className="block text-base font-bold mb-2 text-gray-800 dark:text-gray-100">🎨 Vehicle Colour</label>
              <input type="text" name="vehicle_color" value={formData.vehicle_color} onChange={handleChange}
                className={`w-full px-4 py-4 text-lg rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary transition-colors ${fieldErrors.vehicle_color ? 'border-red-500' : 'border-gray-400 dark:border-gray-600'}`}
                placeholder="e.g., Blue, Red, Black" />
              <FieldError field="vehicle_color" />
            </div>

            {/* Hidden file input */}
            <input type="file" accept="image/*" capture="environment"
              onChange={(e) => handleCameraCapture(e, 'vehicle_photo', 'vehicle')}
              className="hidden" id="vehicle-camera" />
            <CaptureButton id="vehicle-camera" label="📷 Photo of your vehicle" fieldName="vehicle_photo" previewKey="vehicle" guideType="vehicle" />

            <div className="flex gap-3 mt-2">
              <button type="button" className="flex-1 py-3 rounded-xl font-bold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-base" onClick={() => setStep(4)}>← Back</button>
              <button type="button" className="flex-1 py-3 rounded-xl font-bold bg-primary text-white text-base disabled:opacity-50"
                onClick={() => setStep(6)} disabled={!formData.license_plate || !formData.vehicle_photo}>
                Continue →
              </button>
            </div>
          </>
        );

      case 6: {
        // Searchable company — includes major Ghana waste companies + aboboyaa associations + special options
        const companyOptions = [
          { id: 'NOT_REGISTERED',     name: 'Not Registered',                   special: true },
          { id: 'GAWU-001',           name: 'Ghana Aboboyaa Workers Union (GAWU)' },
          { id: 'NAWUG-001',          name: 'National Aboboyaa Workers Union of Ghana (NAWUG)' },
          { id: 'ZOOMLION-001',       name: 'Zoomlion Ghana Ltd' },
          { id: 'ACCRAWASTE-001',     name: 'Accra Metropolitan Assembly (AMA) Waste' },
          { id: 'GHANADUMP-001',      name: 'Ghana Dump Limited' },
          { id: 'BORLASETRANSIT-001', name: 'Borlas Transit & Haulage' },
          { id: 'ENVIROSERV-001',     name: 'EnviroServ Ghana' },
          { id: 'CLEANGH-001',        name: 'CleanGhana Ltd' },
          { id: 'GREENCITY-001',      name: 'GreenCity Waste Management' },
          { id: 'ECOTRACK-001',       name: 'EcoTrack Ghana' },
        ];
        const filtered = companySearch.trim()
          ? companyOptions.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()))
          : companyOptions;

        const ROLE_OPTIONS = [
          { value: 'driver',     label: 'Driver',     emoji: '🚗' },
          { value: 'collector',  label: 'Collector',  emoji: '♻️' },
          { value: 'supervisor', label: 'Supervisor', emoji: '📋' },
        ];

        return (
          <>
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Your Company</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-5 text-base">Search for your company below</p>

            {/* Searchable company selector */}
            <div className="mb-5">
              <label className="block text-base font-bold mb-2 text-gray-800 dark:text-gray-100">🏢 Search or Enter Company</label>
              <input
                type="text"
                value={companySearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setCompanySearch(val);
                  clearFieldError('company_name');
                  setError(null);
                  // If user is typing freely (not from list), store as free-text company name
                  if (val.trim()) {
                    setFormData(prev => ({ ...prev, company_name: val, company_id: prev.company_id && companyOptions.find(c => c.name === val) ? prev.company_id : 'CUSTOM' }));
                  } else {
                    setFormData(prev => ({ ...prev, company_name: '', company_id: '' }));
                  }
                }}
                placeholder="Type to search, or enter your company name..."
                className={`w-full px-4 py-4 text-lg rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary transition-colors ${fieldErrors.company_name ? 'border-red-500' : 'border-gray-400 dark:border-gray-600'}`}
              />
              {/* Company list — only show when something is typed or field is empty (show all) */}
              {filtered.length > 0 && (
                <div className="mt-2 border-2 border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden bg-white dark:bg-gray-800 max-h-56 overflow-y-auto">
                  {filtered.map((c) => (
                    <button key={c.id} type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, company_id: c.id, company_name: c.name }));
                        setCompanySearch(c.name);
                        clearFieldError('company_name');
                        hapticSuccess();
                      }}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${
                        formData.company_id === c.id
                          ? 'bg-green-50 dark:bg-green-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}>
                      <span className="text-2xl">{c.special ? '🚫' : c.id.startsWith('GAWU') || c.id.startsWith('NAWUG') ? '🛺' : '🏢'}</span>
                      <div className="flex-1">
                        <p className={`font-bold ${c.special ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>{c.name}</p>
                        {!c.special && <p className="text-xs text-gray-500 dark:text-gray-400">{c.id}</p>}
                      </div>
                      {formData.company_id === c.id && (
                        <svg className="w-5 h-5 text-primary shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {companySearch.trim() && filtered.length === 0 && (
                <div className="mt-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
                  <p className="text-sm text-amber-700 dark:text-amber-300 font-semibold">✍️ Using &ldquo;{companySearch}&rdquo; as your company name.</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">If this is wrong, contact your supervisor for the correct name.</p>
                </div>
              )}
              <FieldError field="company_name" />
            </div>

            {/* Role visual picker */}
            <div className="mb-5">
              <label className="block text-base font-bold mb-3 text-gray-800 dark:text-gray-100">👷 Your Role</label>
              <div className="grid grid-cols-3 gap-3">
                {ROLE_OPTIONS.map((r) => (
                  <button key={r.value} type="button"
                    onClick={() => { setFormData(prev => ({ ...prev, role: r.value })); setError(null); }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                      formData.role === r.value
                        ? 'border-primary bg-green-50 dark:bg-green-900/30 shadow-md scale-105'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400'
                    }`}>
                    <span className="text-3xl mb-1">{r.emoji}</span>
                    <span className={`text-xs font-bold ${formData.role === r.value ? 'text-primary' : 'text-gray-700 dark:text-gray-200'}`}>{r.label}</span>
                    {formData.role === r.value && <span className="text-primary text-base mt-1">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl flex items-start gap-2">
                <span className="text-lg shrink-0">⚠️</span>
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button type="button" className="flex-1 py-3 rounded-xl font-bold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-base" onClick={() => setStep(5)}>← Back</button>
              <button type="button" className="flex-1 py-4 rounded-xl font-bold bg-primary text-white text-base disabled:opacity-50 shadow-md active:scale-95 transition-all"
                onClick={handleSubmit}
                disabled={loading || !formData.company_name}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Registering...
                  </span>
                ) : '🎉 Complete Registration'}
              </button>
            </div>
          </>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-950 p-4">
      {/* Camera framing overlay — rendered at root level so it covers full screen */}
      <CameraGuideOverlay />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <img src="/icons/logo-08.png" alt="TrashDrop Logo" className="w-24 h-24 object-contain mb-2" />
          <p className="text-gray-600 dark:text-gray-400 text-base font-medium">TrashDrop Carter Registration</p>
        </div>

        {/* ── Milestone progress bar ── */}
        <div className="mb-5 px-1">
          <div className="flex items-center justify-between">
            {MILESTONES.map((m, i) => (
              <div key={m.step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shadow transition-all ${
                    step > m.step
                      ? 'bg-primary text-white'
                      : step === m.step
                      ? 'bg-primary text-white ring-4 ring-primary/30'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {step > m.step ? '✓' : m.icon}
                  </div>
                  <span className={`text-xs mt-1 font-medium leading-tight text-center ${
                    step >= m.step ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
                  }`}>{m.label}</span>
                </div>
                {i < MILESTONES.length - 1 && (
                  <div className={`h-1 w-4 mb-4 rounded-full transition-colors ${step > m.step ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Global error banner (non-field errors) */}
        {error && step !== 6 && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl flex items-start gap-2">
            <span className="text-lg shrink-0">⚠️</span>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Form card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-5 border border-gray-200 dark:border-gray-700">
          <form onSubmit={(e) => e.preventDefault()}>
            {renderStep()}
          </form>
        </div>

        {/* Footer links */}
        <div className="mt-5 text-center">
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Already have an account?{' '}
            <a href="/login" className="text-primary font-bold underline">Login</a>
          </p>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            By signing up you agree to our{' '}
            <a href="/terms" className="text-primary underline">Terms</a> and{' '}
            <a href="/privacy" className="text-primary underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
