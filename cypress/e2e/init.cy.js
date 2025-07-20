/// <reference types="cypress" />

describe('Application Initialization', () => {
  beforeEach(() => {
    // Clear all browser data before each test
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit('/');
  });

  it('should load the application', () => {
    // Check if the root element exists
    cy.get('#root').should('exist');
    
    // Check if the app has mounted by looking for any React content
    cy.get('body').should('not.be.empty');
    
    // Take a screenshot of the initial state
    cy.screenshot('app-initial-state');
    
    // Log the current URL and document title
    cy.url().then(url => console.log('Current URL:', url));
    cy.title().then(title => console.log('Page title:', title));
    
    // Log the body content for debugging (first 500 characters)
    cy.get('body').invoke('text').then(text => {
      console.log('Body content (first 500 chars):', text.substring(0, 500));
    });
    
    // Check for common elements that should be present in a React app
    cy.get('html').should('exist');
    cy.get('head').should('exist');
    
    // Check for React root element
    cy.get('#root').should('exist');
    
    // Check for any loading indicators or error boundaries
    cy.get('[class*="loading"], [class*="loader"], [class*="error"]').then($els => {
      if ($els.length > 0) {
        console.log('Found loading/error elements:', $els.length);
        $els.each((i, el) => {
          console.log(`Element ${i}:`, {
            tag: el.tagName,
            id: el.id,
            class: el.className,
            text: el.textContent.substring(0, 100)
          });
        });
      }
    });
  });

  it('should check for authentication state', () => {
    // Check if we're redirected to login page when not authenticated
    cy.window().then((win) => {
      const isAuthenticated = win.localStorage.getItem('sb-auth-token');
      console.log('Is authenticated:', !!isAuthenticated);
      
      if (isAuthenticated) {
        // If authenticated, we should be on the map page
        cy.url().should('include', '/map');
        cy.get('h1').should('contain', 'Map');
      } else {
        // If not authenticated, we should be on the login page
        cy.url().should('match', /\/(login|\?.*|)$/);
        
        // Check for login form elements with more permissive selectors
        cy.get('input[type="text"], input[type="tel"], input:not([type])').first().should('be.visible');
        cy.contains('button', /login|sign in|send code|verify/i).should('be.visible');
      }
    });
  });

  it('should check for common UI elements', () => {
    // Check for common UI components that should be present
    cy.get('header, nav, main, footer, [role="navigation"]').then($els => {
      console.log('Found UI elements:', $els.length);
      $els.each((i, el) => {
        console.log(`UI Element ${i}:`, {
          tag: el.tagName,
          id: el.id,
          class: el.className,
          role: el.getAttribute('role')
        });
      });
    });
    
    // Check for any error messages or loading states
    cy.get('[class*="error"], [class*="loading"], [role="alert"], [role="status"]').then($els => {
      if ($els.length > 0) {
        console.log('Found status elements:', $els.length);
        $els.each((i, el) => {
          console.log(`Status Element ${i}:`, {
            tag: el.tagName,
            id: el.id,
            class: el.className,
            text: el.textContent.substring(0, 200)
          });
        });
      }
    });
  });
});
