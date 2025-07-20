/// <reference types="cypress" />

describe('Basic Rendering Check', () => {
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

  it('should render the application container', () => {
    // Check for the root element
    cy.get('#root').should('exist');
    
    // Check for common UI elements
    cy.get('body').then(($body) => {
      // Log the HTML structure for debugging
      console.log('Body HTML:', $body.html());
      
      // Check for any visible elements
      const visibleElements = [];
      $body.find('*').each((i, el) => {
        const style = window.getComputedStyle(el);
        const isVisible = style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         style.opacity !== '0';
        
        if (isVisible) {
          visibleElements.push({
            tag: el.tagName,
            id: el.id || null,
            class: el.className || null,
            text: el.textContent ? el.textContent.trim().substring(0, 50) + 
                  (el.textContent.trim().length > 50 ? '...' : '') : null
          });
        }
        
        // Only check the first 50 elements to avoid excessive output
        return i < 50;
      });
      
      console.log('Visible elements:', visibleElements);
      
      // Check for common React app containers
      const reactRoots = $body.find('[id^="root"], [class*="root"], [class*="app"], [class*="App"]');
      console.log('Potential React roots:', reactRoots.length);
      
      // Log any script tags
      const scripts = $body.find('script');
      console.log('Script tags:', scripts.length);
      
      // Log any error messages or loading indicators
      const errorElements = $body.find('[class*="error"], [id*="error"], [role="alert"]');
      console.log('Error elements:', errorElements.length);
      
      const loadingIndicators = $body.find('[class*="loading"], [class*="spinner"], [class*="loader"]');
      console.log('Loading indicators:', loadingIndicators.length);
      
      // Take a screenshot for visual inspection
      cy.screenshot('basic-rendering');
    });
  });

  it('should check for JavaScript errors', () => {
    // Listen for console errors
    cy.window().then((win) => {
      const originalConsoleError = win.console.error;
      const errors = [];
      
      win.console.error = function() {
        errors.push(Array.from(arguments));
        originalConsoleError.apply(win.console, arguments);
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
      const authElements = $body.find('[class*="auth"], [class*="login"], [class*="signin"]');
      console.log('Auth-related elements:', authElements.length);
      
      // Check for login form elements
      const loginForm = $body.find('form[class*="login"], form[class*="signin"], form[class*="auth"]');
      console.log('Login forms:', loginForm.length);
      
      // Check for protected content
      const protectedContent = $body.find('[class*="protected"], [class*="private"], [class*="authenticated"]');
      console.log('Protected content elements:', protectedContent.length);
      
      // Check for any authentication-related text
      const authTexts = [];
      const authKeywords = ['login', 'sign in', 'sign up', 'register', 'welcome', 'dashboard'];
      
      $body.find('*').each((i, el) => {
        if (el.textContent) {
          const text = el.textContent.trim().toLowerCase();
          if (authKeywords.some(keyword => text.includes(keyword))) {
            authTexts.push({
              tag: el.tagName,
              id: el.id || null,
              class: el.className || null,
              text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
            });
          }
        }
        
        // Only check the first 100 elements to avoid excessive processing
        return i < 100;
      });
      
      console.log('Auth-related text elements:', authTexts);
    });
  });
});
