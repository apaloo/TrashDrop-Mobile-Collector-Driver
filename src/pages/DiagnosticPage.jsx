import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReportModal from '../components/ReportModal';

const DiagnosticPage = () => {
  const [status, setStatus] = useState('Loading...');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  
  // Mock data for the report modal
  const mockAssignment = {
    id: 'TEST-123',
    address: '123 Test Street, Accra',
    description: 'Test waste collection',
    status: 'completed',
    created_at: '2025-07-15T10:00:00Z',
    completed_at: '2025-07-16T14:30:00Z',
    disposed_at: '2025-07-16T16:45:00Z',
    location: { lat: 5.6037, lng: -0.1870 },
    photos: [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
      'https://example.com/photo3.jpg'
    ],
    disposal_site: {
      name: 'Test Disposal Center',
      address: '456 Disposal Road, Accra',
      location: { lat: 5.6057, lng: -0.1890 }
    }
  };

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
        
        <div className="p-4 mt-4 bg-gray-50 rounded">
          <h2 className="font-semibold mb-2">Component Tests:</h2>
          <button
            onClick={() => setReportModalOpen(true)}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            Test Report Modal
          </button>
        </div>
      </div>
      
      {/* Report Modal for testing */}
      {reportModalOpen && (
        <ReportModal 
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          assignment={mockAssignment}
        />
      )}
    </div>
  );
};

export default DiagnosticPage;
