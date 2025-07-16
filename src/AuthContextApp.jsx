import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// A very simple Home component
const Home = () => (
  <div style={{ padding: '20px' }}>
    <h2>Home Page</h2>
    <p>This is the home page with React Router and AuthContext.</p>
    <div style={{ marginTop: '20px' }}>
      <Link to="/about" style={{ color: '#4CAF50', textDecoration: 'underline', marginRight: '10px' }}>
        Go to About
      </Link>
      <Link to="/login" style={{ color: '#4CAF50', textDecoration: 'underline' }}>
        Go to Login
      </Link>
    </div>
  </div>
);

// A very simple About component
const About = () => (
  <div style={{ padding: '20px' }}>
    <h2>About Page</h2>
    <p>This is the about page with React Router and AuthContext.</p>
    <div style={{ marginTop: '20px' }}>
      <Link to="/" style={{ color: '#4CAF50', textDecoration: 'underline', marginRight: '10px' }}>
        Go to Home
      </Link>
      <Link to="/login" style={{ color: '#4CAF50', textDecoration: 'underline' }}>
        Go to Login
      </Link>
    </div>
  </div>
);

// A simplified Login component
const Login = () => {
  const handleLogin = () => {
    alert('Login functionality would happen here');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Login Page</h2>
      <p>This is a simplified login page with AuthContext.</p>
      <button 
        style={{
          backgroundColor: '#4CAF50',
          color: 'white',
          padding: '10px 15px',
          border: 'none',
          borderRadius: '4px',
          marginTop: '20px',
          cursor: 'pointer'
        }}
        onClick={handleLogin}
      >
        Simulate Login
      </button>
      <div style={{ marginTop: '20px' }}>
        <Link to="/" style={{ color: '#4CAF50', textDecoration: 'underline' }}>
          Back to Home
        </Link>
      </div>
    </div>
  );
};

function AuthContextApp() {
  return (
    <AuthProvider>
      <Router>
        <div style={{ 
          padding: '20px',
          fontFamily: 'Arial, sans-serif',
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          <h1 style={{ color: '#4CAF50' }}>TrashDrop AuthContext Test</h1>
          <p>If you can see this, React Router with AuthProvider is working correctly!</p>
          
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
              <Link to="/about" style={{ color: '#4CAF50', textDecoration: 'underline' }}>About</Link>
              <Link to="/login" style={{ color: '#4CAF50', textDecoration: 'underline' }}>Login</Link>
            </div>
          </div>

          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default AuthContextApp;
