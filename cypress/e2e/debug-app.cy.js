/// <reference types="cypress" />

describe('Debug Application State', () => {
  it('should capture application state', () => {
    // Visit the root URL with no caching
    cy.visit('/', {
      failOnStatusCode: false,
      onBeforeLoad(win) {
        // Disable service workers
        delete win.navigator.__proto__.serviceWorker;
        
        // Log all console messages
        cy.stub(win.console, 'log').as('consoleLog');
        cy.stub(win.console, 'error').as('consoleError');
        cy.stub(win.console, 'warn').as('consoleWarn');
        
        // Log uncaught exceptions
        win.onerror = function(message, source, lineno, colno, error) {
          console.error('UNCAUGHT EXCEPTION:', { message, source, lineno, colno, error });
          return true; // Prevent the error from being thrown
        };
        
        // Log unhandled promise rejections
        win.addEventListener('unhandledrejection', (event) => {
          console.error('UNHANDLED REJECTION:', event.reason);
        });
      }
    });
    
    // Take a screenshot of the current state
    cy.screenshot('initial-state');
    
    // Log the current URL
    cy.url().then(url => {
      console.log('Current URL:', url);
    });
    
    // Log document information
    cy.document().then(doc => {
      console.log('Document title:', doc.title);
      console.log('Document readyState:', doc.readyState);
      
      // Log the entire document structure
      console.log('Document structure:');
      const walker = doc.createTreeWalker(
        doc.documentElement,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
      );
      
      let node;
      const elements = [];
      while (node = walker.nextNode()) {
        elements.push({
          tag: node.tagName,
          id: node.id,
          class: node.className,
          text: node.textContent.trim().substring(0, 100) + (node.textContent.trim().length > 100 ? '...' : '')
        });
      }
      
      console.log('Elements in document:', elements);
      
      // Log any script errors
      const scripts = Array.from(doc.scripts);
      scripts.forEach((script, index) => {
        console.log(`Script ${index}:`, {
          src: script.src || 'inline',
          async: script.async,
          defer: script.defer,
          type: script.type || 'text/javascript'
        });
      });
      
      // Log any stylesheets
      const styles = Array.from(doc.styleSheets);
      styles.forEach((style, index) => {
        console.log(`Style ${index}:`, {
          href: style.href || 'inline',
          disabled: style.disabled,
          rules: style.rules ? style.rules.length : 'N/A'
        });
      });
    });
    
    // Log the window object structure
    cy.window().then(win => {
      console.log('Window properties:', Object.keys(win).filter(k => 
        !k.startsWith('_') && 
        typeof win[k] !== 'function' &&
        k !== 'window' &&
        k !== 'self' &&
        k !== 'document' &&
        k !== 'location' &&
        k !== 'navigator' &&
        k !== 'customElements' &&
        k !== 'localStorage' &&
        k !== 'sessionStorage' &&
        k !== 'indexedDB' &&
        k !== 'caches' &&
        k !== 'applicationCache' &&
        k !== 'console' &&
        k !== 'performance' &&
        k !== 'screen' &&
        k !== 'history' &&
        k !== 'locationbar' &&
        k !== 'menubar' &&
        k !== 'personalbar' &&
        k !== 'scrollbars' &&
        k !== 'statusbar' &&
        k !== 'toolbar' &&
        k !== 'opener' &&
        k !== 'parent' &&
        k !== 'top' &&
        k !== 'frames' &&
        k !== 'length' &&
        k !== 'closed' &&
        k !== 'devicePixelRatio' &&
        k !== 'innerWidth' &&
        k !== 'innerHeight' &&
        k !== 'outerWidth' &&
        k !== 'outerHeight' &&
        k !== 'pageXOffset' &&
        k !== 'pageYOffset' &&
        k !== 'screenX' &&
        k !== 'screenY' &&
        k !== 'scrollX' &&
        k !== 'scrollY'
      ));
      
      // Check for React
      console.log('React available:', !!win.React);
      console.log('ReactDOM available:', !!win.ReactDOM);
      
      // Check for any global variables that might indicate the app is loaded
      console.log('App global variables:', Object.keys(win).filter(k => 
        k.startsWith('app') || 
        k.startsWith('trashdrop') || 
        k.startsWith('td') ||
        k.toLowerCase().includes('app') ||
        k.toLowerCase().includes('trashdrop')
      ));
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
    
    // Check for any error overlays (like React's error overlay)
    cy.get('body').then($body => {
      const errorOverlay = $body.find('div[role="alert"], [class*="error"], [class*="overlay"]');
      if (errorOverlay.length > 0) {
        console.error('Found error overlay:', errorOverlay[0].outerHTML);
      } else {
        console.log('No error overlays found');
      }
      
      // Take a screenshot of the body content
      cy.wrap($body).screenshot('body-content');
    });
    
    // Check for any iframes
    cy.get('iframe').then($iframes => {
      if ($iframes.length > 0) {
        console.log('Found iframes:', $iframes.length);
        $iframes.each((index, iframe) => {
          console.log(`Iframe ${index}:`, {
            src: iframe.src,
            id: iframe.id,
            class: iframe.className,
            width: iframe.width,
            height: iframe.height
          });
        });
      } else {
        console.log('No iframes found');
      }
    });
    
    // Check for any shadow roots
    cy.document().then(doc => {
      const walker = doc.createTreeWalker(
        doc.documentElement,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
      );
      
      const shadowRoots = [];
      let node;
      while (node = walker.nextNode()) {
        if (node.shadowRoot) {
          shadowRoots.push({
            tag: node.tagName,
            id: node.id,
            class: node.className
          });
        }
      }
      
      if (shadowRoots.length > 0) {
        console.log('Shadow roots found:', shadowRoots);
      } else {
        console.log('No shadow roots found');
      }
    });
    
    // Check for any web components
    cy.document().then(doc => {
      const webComponents = Array.from(doc.querySelectorAll('*'))
        .filter(el => el.tagName.includes('-'));
      
      if (webComponents.length > 0) {
        console.log('Web components found:', webComponents.map(c => ({
          tag: c.tagName,
          id: c.id,
          class: c.className
        })));
      } else {
        console.log('No web components found');
      }
    });
  });
});
