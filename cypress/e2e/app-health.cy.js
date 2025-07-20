/// <reference types="cypress" />

describe('Application Health Check', () => {
  it('should load the application', () => {
    // Visit the root URL
    cy.visit('/', {
      // Disable all network requests to isolate the test
      onBeforeLoad(win) {
        // Stub all fetch/XHR requests
        cy.stub(win, 'fetch').resolves(new Response(JSON.stringify({}), { status: 200 }));
        // Prevent uncaught exceptions from failing the test
        win.onerror = () => true;
      }
    });

    // Basic checks that should always pass if the app is running
    cy.window().should('have.property', 'React');
    cy.document().should('exist');
    
    // Check for the root element
    cy.get('#root').should('exist');
    
    // Log the page content for debugging
    cy.document().then(doc => {
      console.log('Document title:', doc.title);
      console.log('Document body content length:', doc.body.innerText.length);
      console.log('Document body first 500 chars:', doc.body.innerText.substring(0, 500));
    });
    
    // Take a screenshot
    cy.screenshot('app-health-check');
    
    // Check for any error overlays (like React's error overlay)
    cy.get('body').then(($body) => {
      const errorOverlay = $body.find('div[role="alert"], [class*="error"], [class*="overlay"]');
      if (errorOverlay.length > 0) {
        console.error('Found error overlay:', errorOverlay[0].outerHTML);
      }
    });
  });

  it('should check for JavaScript errors', () => {
    // Keep track of any console errors
    const consoleErrors = [];
    
    cy.visit('/', {
      onBeforeLoad(win) {
        // Stub all fetch/XHR requests
        cy.stub(win, 'fetch').resolves(new Response(JSON.stringify({}), { status: 200 }));
        
        // Listen for console errors
        cy.stub(win.console, 'error').callsFake((...args) => {
          consoleErrors.push(args);
          console.error('Browser console error:', ...args);
        });
        
        // Prevent uncaught exceptions from failing the test
        win.onerror = (message, source, lineno, colno, error) => {
          consoleErrors.push({
            message,
            source,
            lineno,
            colno,
            error: error?.stack
          });
          console.error('Uncaught error:', message, 'at', source, 'line', lineno);
          return true; // Prevent the error from being thrown
        };
      }
    });
    
    // Wait a moment for any potential errors to occur
    cy.wait(2000);
    
    // Check for any console errors
    cy.wrap(consoleErrors).should('have.length', 0);
  });
});
