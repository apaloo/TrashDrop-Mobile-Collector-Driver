/// <reference types="cypress" />

describe('HTML Structure Check', () => {
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

  it('should have basic HTML structure', () => {
    // Check for required HTML elements
    cy.get('html').should('exist');
    cy.get('head').should('exist');
    cy.get('body').should('exist');
    
    // Check for the root element
    cy.get('#root').should('exist');
    
    // Log the document title
    cy.title().then(title => {
      console.log('Page title:', title);
      expect(title).to.be.a('string');
    });
    
    // Log the current URL
    cy.url().then(url => {
      console.log('Current URL:', url);
    });
    
    // Check for any scripts
    cy.get('script').then($scripts => {
      console.log(`Found ${$scripts.length} script tags`);
      
      // Log the first 5 script sources
      $scripts.slice(0, 5).each((i, script) => {
        console.log(`Script ${i + 1}:`, {
          src: script.src || 'inline',
          type: script.type || 'text/javascript',
          async: script.async,
          defer: script.defer
        });
      });
    });
    
    // Check for any stylesheets
    cy.get('link[rel="stylesheet"], style').then($styles => {
      console.log(`Found ${$styles.length} stylesheets`);
      
      // Log the first 5 stylesheets
      $styles.slice(0, 5).each((i, style) => {
        if (style.tagName.toLowerCase() === 'link') {
          console.log(`Stylesheet ${i + 1}:`, {
            href: style.href,
            type: style.type || 'text/css',
            disabled: style.disabled
          });
        } else {
          console.log(`Inline style ${i + 1}:`, {
            type: style.type || 'text/css',
            length: style.textContent ? style.textContent.length : 0
          });
        }
      });
    });
    
    // Log the body content for debugging
    cy.get('body').then($body => {
      console.log('Body content (first 1000 chars):', 
        $body.html().substring(0, 1000) + 
        ($body.html().length > 1000 ? '...' : '')
      );
      
      // Check for any error messages
      const errorElements = $body.find('[class*="error"], [id*="error"], [role="alert"]');
      if (errorElements.length > 0) {
        console.warn(`Found ${errorElements.length} error elements`);
        errorElements.each((i, el) => {
          console.warn(`Error element ${i + 1}:`, el.outerHTML);
        });
      }
      
      // Check for any iframes
      const iframes = $body.find('iframe');
      if (iframes.length > 0) {
        console.log(`Found ${iframes.length} iframes`);
        iframes.each((i, iframe) => {
          console.log(`Iframe ${i + 1}:`, {
            src: iframe.src,
            id: iframe.id,
            class: iframe.className,
            width: iframe.width,
            height: iframe.height
          });
        });
      }
      
      // Check for any visible content
      const visibleElements = $body.find('*').filter((i, el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               el.offsetWidth > 0 && 
               el.offsetHeight > 0;
      });
      
      console.log(`Found ${visibleElements.length} visible elements`);
      
      // Log the first 5 visible elements
      visibleElements.slice(0, 5).each((i, el) => {
        console.log(`Visible element ${i + 1}:`, {
          tag: el.tagName,
          id: el.id || null,
          class: el.className || null,
          text: el.textContent ? el.textContent.trim().substring(0, 100) + 
                (el.textContent.trim().length > 100 ? '...' : '') : null
        });
      });
    });
    
    // Take a screenshot of the current state
    cy.screenshot('html-structure');
  });
  
  it('should have required meta tags', () => {
    // Check for common meta tags
    const metaTags = [
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { charset: 'UTF-8' },
      { 'http-equiv': 'X-UA-Compatible', content: 'IE=edge' }
    ];
    
    metaTags.forEach(tag => {
      const selector = Object.entries(tag).map(([key, value]) => {
        if (key === 'charset') return `[${key}="${value}"]`;
        if (key === 'http-equiv') return `[${key}="${value}"]`;
        return `[${key}="${value}"]`;
      }).join('');
      
      cy.get(`meta${selector}`).should('exist');
    });
    
    // Log all meta tags
    cy.get('meta').then($metas => {
      console.log(`Found ${$metas.length} meta tags`);
      
      $metas.slice(0, 10).each((i, meta) => {
        const attributes = {};
        for (let attr of meta.attributes) {
          attributes[attr.name] = attr.value;
        }
        console.log(`Meta ${i + 1}:`, attributes);
      });
    });
  });
  
  it('should check for common JavaScript errors', () => {
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
            console.error('JavaScript errors detected:');
            errors.forEach((error, i) => {
              console.error(`Error ${i + 1}:`, error);
            });
            
            // Check for common errors
            const hasNetworkError = errors.some(args => 
              args.some(arg => 
                typeof arg === 'string' && 
                (arg.includes('NetworkError') || 
                 arg.includes('Failed to load') ||
                 arg.includes('404') ||
                 arg.includes('500'))
              )
            );
            
            const hasSyntaxError = errors.some(args => 
              args.some(arg => 
                typeof arg === 'string' && 
                arg.includes('SyntaxError')
              )
            );
            
            if (hasNetworkError) {
              console.error('Detected network-related errors');
            }
            
            if (hasSyntaxError) {
              console.error('Detected JavaScript syntax errors');
            }
            
            // Fail the test if there are any errors
            expect(errors.length, 'No JavaScript errors should be present').to.equal(0);
          } else {
            console.log('No JavaScript errors detected');
            resolve();
          }
        }, 1000);
      });
    });
  });
});
