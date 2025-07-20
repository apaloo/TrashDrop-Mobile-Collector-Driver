/// <reference types="cypress" />

/**
 * Main authentication test suite
 * 
 * This file contains the main test cases for the authentication flow.
 * For more specific test cases, see the following files:
 * - login-form.cy.js: Tests for the login form UI and validation
 * - otp-verification.cy.js: Tests for the OTP verification flow
 * - session-management.cy.js: Tests for session persistence and logout
 */

describe('Authentication Flow - Happy Path', () => {
  const testPhone = '+14155552671';
  const testOtp = '123456';
  
  before(() => {
    // Load custom commands
    require('../../support/auth/commands');
  });
  
  beforeEach(() => {
    // Clear all auth data before each test
    cy.clearAuthData();
    
    // Setup mocks
    cy.mockOtpSend()
      .then((sessionId) => cy.mockOtpVerify(testPhone, sessionId));
    
    // Visit the login page
    cy.visit('/', {
      timeout: 10000,
      onBeforeLoad(win) {
        // Disable service workers to prevent caching issues
        delete win.navigator.__proto__.serviceWorker;
      },
    });
    
    // Wait for the app to be fully loaded
    cy.get('body').should('be.visible');
  });

  it('should complete the full login flow successfully', () => {
    // 1. Enter phone number and request OTP
    cy.enterPhoneNumber(testPhone);
    cy.clickSendVerificationCode();
    
    // Wait for OTP send request
    cy.wait('@sendOtp').then((interception) => {
      expect(interception.request.body).to.include({
        phone: testPhone,
        type: 'sms'
      });
    });
    
    // 2. Verify OTP input is displayed
    cy.get('input[inputmode="numeric"]', { timeout: 10000 })
      .should('be.visible')
      .should('have.attr', 'maxlength', '6');
    
    // 3. Enter and verify OTP
    cy.enterOtp(testOtp);
    cy.clickVerifyOtp();
    
    // Wait for OTP verification
    cy.wait('@verifyOtp').then((interception) => {
      expect(interception.request.body).to.include({
        phone: testPhone,
        token: testOtp,
        type: 'sms'
      });
    });
    
    // 4. Verify successful login
    cy.verifyLoggedIn(testPhone);
    
    // 5. Take a screenshot after successful login
    cy.screenshot('happy-path-login-success');
  });
  
  it('should handle network errors gracefully', () => {
    // Setup network error for OTP send
    cy.intercept('POST', '**/auth/v1/otp', {
      forceNetworkError: true
    }).as('sendOtpError');
    
    // Enter phone number and submit
    cy.enterPhoneNumber(testPhone);
    cy.clickSendVerificationCode();
    
    // Verify error handling
    cy.contains(/network error|unable to connect/i, { timeout: 10000 })
      .should('be.visible');
    
    // Take a screenshot of the error state
    cy.screenshot('network-error-handling');
  });
});
