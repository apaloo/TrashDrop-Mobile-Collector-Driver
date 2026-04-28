import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPhoneNumber } from '../services/supabase';
import { logger } from '../utils/logger';
import logo from '../assets/logo.svg';

// ─── Plain-language error messages ───────────────────────────────────────────
const friendlyError = (raw = '') => {
  const msg = raw.toLowerCase();
  if (msg.includes('otp') || msg.includes('token') || msg.includes('invalid') || msg.includes('expired'))
    return 'Wrong code. Check your messages and try again.';
  if (msg.includes('phone') || msg.includes('number'))
    return 'Please check your phone number and try again.';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch'))
    return 'No internet connection. Please check your network and try again.';
  if (msg.includes('not found') || msg.includes('no account'))
    return 'No account found for this number. Please sign up first.';
  return raw || 'Something went wrong. Please try again.';
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { sendOtp, login, loading: authLoading } = useAuth();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState(null);
  const [otpError, setOtpError] = useState(null);

  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // NOTE: Redirect is handled by PublicRoute wrapper in App.jsx

  const hapticError = () => { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); };

  const otp = otpDigits.join('');

  // ─── OTP digit box handlers ───────────────────────────────────────────────
  const handleOtpDigit = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digits = [...otpDigits];
    digits[index] = value.slice(-1);
    setOtpDigits(digits);
    setOtpError(null);
    if (value && index < 5) otpRefs[index + 1].current?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  // ─── Send OTP ─────────────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setPhoneError(null);

    try {
      if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 9) {
        throw new Error('Please check your phone number and try again.');
      }

      const formattedPhone = formatPhoneNumber(phoneNumber);
      logger.info(`Sending OTP to ${formattedPhone}...`);

      const { success, error } = await sendOtp(formattedPhone);

      if (!success) {
        throw new Error(error || 'Failed to send OTP');
      }

      setOtpDigits(['', '', '', '', '', '']);
      setOtpSent(true);
      logger.info('OTP sent successfully');
      setTimeout(() => otpRefs[0].current?.focus(), 300);
    } catch (err) {
      logger.error('OTP send error:', err);
      hapticError();
      setPhoneError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  // ─── Verify OTP ───────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    setLoading(true);
    setOtpError(null);

    try {
      if (otp.length !== 6 || !/^\d+$/.test(otp)) {
        throw new Error('Wrong code. Please enter all 6 numbers.');
      }

      const formattedPhone = formatPhoneNumber(phoneNumber);
      const { success, user, error } = await login(formattedPhone, otp);

      if (success) {
        logger.info('OTP verification successful:', user);
        navigate('/map');
      } else if (error) {
        throw new Error(error);
      }
    } catch (err) {
      logger.error('OTP verification error:', err);
      hapticError();
      setOtpError(friendlyError(err.message));
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const Spinner = () => (
    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src={logo}
            alt="TrashDrop Logo"
            className="w-20 h-20 rounded-2xl shadow-lg mb-3 transform hover:scale-105 transition-transform"
          />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">TrashDrop</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Collector App</p>
        </div>

        {!otpSent ? (
          /* ── Step 1: Phone number ── */
          <>
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white text-center">Welcome back</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-base text-center">Enter your phone number to sign in</p>

            <div className="mb-5">
              <label className="block text-base font-bold mb-2 text-gray-800 dark:text-gray-100">📱 Your Phone Number</label>
              <div className={`flex rounded-xl overflow-hidden border-2 transition-colors ${phoneError ? 'border-red-500' : 'border-gray-400 dark:border-gray-600 focus-within:border-primary'}`}>
                <div className="flex items-center px-3 bg-gray-200 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-600 shrink-0">
                  <span className="text-lg mr-1">🇬🇭</span>
                  <span className="font-bold text-gray-800 dark:text-white text-base">+233</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="0501234567"
                  value={phoneNumber}
                  onChange={(e) => { setPhoneNumber(e.target.value); setPhoneError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp(e); }}
                  className="flex-1 px-4 py-4 text-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">We will send a code to this number</p>
              {phoneError && (
                <p className="mt-2 text-sm font-semibold text-red-500 flex items-center gap-1">
                  <span>⚠️</span> {phoneError}
                </p>
              )}
            </div>

            <button
              type="button"
              className="w-full py-4 bg-primary text-white text-lg font-bold rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50"
              onClick={handleSendOtp}
              disabled={loading || !phoneNumber}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2"><Spinner /> Sending code...</span>
              ) : '📨 Send Code'}
            </button>

            <p className="mt-6 text-center text-gray-600 dark:text-gray-300 text-sm">
              Don't have an account?{' '}
              <a href="/signup" className="text-primary font-bold underline">Sign up</a>
            </p>
          </>
        ) : (
          /* ── Step 2: OTP verification ── */
          <>
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Enter your code</h2>

            {/* SMS guidance banner */}
            <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-3 mb-5">
              <div className="text-3xl shrink-0">💬</div>
              <p className="text-sm text-blue-800 dark:text-blue-200 leading-snug">
                Open your <strong>Messages app</strong>. Find the 6-number code from <strong>TrashDrop</strong> and enter it below.
              </p>
            </div>

            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              Code sent to <span className="font-bold text-gray-900 dark:text-white">{formatPhoneNumber(phoneNumber)}</span>
            </p>

            {/* 6 digit boxes */}
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
                      otpError ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                      digit ? 'border-primary bg-green-50 dark:bg-green-900/20' :
                      'border-gray-400 dark:border-gray-600 focus:border-primary'
                    }`}
                  />
                ))}
              </div>
              {otpError && (
                <p className="mt-3 text-sm font-semibold text-red-500 text-center flex items-center justify-center gap-1">
                  <span>⚠️</span> {otpError}
                </p>
              )}
            </div>

            <button
              type="button"
              className="w-full py-4 bg-primary text-white text-lg font-bold rounded-xl mt-4 shadow-md active:scale-95 transition-all disabled:opacity-50"
              onClick={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2"><Spinner /> Checking...</span>
              ) : '✅ Sign In'}
            </button>

            <div className="mt-5 flex flex-col items-center gap-3">
              <button
                type="button"
                className="text-primary font-medium text-sm underline"
                onClick={() => { setOtpSent(false); setOtpError(null); }}
                disabled={loading}
              >
                ← Use a different number
              </button>
              <button
                type="button"
                className="text-gray-500 dark:text-gray-400 text-sm"
                onClick={handleSendOtp}
                disabled={loading}
              >
                🔄 Send the code again
              </button>
            </div>
          </>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
          By continuing, you agree to our{' '}
          <a href="/terms" className="text-primary underline">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" className="text-primary underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
