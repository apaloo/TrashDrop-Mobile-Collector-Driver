// Script to reset authentication state
console.log('Resetting authentication state...');

// Clear all localStorage items related to auth
localStorage.removeItem('dev_mode_session');
localStorage.removeItem('user_logged_out');
localStorage.removeItem('supabase.auth.token');

// Log the cleared state
console.log('Authentication state reset complete.');
console.log('localStorage items cleared:');
console.log('- dev_mode_session');
console.log('- user_logged_out');
console.log('- supabase.auth.token');

// Redirect to login page
window.location.href = '/login';
