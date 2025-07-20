/// <reference types="cypress" />

describe('API and Application Structure Check', () => {
  beforeEach(() => {
    // Clear any existing state
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Spy on all network requests
    cy.intercept('*').as('anyRequest');
    
    // Visit the application
    cy.visit('/', {
      failOnStatusCode: false,
      onBeforeLoad(win) {
        // Disable service workers
        delete win.navigator.__proto__.serviceWorker;
      }
    });
  });

  it('should check for API requests after page load', () => {
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
    
    // Log the current URL and page title
    cy.url().then(url => console.log('Current URL:', url));
    cy.title().then(title => console.log('Page title:', title));
    
    // Log any JavaScript errors
    cy.window().then((win) => {
      const originalConsoleError = win.console.error;
      win.console.error = function() {
        console.error('JavaScript error:', ...arguments);
        return originalConsoleError.apply(win.console, arguments);
      };
    });
    
    // Check for common application elements
    cy.document().then(doc => {
      // Log the entire document structure for debugging
      console.log('Document structure:', doc.documentElement.outerHTML);
      
      // Check for React root element
      const reactRoot = doc.getElementById('root');
      console.log('React root element:', reactRoot ? 'Found' : 'Not found');
      
      if (reactRoot) {
        console.log('React root content:', reactRoot.innerHTML);
      }
      
      // Check for common UI elements
      const loginForm = doc.querySelector('form');
      console.log('Form elements:', loginForm ? 'Found' : 'Not found');
      
      const buttons = doc.querySelectorAll('button');
      console.log('Buttons found:', buttons.length);
      
      const inputs = doc.querySelectorAll('input');
      console.log('Input fields found:', inputs.length);
      
      // Log all elements with IDs for debugging
      const elementsWithIds = doc.querySelectorAll('[id]');
      console.log('Elements with IDs:');
      elementsWithIds.forEach(el => {
        console.log(`- ${el.tagName}#${el.id}`);
      });
      
      // Log all elements with classes for debugging
      const elementsWithClasses = doc.querySelectorAll('[class]');
      console.log('Elements with classes:');
      elementsWithClasses.forEach(el => {
        console.log(`- ${el.tagName}.${el.className.replace(/\s+/g, '.')}`);
      });
    });
  });

  it('should verify API endpoints', () => {
    // Test the assignments endpoint
    cy.request({
      method: 'GET',
      url: '/api/assignments',
      failOnStatusCode: false
    }).then((response) => {
      console.log('Assignments API response:', {
        status: response.status,
        statusText: response.statusText,
        body: response.body
      });
      
      // If the request fails, it's okay - we're just checking if the endpoint exists
      if (response.status === 200) {
        // If successful, check the response structure
        expect(response.body).to.have.property('available').and.to.be.an('array');
        expect(response.body).to.have.property('accepted').and.to.be.an('array');
        expect(response.body).to.have.property('completed').and.to.be.an('array');
      }
    });
    
    // Test the authentication endpoint
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: {
        email: 'test@example.com',
        password: 'password123'
      },
      failOnStatusCode: false
    }).then((response) => {
      console.log('Login API response:', {
        status: response.status,
        statusText: response.statusText,
        body: response.body
      });
    });
  });

  it('should check for application initialization', () => {
    // Check if the application is properly initialized
    cy.window().then((win) => {
      // Check for React
      const hasReact = !!win.React;
      const hasReactDOM = !!win.ReactDOM;
      console.log('React available:', hasReact);
      console.log('ReactDOM available:', hasReactDOM);
      
      // Check for any global application state
      const appState = win.__APP_STATE__ || win.appState || {};
      console.log('Application state:', appState);
      
      // Check for any initialization errors
      const errors = win.__CYPRESS_ERRORS__ || [];
      if (errors.length > 0) {
        console.error('Application errors:', errors);
        throw new Error(`Found ${errors.length} application errors`);
      }
    });
    
    // Check for any loading indicators
    const loadingSelectors = [
      '.loading', '.spinner', '.loader',
      '[role="progressbar"]',
      'div[class*="loading"]',
      'div[class*="spinner"]',
      'div[class*="loader"]'
    ];
    
    // Check if any loading indicator is visible
    let loadingFound = false;
    loadingSelectors.forEach(selector => {
      cy.get('body').then($body => {
        if ($body.find(selector).length > 0) {
          console.log(`Found loading indicator with selector: ${selector}`);
          loadingFound = true;
        }
      });
    });
    
    if (loadingFound) {
      console.log('Application is still loading...');
      // Wait a bit more for the application to load
      cy.wait(5000);
    }
    
    // Take a screenshot for visual inspection
    cy.screenshot('application-state');
  });
});
