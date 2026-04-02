import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { showToast } from '../utils/toast';

/**
 * Signout Confirmation Modal Component
 * Provides a confirmation dialog before signing out the user
 * Includes signout process with status updates and error handling
 */
export const SignoutConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirmSignout,
  isLoading = false 
}) => {
  const [signoutStep, setSignoutStep] = useState('confirm'); // confirm, processing, success, error
  const [signoutError, setSignoutError] = useState(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSignoutStep('confirm');
      setSignoutError(null);
    }
  }, [isOpen]);

  // Handle signout confirmation
  const handleSignout = async () => {
    try {
      setSignoutStep('processing');
      setSignoutError(null);
      
      logger.info('👋 User confirmed signout - starting signout process...');
      
      // Call the provided signout function
      const result = await onConfirmSignout();
      
      if (result.success) {
        setSignoutStep('success');
        logger.info('✅ Signout completed successfully');
        showToast('Signed out successfully', 'success');
        
        // Auto-close modal after success
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        throw new Error(result.error || 'Signout failed');
      }
      
    } catch (error) {
      setSignoutStep('error');
      setSignoutError(error.message);
      logger.error('❌ Signout error:', error.message);
      showToast('Failed to sign out. Please try again.', 'error');
    }
  };

  // Close modal handler
  const handleClose = () => {
    if (signoutStep === 'processing') {
      // Don't allow closing during processing
      return;
    }
    onClose();
  };

  // Render different modal states
  const renderModalContent = () => {
    switch (signoutStep) {
      case 'confirm':
        return (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l-4 4m0 0l-4-4m4 4V3" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Sign Out Confirmation
              </h3>
              <p className="text-sm text-gray-500">
                Are you sure you want to sign out? You'll need to verify your phone number again to sign back in.
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                type="button"
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                onClick={handleSignout}
                disabled={isLoading}
              >
                Sign Out
              </button>
            </div>
          </>
        );

      case 'processing':
        return (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Signing Out...
              </h3>
              <p className="text-sm text-gray-500">
                Please wait while we secure your session and clear your data.
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Clearing session data</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Revoking authentication tokens</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Cleaning up local storage</span>
              </div>
            </div>
          </>
        );

      case 'success':
        return (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Signed Out Successfully
              </h3>
              <p className="text-sm text-gray-500">
                You have been safely signed out. Redirecting to login page...
              </p>
            </div>
          </>
        );

      case 'error':
        return (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Signout Failed
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {signoutError || 'An error occurred while signing out. Please try again.'}
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                type="button"
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                onClick={handleClose}
              >
                Close
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                onClick={handleSignout}
              >
                Try Again
              </button>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {renderModalContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
