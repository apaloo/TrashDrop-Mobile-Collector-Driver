/// <reference types="cypress" />

describe('Basic Application Check', () => {
  beforeEach(() => {
    // Clear any existing state
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Visit the root URL with no caching
    cy.visit('/', {
      failOnStatusCode: false,
      onBeforeLoad(win) {
        // Disable service workers
        delete win.navigator.__proto__.serviceWorker;
      }
    });
  });

  it('should load the application', () => {
    // Check if the root element exists
    cy.get('#root').should('exist');
    
    // Check if the page title is set
    cy.title().should('include', 'TrashDrop');
    
    // Log the current URL
    cy.url().then(url => console.log('Current URL:', url));
    
    // Take a screenshot for visual inspection
    cy.screenshot('app-loaded');
  });

  it('should check for React components', () => {
    // Check for React root element
    cy.window().then((win) => {
      // Check if React is loaded
      const hasReact = !!win.React;
      const hasReactDOM = !!win.ReactDOM;
      
      console.log('React available:', hasReact);
      console.log('ReactDOM available:', hasReactDOM);
      
      // If React is available, check for React components
      if (hasReact) {
        // Try to find any React components in the DOM
        const reactRoot = win.document.getElementById('root');
        if (reactRoot && reactRoot._reactRootContainer) {
          console.log('React root container found');
        } else {
          console.log('React root container not found');
        }
      }
    });
    
    // Check for common React component patterns
    cy.get('body').then(($body) => {
      // Look for elements with data-reactroot (older React versions)
      const reactRoots = $body.find('[data-reactroot]');
      console.log('Elements with data-reactroot:', reactRoots.length);
      
      // Look for elements with data-reactid (older React versions)
      const reactIds = $body.find('[data-reactid]');
      console.log('Elements with data-reactid:', reactIds.length);
      
      // Look for elements with __reactFiber or __reactProps (newer React versions)
      const reactFibers = $body.find('*').filter((i, el) => {
        return el.__reactFiber$ || el.__reactProps$;
      });
      console.log('Elements with React fiber/props:', reactFibers.length);
    });
  });

  it('should check for JavaScript errors', () => {
    // Listen for uncaught exceptions
    cy.on('uncaught:exception', (err, runnable) => {
      console.error('Uncaught exception:', err);
      return false; // don't fail the test
    });
    
    // Check for console errors
    cy.window().then((win) => {
      const originalConsoleError = win.console.error;
      const errors = [];
      
      win.console.error = function() {
        errors.push(Array.from(arguments));
        return originalConsoleError.apply(win.console, arguments);
      };
      
      // Wait a moment for any errors to be logged
      return new Cypress.Promise((resolve) => {
        setTimeout(() => {
          win.console.error = originalConsoleError;
          
          if (errors.length > 0) {
            console.error('JavaScript errors detected:', errors);
            // Fail the test if there are JavaScript errors
            throw new Error(`Detected ${errors.length} JavaScript errors (see console for details)`);
          } else {
            console.log('No JavaScript errors detected');
            resolve();
          }
        }, 1000);
      });
    });
  });

  it('should check for network requests', () => {
    // Set up network request interception
    cy.intercept('*').as('anyRequest');
    
    // Wait for any network requests to complete
    cy.wait('@anyRequest', { timeout: 10000 }).then((interception) => {
      if (interception) {
        console.log('Network request detected:', {
          url: interception.request.url,
          method: interception.request.method,
          status: interception.response?.statusCode,
          statusText: interception.response?.statusMessage,
          contentType: interception.response?.headers?.['content-type']
        });
      } else {
        console.log('No network requests detected');
      }
    });
  });

  it('should check for authentication state', () => {
    // Check if there's any authentication-related UI
    cy.get('body').then(($body) => {
      // Look for common auth-related elements
      const loginLinks = $body.find('a[href*="login"], button:contains("Login"), button:contains("Sign in")');
      console.log('Login links/buttons found:', loginLinks.length);
      
      const signupLinks = $body.find('a[href*="signup"], button:contains("Sign up"), button:contains("Register")');
      console.log('Signup links/buttons found:', signupLinks.length);
      
      // Look for any forms that might be login forms
      const forms = $body.find('form');
      console.log('Forms found:', forms.length);
      
      // Log the inner HTML of the first form (if any)
      if (forms.length > 0) {
        console.log('First form HTML:', forms[0].outerHTML);
      }
      
      // Look for any input fields
      const inputs = $body.find('input');
      console.log('Input fields found:', inputs.length);
      
      // Log the types of input fields found
      const inputTypes = {};
      inputs.each((i, el) => {
        const type = el.type || 'text';
        inputTypes[type] = (inputTypes[type] || 0) + 1;
      });
      console.log('Input field types:', inputTypes);
    });
  });
});
