/// <reference types="cypress" />

describe('Network and JavaScript Check', () => {
  beforeEach(() => {
    // Clear any existing state
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Set up network request interception
    cy.intercept('*').as('anyRequest');
    
    // Set up console error tracking
    cy.window().then((win) => {
      cy.stub(win.console, 'error').as('consoleError');
      cy.stub(win.console, 'warn').as('consoleWarn');
    });
    
    // Visit the root URL with no caching
    cy.visit('/', {
      failOnStatusCode: false,
      onBeforeLoad(win) {
        // Disable service workers
        delete win.navigator.__proto__.serviceWorker;
      }
    });
  });

  it('should check for network and JavaScript issues', () => {
    // Wait for all network requests to complete
    cy.wait('@anyRequest', { timeout: 10000 }).then((interception) => {
      console.log('Network request:', {
        url: interception.request.url,
        method: interception.request.method,
        status: interception.response?.statusCode,
        statusText: interception.response?.statusMessage,
        contentType: interception.response?.headers?.['content-type']
      });
    });
    
    // Check for JavaScript errors
    cy.get('@consoleError').then((errorStub) => {
      if (errorStub.callCount > 0) {
        console.error('JavaScript errors detected:');
        errorStub.getCalls().forEach((call, i) => {
          console.error(`Error ${i + 1}:`, call.args);
        });
        
        // Fail the test if there are JavaScript errors
        throw new Error(`${errorStub.callCount} JavaScript errors detected (see console for details)`);
      } else {
        console.log('No JavaScript errors detected');
      }
    });
    
    // Check for console warnings
    cy.get('@consoleWarn').then((warnStub) => {
      if (warnStub.callCount > 0) {
        console.warn('JavaScript warnings detected:');
        warnStub.getCalls().forEach((call, i) => {
          console.warn(`Warning ${i + 1}:`, call.args);
        });
      } else {
        console.log('No JavaScript warnings detected');
      }
    });
    
    // Check for the root element and its content
    cy.get('#root').should('exist').then(($root) => {
      console.log('Root element content:', $root.html());
      
      // Check if the root element has any content
      if ($root.html().trim().length === 0) {
        console.warn('Root element is empty');
      } else {
        console.log('Root element has content');
      }
    });
    
    // Check for any React-related elements
    cy.get('body').then(($body) => {
      const reactRoots = $body.find('[id^="root"], [class*="root"], [class*="app"], [class*="App"]');
      console.log(`Found ${reactRoots.length} potential React root elements`);
      
      reactRoots.each((i, el) => {
        console.log(`Potential React root ${i + 1}:`, {
          tag: el.tagName,
          id: el.id || null,
          class: el.className || null,
          hasChildren: el.children.length > 0,
          text: el.textContent ? el.textContent.trim().substring(0, 100) + 
                (el.textContent.trim().length > 100 ? '...' : '') : null
        });
      });
      
      // Check for any error boundaries or error messages
      const errorElements = $body.find('[class*="error"], [id*="error"], [role="alert"]');
      if (errorElements.length > 0) {
        console.warn(`Found ${errorElements.length} error elements`);
        errorElements.each((i, el) => {
          console.warn(`Error element ${i + 1}:`, el.outerHTML);
        });
      } else {
        console.log('No error elements found');
      }
    });
    
    // Take a screenshot of the current state
    cy.screenshot('network-check');
  });
});
