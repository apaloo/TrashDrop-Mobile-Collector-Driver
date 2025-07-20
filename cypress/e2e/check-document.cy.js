/// <reference types="cypress" />

describe('Document Check', () => {
  it('should log document information', () => {
    // Visit the root URL with no caching
    cy.visit('/', {
      failOnStatusCode: false,
      onBeforeLoad(win) {
        // Disable service workers
        delete win.navigator.__proto__.serviceWorker;
      }
    });
    
    // Log basic document information
    cy.document().then(doc => {
      console.log('Document title:', doc.title);
      console.log('Document readyState:', doc.readyState);
      console.log('Document charset:', doc.characterSet);
      console.log('Document content type:', doc.contentType);
      
      // Log the HTML content (first 2000 characters)
      console.log('HTML content (first 2000 chars):', 
        doc.documentElement.outerHTML.substring(0, 2000) + 
        (doc.documentElement.outerHTML.length > 2000 ? '...' : '')
      );
      
      // Log all elements in the document
      const elements = [];
      const walker = doc.createTreeWalker(
        doc.documentElement,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
      );
      
      let node;
      while ((node = walker.nextNode())) {
        elements.push({
          tag: node.tagName,
          id: node.id || null,
          className: node.className || null,
          text: node.textContent ? node.textContent.trim().substring(0, 50) + 
                (node.textContent.trim().length > 50 ? '...' : '') : null
        });
        
        // Stop after collecting 50 elements to avoid excessive output
        if (elements.length >= 50) {
          elements.push({ message: '... (more elements not shown)' });
          break;
        }
      }
      
      console.log('Elements in document:', elements);
      
      // Log script sources
      const scripts = Array.from(doc.scripts);
      console.log('Scripts:', scripts.map(s => ({
        src: s.src || 'inline',
        type: s.type || 'text/javascript',
        async: s.async,
        defer: s.defer
      })));
      
      // Log stylesheets
      const styles = Array.from(doc.styleSheets);
      console.log('Stylesheets:', styles.map(s => ({
        href: s.href || 'inline',
        disabled: s.disabled,
        rules: s.rules ? s.rules.length : 'N/A'
      })));
      
      // Check for React
      console.log('React available:', 'React' in window);
      console.log('ReactDOM available:', 'ReactDOM' in window);
      
      // Check for any global variables that might indicate the app is loaded
      console.log('Global variables:', Object.keys(window).filter(k => 
        k.startsWith('app') || 
        k.startsWith('trashdrop') || 
        k.startsWith('td') ||
        k.toLowerCase().includes('app') ||
        k.toLowerCase().includes('trashdrop')
      ));
    });
    
    // Check for any error messages in the console
    cy.window().then(win => {
      const originalConsoleError = win.console.error;
      const errors = [];
      
      win.console.error = function() {
        errors.push(Array.from(arguments));
        originalConsoleError.apply(win.console, arguments);
      };
      
      // Wait a moment for any errors to be logged
      return new Cypress.Promise(resolve => {
        setTimeout(() => {
          win.console.error = originalConsoleError;
          if (errors.length > 0) {
            console.error('Console errors:', errors);
          } else {
            console.log('No console errors detected');
          }
          resolve();
        }, 1000);
      });
    });
    
    // Check for any visible elements
    cy.get('*').then($elements => {
      console.log(`Found ${$elements.length} elements in the document`);
      
      // Log the first 10 visible elements
      const visibleElements = [];
      $elements.each((index, el) => {
        if (index >= 10) return false; // Only log first 10
        
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          visibleElements.push({
            tag: el.tagName,
            id: el.id || null,
            className: el.className || null,
            text: el.textContent ? el.textContent.trim().substring(0, 50) + 
                  (el.textContent.trim().length > 50 ? '...' : '') : null
          });
        }
      });
      
      console.log('First 10 visible elements:', visibleElements);
    });
    
    // Check for any error overlays
    cy.get('body').then($body => {
      const errorOverlay = $body.find('div[role="alert"], [class*="error"], [class*="overlay"]');
      if (errorOverlay.length > 0) {
        console.error('Found error overlay:', errorOverlay[0].outerHTML);
      } else {
        console.log('No error overlays found');
      }
    });
  });
});
