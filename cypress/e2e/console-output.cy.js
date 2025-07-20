/// <reference types="cypress" />

describe('Console Output Capture', () => {
  beforeEach(() => {
    // Clear any existing state
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Listen to console.log calls
    cy.window().then((win) => {
      cy.stub(win.console, 'log').as('consoleLog');
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

  it('should capture console output', () => {
    // Wait for the page to load
    cy.get('body', { timeout: 10000 }).should('exist');
    
    // Log the document structure
    cy.document().then((doc) => {
      console.log('Document title:', doc.title);
      console.log('Document readyState:', doc.readyState);
      
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
    });
    
    // Wait a moment for any async content to load
    cy.wait(1000);
    
    // Check for any visible elements
    cy.get('body').then(($body) => {
      const visibleElements = [];
      const allElements = $body.find('*');
      
      console.log(`Total elements in body: ${allElements.length}`);
      
      // Log the first 20 visible elements
      allElements.each((index, el) => {
        if (index >= 20) return false; // Only check first 20 elements
        
        const style = window.getComputedStyle(el);
        const isVisible = style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         style.opacity !== '0';
        
        visibleElements.push({
          tag: el.tagName,
          id: el.id || null,
          class: el.className || null,
          isVisible,
          text: el.textContent ? el.textContent.trim().substring(0, 50) + 
                (el.textContent.trim().length > 50 ? '...' : '') : null
        });
      });
      
      console.log('First 20 elements:', visibleElements);
    });
    
    // Log any console messages that were captured
    cy.get('@consoleLog').then(logStub => {
      if (logStub.callCount > 0) {
        console.log('Console logs:', logStub.getCalls().map(call => call.args));
      }
    });
    
    cy.get('@consoleError').then(errorStub => {
      if (errorStub.callCount > 0) {
        console.error('Console errors:', errorStub.getCalls().map(call => call.args));
      }
    });
    
    cy.get('@consoleWarn').then(warnStub => {
      if (warnStub.callCount > 0) {
        console.warn('Console warnings:', warnStub.getCalls().map(call => call.args));
      }
    });
    
    // Take a screenshot
    cy.screenshot('console-output');
  });
});
