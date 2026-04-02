import { useState } from 'react';

/**
 * Logout confirmation modal component
 * Prevents accidental signouts with user confirmation
 */
export const LogoutConfirmationModal = ({ isOpen, onClose, onConfirm, isLoading = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[4000]">
      <div className="bg-white rounded-lg p-6 m-4 max-w-sm w-full">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mr-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Sign Out</h3>
            <p className="text-sm text-gray-600">Are you sure you want to sign out?</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-600">
            <span className="font-medium">Note:</span> You'll need to sign in again to access your account and continue collecting.
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Signing Out...
              </>
            ) : (
              'Sign Out'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
