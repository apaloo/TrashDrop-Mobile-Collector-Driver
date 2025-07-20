/// <reference types="cypress" />

describe('Session Management', () => {
  const testPhone = '+14155552671';
  const testOtp = '123456';
  
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
  
  it('should persist session on page refresh', () => {
    // Log in first
    cy.enterPhoneNumber(testPhone);
    cy.clickSendVerificationCode();
    cy.wait('@sendOtp');
    
    cy.enterOtp(testOtp);
    cy.clickVerifyOtp();
    cy.wait('@verifyOtp');
    
    // Verify we're logged in
    cy.verifyLoggedIn(testPhone);
    
    // Get the auth tokens before refresh
    cy.window().then((win) => {
      const accessToken = win.localStorage.getItem('sb-access-token');
      const refreshToken = win.localStorage.getItem('sb-refresh-token');
      const userData = JSON.parse(win.localStorage.getItem('sb-user') || '{}');
      
      // Refresh the page
      cy.reload();
      
      // Verify we're still logged in after refresh
      cy.url().should('include', '/map');
      
      // Verify auth state is preserved
      cy.window().should((win) => {
        expect(win.localStorage.getItem('sb-access-token')).to.eq(accessToken);
        expect(win.localStorage.getItem('sb-refresh-token')).to.eq(refreshToken);
        
        const newUserData = JSON.parse(win.localStorage.getItem('sb-user') || '{}');
        expect(newUserData).to.deep.eq(userData);
      });
    });
  });
  
  it('should log out successfully', () => {
    // Log in first
    cy.enterPhoneNumber(testPhone);
    cy.clickSendVerificationCode();
    cy.wait('@sendOtp');
    
    cy.enterOtp(testOtp);
    cy.clickVerifyOtp();
    cy.wait('@verifyOtp');
    
    // Verify we're logged in
    cy.verifyLoggedIn(testPhone);
    
    // Mock the logout API call if needed
    cy.intercept('POST', '**/auth/v1/logout', {
      statusCode: 200,
      body: { message: 'Successfully logged out' }
    }).as('logout');
    
    // Find and click the logout button
    // Note: Update the selector based on your actual UI
    cy.get('button[aria-label="Logout"], [data-testid="logout-button"]')
      .should('be.visible')
      .click();
    
    // Wait for logout to complete
    cy.wait('@logout');
    
    // Verify we're redirected to the login page
    cy.url().should('include', '/login');
    
    // Verify auth data is cleared
    cy.window().then((win) => {
      expect(win.localStorage.getItem('sb-access-token')).to.be.null;
      expect(win.localStorage.getItem('sb-refresh-token')).to.be.null;
      expect(win.localStorage.getItem('sb-user')).to.be.null;
    });
    
    // Verify we can't access protected routes
    cy.visit('/map', { failOnStatusCode: false });
    cy.url().should('include', '/login');
  });
  
  it('should redirect to login when not authenticated', () => {
    // Clear all auth data
    cy.clearAuthData();
    
    // Try to access a protected route
    cy.visit('/map', { failOnStatusCode: false });
    
    // Should be redirected to login
    cy.url().should('include', '/login');
    
    // Should show an error message
    cy.contains(/please log in/i).should('be.visible');
  });
});
