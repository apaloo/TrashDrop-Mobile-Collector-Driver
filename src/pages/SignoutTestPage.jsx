import { useState } from 'react';
import { SignoutConfirmationModal } from '../components/SignoutConfirmationModal';
import { showToast } from '../utils/toast';

/**
 * Test page to demonstrate SignoutConfirmationModal functionality
 */
export const SignoutTestPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Mock signout function for testing
  const mockSignout = async () => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate random success/failure for testing
    const success = Math.random() > 0.3; // 70% success rate
    
    if (success) {
      // Clear session data (mock)
      localStorage.removeItem('user_logged_out');
      localStorage.removeItem('last_login_time');
      
      return { success: true };
    } else {
      return { success: false, error: 'Network error occurred' };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Signout Modal Test
          </h1>
          
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-md">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">
                Test Features:
              </h2>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✅ Confirmation dialog</li>
                <li>✅ Processing state with animations</li>
                <li>✅ Success feedback</li>
                <li>✅ Error handling</li>
                <li>✅ Toast notifications</li>
                <li>✅ Auto-close on success</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                Test Signout Modal
              </button>
              
              <button
                onClick={() => showToast('Test notification', 'info')}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Test Toast Notification
              </button>
            </div>
            
            <div className="text-xs text-gray-500">
              <p>• Click "Test Signout Modal" to see the full signout flow</p>
              <p>• Modal shows processing state with animated steps</p>
              <p>• 70% success rate for testing both success and error states</p>
              <p>• Auto-redirects after successful signout</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Signout Confirmation Modal */}
      <SignoutConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirmSignout={mockSignout}
        isLoading={isLoading}
      />
    </div>
  );
};
