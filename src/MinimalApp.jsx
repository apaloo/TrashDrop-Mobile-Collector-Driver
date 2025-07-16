import React from 'react';

function MinimalApp() {
  return (
    <div style={{ 
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1 style={{ color: '#4CAF50' }}>TrashDrop Minimal App</h1>
      <p>If you can see this text, React is rendering correctly!</p>
      
      <div style={{
        padding: '15px',
        backgroundColor: '#f5f5f5',
        borderRadius: '5px',
        marginTop: '20px'
      }}>
        <h2>Troubleshooting Info:</h2>
        <ul>
          <li>React version: {React.version}</li>
          <li>Current time: {new Date().toLocaleTimeString()}</li>
          <li>Environment: {import.meta.env.MODE}</li>
        </ul>
      </div>
      
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
        onClick={() => alert('Button clicked!')}
      >
        Test Interactivity
      </button>
    </div>
  );
}

export default MinimalApp;
