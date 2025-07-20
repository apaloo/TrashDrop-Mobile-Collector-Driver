/// <reference types="cypress" />

describe('Authentication Flow', () => {
  beforeEach(() => {
    // Clear any existing state
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Mock the Supabase auth responses
    cy.intercept('POST', '**/auth/v1/otp', {
      statusCode: 200,
      body: {
        message: 'OTP sent successfully'
      }
    }).as('sendOtp');
    
    cy.intercept('POST', '**/auth/v1/verify', {
      statusCode: 200,
      body: {
        user: {
          id: 'test-user-123',
          phone: '+1234567890',
          role: 'collector'
        },
        session: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600
        }
      }
    }).as('verifyOtp');
    
    // Visit the login page
    cy.visit('/login', {
      failOnStatusCode: false,
      onBeforeLoad(win) {
        // Disable service workers
        delete win.navigator.__proto__.serviceWorker;
      }
    });
  });

  it('should load the login page', () => {
    // Check for the login form
    cy.get('form').should('exist');
    
    // Check for phone number input
    cy.get('input[type="tel"]').should('be.visible');
    
    // Check for the send OTP button
    cy.get('button[type="submit"]').should('be.visible').and('contain', 'Send OTP');
    
    // Check for the app logo
    cy.get('img[alt="TrashDrop"]').should('be.visible');
  });

  it('should show OTP input after sending OTP', () => {
    // Enter a phone number
    cy.get('input[type="tel"]').type('1234567890');
    
    // Click the send OTP button
    cy.get('button[type="submit"]').click();
    
    // Wait for the OTP API call
    cy.wait('@sendOtp');
    
    // Check for the OTP input
    cy.get('input[type="tel"]').should('have.attr', 'placeholder', 'Enter OTP');
    
    // Check for the verify button
    cy.get('button[type="submit"]').should('contain', 'Verify OTP');
  });

  it('should log in with valid OTP', () => {
    // Mock the session storage for a successful login
    cy.window().then((win) => {
      win.localStorage.setItem('sb-access-token', 'test-access-token');
      win.localStorage.setItem('sb-refresh-token', 'test-refresh-token');
    });
    
    // Mock the user data
    cy.intercept('GET', '**/auth/v1/user', {
      statusCode: 200,
      body: {
        id: 'test-user-123',
        phone: '+1234567890',
        role: 'collector'
      }
    }).as('getUser');
    
    // Simulate the OTP verification step
    cy.get('input[type="tel"]').type('1234567890');
    cy.get('button[type="submit"]').click();
    
    // Wait for the OTP API call
    cy.wait('@sendOtp');
    
    // Enter OTP and submit
    cy.get('input[type="tel"]').clear().type('123456');
    cy.get('button[type="submit"]').click();
    
    // Wait for the verify OTP API call
    cy.wait('@verifyOtp');
    
    // Wait for the user data to be fetched
    cy.wait('@getUser');
    
    // Check if the user is redirected to the home page
    cy.url().should('include', '/dashboard');
  });

  it('should show an error for invalid OTP', () => {
    // Mock a failed OTP verification
    cy.intercept('POST', '**/auth/v1/verify', {
      statusCode: 400,
      body: {
        error: 'Invalid OTP',
        message: 'The OTP you entered is invalid.'
      }
    }).as('verifyOtpError');
    
    // Go through the OTP flow
    cy.get('input[type="tel"]').type('1234567890');
    cy.get('button[type="submit"]').click();
    
    // Wait for the OTP API call
    cy.wait('@sendOtp');
    
    // Enter an invalid OTP
    cy.get('input[type="tel"]').clear().type('000000');
    cy.get('button[type="submit"]').click();
    
    // Wait for the error response
    cy.wait('@verifyOtpError');
    
    // Check for the error message
    cy.contains('Invalid OTP').should('be.visible');
  });
});
