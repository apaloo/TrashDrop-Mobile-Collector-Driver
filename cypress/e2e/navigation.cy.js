/// <reference types="cypress" />

describe('App Navigation', () => {
  beforeEach(() => {
    // Clear any existing state
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Visit the root URL
    cy.visit('/');
    
    // Wait for the app to load
    cy.get('body').should('be.visible');
  });

  it('should display the login page by default', () => {
    // Verify we're on the login page
    cy.url().should('include', '/login');
    
    // Check for login form elements
    cy.get('input[type="tel"]').should('be.visible');
    cy.contains('button', /Send Verification Code|Login/i).should('be.visible');
    
    // Take a screenshot
    cy.screenshot('login-page');
  });

  it('should navigate to signup page', () => {
    // Click on the signup link if it exists
    cy.get('a[href*="signup"], button:contains("Sign Up")').first().click();
    
    // Verify we're on the signup page
    cy.url().should('include', '/signup');
    
    // Check for signup form elements
    cy.get('input[type="text"]').should('be.visible');
    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="tel"]').should('be.visible');
    cy.contains('button', /Sign Up|Create Account/i).should('be.visible');
    
    // Take a screenshot
    cy.screenshot('signup-page');
  });

  it('should handle login with test credentials', () => {
    // Mock a successful login response
    cy.intercept('POST', '**/auth/v1/token', {
      statusCode: 200,
      body: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          phone: '+1234567890'
        }
      }
    }).as('loginRequest');

    // Fill out the login form
    cy.get('input[type="tel"]').type('+1234567890');
    cy.contains('button', /Send Verification Code|Login/i).click();
    
    // Wait for the login request to complete
    cy.wait('@loginRequest');
    
    // Verify we're redirected to the map page after login
    cy.url().should('include', '/map');
    
    // Take a screenshot
    cy.screenshot('after-login');
    
    // Check for navigation elements
    cy.get('nav, [role="navigation"]').should('be.visible');
    
    // Check for map container
    cy.get('.leaflet-container, [class*="map"], [id*="map"]', { timeout: 10000 })
      .should('be.visible')
      .should(($el) => {
        // Verify the map container has reasonable dimensions
        expect($el.width()).to.be.greaterThan(100);
        expect($el.height()).to.be.greaterThan(100);
      });
  });
});
