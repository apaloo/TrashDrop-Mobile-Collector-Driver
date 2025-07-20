/// <reference types="cypress" />

describe('Minimal Page Check', () => {
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

  it('should check for basic page elements', () => {
    // Check for the document and body
    cy.document().should('exist');
    cy.get('body').should('exist');
    
    // Log basic page information
    cy.document().then(doc => {
      console.log('Page title:', doc.title);
      console.log('Document readyState:', doc.readyState);
      console.log('Document charset:', doc.characterSet);
      
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
        
        // Stop after collecting 20 elements to avoid excessive output
        if (elements.length >= 20) {
          elements.push({ message: '... (more elements not shown)' });
          break;
        }
      }
      
      console.log('Elements in document:', elements);
    });
    
    // Check for any visible text content
    cy.get('body').then($body => {
      const textContent = $body.text().trim();
      if (textContent.length > 0) {
        console.log('Page has text content');
        console.log('First 200 chars:', textContent.substring(0, 200) + 
                   (textContent.length > 200 ? '...' : ''));
      } else {
        console.warn('Page has no visible text content');
      }
      
      // Log all elements with their visibility
      console.log('All elements on the page:');
      $body.find('*').each((i, el) => {
        const style = window.getComputedStyle(el);
        const isVisible = style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         style.opacity !== '0';
        
        console.log(`Element ${i + 1}:`, {
          tag: el.tagName,
          id: el.id || null,
          class: el.className || null,
          isVisible,
          text: el.textContent ? el.textContent.trim().substring(0, 50) + 
                (el.textContent.trim().length > 50 ? '...' : '') : null
        });
        
        // Only check the first 10 elements to avoid excessive output
        return i < 10;
      });
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
    
    // Take a screenshot of the current state
    cy.screenshot('minimal-check');
  });
});
