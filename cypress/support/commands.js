// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

/**
 * Custom command to programmatically authenticate in Cypress tests
 * This bypasses the UI login flow and directly sets the auth token
 */
Cypress.Commands.add('programmaticLogin', () => {
  // Create a fake session that mimics what the app would set after successful login
  const fakeSession = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: Date.now() + 3600000, // 1 hour from now
    user: {
      id: 'test-user-id',
      phone: '+233501234567',
      role: 'collector',
      created_at: new Date().toISOString()
    }
  };

  // Set the auth data in localStorage as the app would
  localStorage.setItem('supabase.auth.token', JSON.stringify({
    currentSession: fakeSession,
    expiresAt: fakeSession.expires_at
  }));

  // Return the session for chaining
  return cy.wrap(fakeSession);
});

// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })