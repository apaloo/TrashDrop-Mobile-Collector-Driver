/// <reference types="cypress" />

describe('OTP Verification Flow', () => {
  const testPhone = '+14155552671';
  const testOtp = '123456';
  let sessionId;

  beforeEach(() => {
    // Clear all auth data before each test
    cy.clearAuthData();
    
    // Setup mocks
    sessionId = `test-session-${Date.now()}`;
    cy.mockOtpSend(sessionId).then((id) => {
      sessionId = id;
      return cy.mockOtpVerify(testPhone, sessionId);
    });
    
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
    
    // Enter phone number and request OTP
    cy.enterPhoneNumber(testPhone);
    cy.clickSendVerificationCode();
    
    // Wait for OTP send request
    cy.wait('@sendOtp');
  });

  it('should display OTP input after phone number submission', () => {
    // Verify OTP input is visible and has correct attributes
    cy.get('input[inputmode="numeric"]', { timeout: 10000 })
      .should('be.visible')
      .should('have.attr', 'maxlength', '6')
      .should('have.attr', 'placeholder', 'Enter 6-digit code');
      
    // Verify the verify button is disabled initially
    cy.contains('button', /Verify OTP|Login/i)
      .should('be.visible')
      .should('be.disabled');
  });
  
  it('should validate OTP input', () => {
    // Test with partial OTP (5 digits)
    cy.enterOtp('12345');
    cy.contains('button', /Verify OTP|Login/i)
      .should('be.visible')
      .should('be.disabled');
    
    // Test with full OTP (6 digits)
    cy.enterOtp(testOtp);
    cy.contains('button', /Verify OTP|Login/i)
      .should('be.visible')
      .should('not.be.disabled');
  });
  
  it('should verify OTP and log in successfully', () => {
    // Complete OTP and submit
    cy.enterOtp(testOtp);
    cy.clickVerifyOtp();
    
    // Wait for OTP verification request
    cy.wait('@verifyOtp').then((interception) => {
      expect(interception.request.body).to.include({
        phone: testPhone,
        token: testOtp,
        type: 'sms',
        sessionId: sessionId
      });
    });
    
    // Verify successful login
    cy.verifyLoggedIn(testPhone);
    
    // Take a screenshot after successful login
    cy.screenshot('after-successful-login');
  });
  
  it('should handle invalid OTP', () => {
    // Mock failed verification
    cy.intercept('POST', '**/auth/v1/verify', {
      statusCode: 400,
      body: {
        error: 'Invalid OTP',
        message: 'The provided OTP is invalid or has expired'
      }
    }).as('verifyOtpFail');
    
    // Enter OTP and submit
    cy.enterOtp('654321'); // Wrong OTP
    cy.clickVerifyOtp();
    
    // Wait for failed verification
    cy.wait('@verifyOtpFail');
    
    // Verify error message is displayed
    cy.contains(/invalid|error|try again/i)
      .should('be.visible');
      
    // Take a screenshot of the error state
    cy.screenshot('otp-verification-failed');
  });
});
