/**
 * Simple Toast Notification Utility
 * Provides global toast notifications for user feedback
 */

let toastContainer = null;

// Initialize toast container
const initToastContainer = () => {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
    document.body.appendChild(toastContainer);
  }
};

// Show toast notification
export const showToast = (message, type = 'info', duration = 3000) => {
  initToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `
    px-4 py-3 rounded-md shadow-lg text-white font-medium
    transform transition-all duration-300 ease-in-out
    ${type === 'success' ? 'bg-green-500' : ''}
    ${type === 'error' ? 'bg-red-500' : ''}
    ${type === 'warning' ? 'bg-yellow-500' : ''}
    ${type === 'info' ? 'bg-blue-500' : ''}
  `;
  
  toast.textContent = message;
  
  // Add animation classes
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(100%)';
  
  toastContainer.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 10);
  
  // Remove toast after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    
    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
      }
    }, 300);
  }, duration);
};

// Clear all toasts
export const clearToasts = () => {
  if (toastContainer) {
    toastContainer.innerHTML = '';
  }
};
