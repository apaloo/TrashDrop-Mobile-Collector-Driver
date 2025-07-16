import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// A very simple Home component
const Home = () => (
  <div style={{ padding: '20px' }}>
    <h2>Home Page</h2>
    <p>This is the home page with React Router.</p>
    <div style={{ marginTop: '20px' }}>
      <Link to="/about" style={{ color: '#4CAF50', textDecoration: 'underline', marginRight: '10px' }}>
        Go to About
      </Link>
    </div>
  </div>
);

// A very simple About component
const About = () => (
  <div style={{ padding: '20px' }}>
    <h2>About Page</h2>
    <p>This is the about page with React Router.</p>
    <div style={{ marginTop: '20px' }}>
      <Link to="/" style={{ color: '#4CAF50', textDecoration: 'underline' }}>
        Go to Home
      </Link>
    </div>
  </div>
);

function RouterApp() {
  return (
    <Router>
      <div style={{ 
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <h1 style={{ color: '#4CAF50' }}>TrashDrop Router Test</h1>
        <p>If you can see this, React Router is working correctly!</p>
        
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
          </div>
        </div>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </div>
    </Router>
  );
}

export default RouterApp;
