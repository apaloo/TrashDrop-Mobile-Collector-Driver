/// <reference types="cypress" />

describe('Application Status Check', () => {
  it('should be accessible', () => {
    // First, check if the development server is running
    cy.request({
      url: 'http://localhost:5173', // Default Vite dev server port
      failOnStatusCode: false
    }).then((response) => {
      console.log('Application status check:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers['content-type'],
        body: response.body ? 'Received response body' : 'No response body'
      });
      
      // Even if the status is not 200, we'll continue to check if React is loaded
      cy.visit('http://localhost:5173', {
        failOnStatusCode: false,
        onBeforeLoad(win) {
          // Disable service workers
          delete win.navigator.__proto__.serviceWorker;
        }
      });
      
      // Check for the root element
      cy.get('#root').should('exist');
      
      // Check if React is loaded
      cy.window().then((win) => {
        const hasReact = !!win.React;
        const hasReactDOM = !!win.ReactDOM;
        
        console.log('React available:', hasReact);
        console.log('ReactDOM available:', hasReactDOM);
        
        if (!hasReact || !hasReactDOM) {
          throw new Error('React is not properly loaded');
        }
        
        // Check for any React components
        const reactRoot = win.document.getElementById('root');
        if (reactRoot && reactRoot._reactRootContainer) {
          console.log('React application is mounted');
        } else {
          console.log('React application is not properly mounted');
          // Try to find any React components in the DOM
          const reactComponents = win.document.querySelectorAll('[data-reactroot], [data-reactid], [class*="App"], [class*="app"]');
          console.log('Potential React components found:', reactComponents.length);
        }
      });
      
      // Take a screenshot for visual inspection
      cy.screenshot('app-status');
    });
  });
  
  it('should check for common UI elements', () => {
    cy.visit('http://localhost:5173', {
      failOnStatusCode: false,
      onBeforeLoad(win) {
        // Disable service workers
        delete win.navigator.__proto__.serviceWorker;
      }
    });
    
    // Check for common UI elements
    cy.get('body').then(($body) => {
      // Log the entire document structure for debugging
      console.log('Document structure:', $body.html());
      
      // Check for any visible elements
      const visibleElements = [];
      $body.find('*').each((i, el) => {
        const style = window.getComputedStyle(el);
        const isVisible = style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         style.opacity !== '0';
        
        if (isVisible && el.textContent && el.textContent.trim() !== '') {
          visibleElements.push({
            tag: el.tagName,
            id: el.id || null,
            class: el.className || null,
            text: el.textContent.trim().substring(0, 50) + 
                  (el.textContent.trim().length > 50 ? '...' : '')
          });
        }
        
        // Only check the first 50 elements to avoid excessive output
        return i < 50;
      });
      
      console.log('Visible elements with text:', visibleElements);
      
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
    });
  });
});
