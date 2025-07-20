/// <reference types="cypress" />

describe('Development Server Check', () => {
  it('should be accessible', () => {
    // First, try to visit the root URL
    cy.visit('/', {
      failOnStatusCode: false,
      timeout: 10000,
      onBeforeLoad(win) {
        // Disable service workers
        delete win.navigator.__proto__.serviceWorker;
      }
    });
    
    // Log the current URL and document state
    cy.url().then(url => console.log('Current URL:', url));
    cy.document().then(doc => {
      console.log('Document title:', doc.title);
      console.log('Document readyState:', doc.readyState);
      console.log('Document body content length:', doc.body.innerText.length);
      console.log('Document body first 500 chars:', doc.body.innerText.substring(0, 500));
      
      // Log any errors in the console
      const errors = [];
      const originalConsoleError = console.error;
      console.error = function() {
        errors.push(Array.from(arguments));
        originalConsoleError.apply(console, arguments);
      };
      
      // Log any uncaught exceptions
      window.onerror = function(message, source, lineno, colno, error) {
        console.error('Uncaught error:', { message, source, lineno, colno, error });
      };
      
      // Log any unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled rejection:', event.reason);
      });
      
      // Log any resources that failed to load
      window.addEventListener('error', (event) => {
        if (event.target && (event.target.tagName === 'LINK' || event.target.tagName === 'SCRIPT' || event.target.tagName === 'IMG')) {
          console.error('Failed to load resource:', event.target.src || event.target.href);
        }
      }, true);
    });
    
    // Take a screenshot of the current state
    cy.screenshot('server-check');
    
    // Basic checks that should pass if the app is running
    cy.get('body').should('exist');
    cy.get('html').should('exist');
    
    // Check for common error states
    cy.get('body').then(($body) => {
      if ($body.find('div[role="alert"], [class*="error"], [class*="overlay"]').length > 0) {
        console.error('Found error overlay:', $body.html());
      }
    });
    
    // Check for React root element
    cy.get('#root').should('exist');
    
    // Check for common loading states
    cy.get('body').then(($body) => {
      const loadingElements = $body.find('[class*="loading"], [class*="loader"]');
      if (loadingElements.length > 0) {
        console.log('Found loading elements:', loadingElements.length);
      }
    });
  });
});
