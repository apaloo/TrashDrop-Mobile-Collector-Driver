import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import the diagnostic page
import DiagnosticPage from './pages/DiagnosticPage';

function SimpleApp() {
  return (
    <Router>
      <Routes>
        <Route path="/*" element={<DiagnosticPage />} />
      </Routes>
    </Router>
  );
}

export default SimpleApp;
