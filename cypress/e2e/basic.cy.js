/// <reference types="cypress" />

describe('Basic App Test', () => {
  it('should load the login page', () => {
    // Clear any existing sessions and local storage
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Visit the root URL
    cy.visit('/');
    
    // Verify we're on the login page
    cy.url().should('include', '/login');
    
    // Check for login form elements
    cy.get('input[type="tel"]').should('be.visible');
    cy.contains('button', 'Send Verification Code').should('be.visible');
  });
  
  it('should log in programmatically', () => {
    // Programmatically log in
    cy.programmaticLogin();
    
    // Verify we're redirected to the map page
    cy.url().should('include', '/map');
    
    // Check for basic page structure
    cy.get('body').should('be.visible');
    
    // Log the document structure for debugging
    cy.document().then(doc => {
      console.log('Document title:', doc.title);
      console.log('Body classes:', doc.body.className);
      console.log('Body children count:', doc.body.children.length);
      
      // Log all elements with map-related classes
      const mapElements = doc.querySelectorAll('[class*="map"], [class*="leaflet"], [id*="map"]');
      console.log(`Found ${mapElements.length} potential map elements`);
      
      // Log information about potential map elements
      mapElements.forEach((el, i) => {
        console.log(`Element ${i}:`, {
          tag: el.tagName,
          id: el.id,
          class: el.className,
          visible: el.offsetParent !== null,
          width: el.offsetWidth,
          height: el.offsetHeight
        });
      });
    });
    
    // Take a screenshot of the page
    cy.screenshot('after-login');
    
    // Check for navigation elements
    cy.get('nav').should('be.visible');
    
    // Check for at least one navigation link
    cy.get('nav a, nav button').should('have.length.gt', 0);
  });
});
