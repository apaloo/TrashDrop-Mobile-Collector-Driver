import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const DiagnosticPage = () => {
  const [status, setStatus] = useState('Loading...');

  useEffect(() => {
    // Simple diagnostic function
    const runDiagnostics = () => {
      try {
        setStatus('React is working!');
        console.log('DiagnosticPage rendered successfully');
      } catch (error) {
        console.error('Diagnostic error:', error);
        setStatus(`Error: ${error.message}`);
      }
    };

    runDiagnostics();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6">TrashDrop Diagnostics</h1>
        
        <div className="p-4 mb-4 bg-gray-50 rounded">
          <h2 className="font-semibold mb-2">React Status:</h2>
          <p className={`text-lg ${status.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {status}
          </p>
        </div>
        
        <div className="p-4 mb-4 bg-gray-50 rounded">
          <h2 className="font-semibold mb-2">Navigation Test:</h2>
          <div className="flex flex-col space-y-2">
            <Link to="/" className="text-blue-600 hover:underline">Home</Link>
            <Link to="/login" className="text-blue-600 hover:underline">Login</Link>
            <Link to="/signup" className="text-blue-600 hover:underline">Signup</Link>
          </div>
        </div>
        
        <div className="p-4 bg-gray-50 rounded">
          <h2 className="font-semibold mb-2">CSS Test:</h2>
          <div className="flex space-x-2">
            <div className="w-8 h-8 bg-primary rounded"></div>
            <div className="w-8 h-8 bg-secondary rounded"></div>
            <div className="w-8 h-8 bg-danger rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPage;
