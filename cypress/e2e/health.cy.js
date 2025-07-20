/// <reference types="cypress" />

describe('App Health Check', () => {
  it('should load the application', () => {
    // Visit the root URL
    cy.visit('/');
    
    // Check if the page has loaded
    cy.document().should('exist');
    cy.get('body').should('be.visible');
    
    // Take a screenshot for debugging
    cy.screenshot('app-loaded');
    
    // Log the current URL and document title
    cy.url().then(url => console.log('Current URL:', url));
    cy.title().then(title => console.log('Page title:', title));
    
    // Log the body content for debugging (first 500 characters)
    cy.get('body').invoke('text').then(text => {
      console.log('Body content (first 500 chars):', text.substring(0, 500));
    });
    
    // Check for common elements that should be present
    cy.get('html').should('exist');
    cy.get('head').should('exist');
    
    // Check if there's a root div where the React app is mounted
    cy.get('#root, [data-testid="root"], [id*="app"], [id*="root"]').should('exist');
    
    // Check for any React error boundaries
    cy.window().then((win) => {
      const reactError = win.document.querySelector('[data-react-error-boundary]');
      if (reactError) {
        console.error('React error boundary caught an error:', reactError.textContent);
      }
    });
  });
});
