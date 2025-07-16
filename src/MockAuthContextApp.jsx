import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/MockAuthContext';
import { useAuth } from './context/MockAuthContext';

// Component to show authentication state
const AuthStatus = () => {
  const { user, isAuthenticated, logout } = useAuth();
  
  return (
    <div style={{
      padding: '15px',
      backgroundColor: '#f0f8f0',
      borderRadius: '5px',
      marginTop: '20px',
      marginBottom: '20px'
    }}>
      <h3>Auth Status:</h3>
      <p>
        <strong>Authenticated:</strong> {isAuthenticated ? 'Yes ✅' : 'No ❌'}
      </p>
      {isAuthenticated && (
        <>
          <p><strong>User ID:</strong> {user.id}</p>
          <p><strong>Phone:</strong> {user.phone}</p>
          <button 
            style={{
              backgroundColor: '#F44336',
              color: 'white',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={logout}
          >
            Sign Out
          </button>
        </>
      )}
    </div>
  );
};

// A simple Home component
const Home = () => (
  <div style={{ padding: '20px' }}>
    <h2>Home Page</h2>
    <p>This is the home page with Mock Auth Context.</p>
    <AuthStatus />
  </div>
);

// A Login component that uses Mock Auth
const Login = () => {
  const { sendOtp, login, loading, error } = useAuth();
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [otpSent, setOtpSent] = React.useState(false);
  
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phoneNumber) return;
    
    const result = await sendOtp(phoneNumber);
    if (result.success) {
      setOtpSent(true);
    }
  };
  
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!otp) return;
    
    await login(phoneNumber, otp);
  };
  
  return (
    <div style={{ padding: '20px' }}>
      <h2>Login Page</h2>
      <p>This is a simplified login page with Mock Auth Context.</p>
      
      {error && (
        <div style={{ 
          backgroundColor: '#FFEBEE', 
          padding: '10px', 
          marginBottom: '15px',
          borderRadius: '4px',
          color: '#D32F2F'
        }}>
          {error}
        </div>
      )}
      
      <AuthStatus />
      
      {!otpSent ? (
        <form onSubmit={handleSendOtp} style={{ marginTop: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Phone Number:
            </label>
            <input 
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                marginBottom: '15px'
              }}
              placeholder="+233201234567"
              required
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              padding: '10px 15px',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin} style={{ marginTop: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Verification Code:
            </label>
            <input 
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                marginBottom: '15px'
              }}
              placeholder="123456"
              maxLength={6}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="button"
              onClick={() => setOtpSent(false)}
              style={{
                backgroundColor: '#9E9E9E',
                color: 'white',
                padding: '10px 15px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Back
            </button>
            <button 
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                padding: '10px 15px',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </div>
        </form>
      )}
      
      <div style={{ marginTop: '20px' }}>
        <Link to="/" style={{ color: '#4CAF50', textDecoration: 'underline' }}>
          Back to Home
        </Link>
      </div>
    </div>
  );
};

function MockAuthContextApp() {
  return (
    <AuthProvider>
      <Router>
        <div style={{ 
          padding: '20px',
          fontFamily: 'Arial, sans-serif',
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          <h1 style={{ color: '#4CAF50' }}>TrashDrop Mock Auth Test</h1>
          <p>If you can see this, React Router with Mock AuthProvider is working correctly!</p>
          
          <div style={{
            padding: '15px',
            backgroundColor: '#f5f5f5',
            borderRadius: '5px',
            marginTop: '20px',
            marginBottom: '20px'
          }}>
            <h2>Navigation:</h2>
            <div style={{ display: 'flex', gap: '20px' }}>
              <Link to="/" style={{ color: '#4CAF50', textDecoration: 'underline' }}>Home</Link>
              <Link to="/login" style={{ color: '#4CAF50', textDecoration: 'underline' }}>Login</Link>
            </div>
          </div>

          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default MockAuthContextApp;
