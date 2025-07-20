/// <reference types="cypress" />

describe('Element Presence Check', () => {
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

  it('should check for required elements', () => {
    // Check for the root element
    cy.get('#root').should('exist');
    
    // Log the title
    cy.title().then(title => {
      console.log('Page title:', title);
    });
    
    // Check for common UI elements that should be present in a React app
    const commonSelectors = [
      // Common React root elements
      'div#root',
      'div.App',
      'div.app',
      'div.container',
      'div.layout',
      'main',
      'header',
      'footer',
      'nav',
      // Common UI elements
      'button',
      'input',
      'form',
      'a',
      'img',
      'svg',
      // Common class names
      '[class*="header"]',
      '[class*="content"]',
      '[class*="main"]',
      '[class*="container"]',
      // Common IDs
      '[id*="app"]',
      '[id*="main"]',
      '[id*="content"]'
    ];
    
    // Check each selector and log if found
    commonSelectors.forEach(selector => {
      cy.get('body').then($body => {
        if ($body.find(selector).length > 0) {
          console.log(`Found element with selector: ${selector}`);
          console.log(`  Count: ${$body.find(selector).length}`);
          
          // Log details of the first matching element
          const firstElement = $body.find(selector).first();
          console.log('  First match:', {
            tag: firstElement[0].tagName,
            id: firstElement.attr('id') || null,
            class: firstElement.attr('class') || null,
            text: firstElement.text().trim().substring(0, 100) + 
                 (firstElement.text().trim().length > 100 ? '...' : '')
          });
        } else {
          console.log(`Element not found: ${selector}`);
        }
      });
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
    });
    
    // Check for any images
    cy.get('img').then($imgs => {
      if ($imgs.length > 0) {
        console.log(`Found ${$imgs.length} images`);
        $imgs.each((i, img) => {
          console.log(`Image ${i + 1}:`, {
            src: img.src || null,
            alt: img.alt || null,
            width: img.width,
            height: img.height
          });
        });
      } else {
        console.log('No images found on the page');
      }
    });
    
    // Check for any forms
    cy.get('form').then($forms => {
      if ($forms.length > 0) {
        console.log(`Found ${$forms.length} forms`);
        $forms.each((i, form) => {
          console.log(`Form ${i + 1}:`, {
            id: form.id || null,
            class: form.className || null,
            action: form.action || null,
            method: form.method || 'get',
            inputs: form.querySelectorAll('input, select, textarea, button').length
          });
        });
      } else {
        console.log('No forms found on the page');
      }
    });
    
    // Check for any buttons
    cy.get('button, [role="button"], [type="button"], [type="submit"], [type="reset"]')
      .then($buttons => {
        if ($buttons.length > 0) {
          console.log(`Found ${$buttons.length} buttons`);
          $buttons.slice(0, 5).each((i, button) => {
            console.log(`Button ${i + 1}:`, {
              tag: button.tagName,
              id: button.id || null,
              class: button.className || null,
              type: button.type || 'button',
              text: button.textContent.trim().substring(0, 50) + 
                   (button.textContent.trim().length > 50 ? '...' : '')
            });
          });
          
          if ($buttons.length > 5) {
            console.log(`...and ${$buttons.length - 5} more buttons`);
          }
        } else {
          console.log('No buttons found on the page');
        }
      });
    
    // Check for any input fields
    cy.get('input, textarea, select').then($inputs => {
      if ($inputs.length > 0) {
        console.log(`Found ${$inputs.length} input fields`);
        $inputs.slice(0, 5).each((i, input) => {
          console.log(`Input ${i + 1}:`, {
            tag: input.tagName,
            id: input.id || null,
            class: input.className || null,
            type: input.type || 'text',
            name: input.name || null,
            placeholder: input.placeholder || null,
            value: input.value || null
          });
        });
        
        if ($inputs.length > 5) {
          console.log(`...and ${$inputs.length - 5} more input fields`);
        }
      } else {
        console.log('No input fields found on the page');
      }
    });
    
    // Check for any links
    cy.get('a').then($links => {
      if ($links.length > 0) {
        console.log(`Found ${$links.length} links`);
        $links.slice(0, 5).each((i, link) => {
          console.log(`Link ${i + 1}:`, {
            text: link.textContent.trim().substring(0, 50) + 
                 (link.textContent.trim().length > 50 ? '...' : ''),
            href: link.href || null,
            target: link.target || '_self',
            rel: link.rel || null
          });
        });
        
        if ($links.length > 5) {
          console.log(`...and ${$links.length - 5} more links`);
        }
      } else {
        console.log('No links found on the page');
      }
    });
    
    // Take a screenshot of the current state
    cy.screenshot('element-check');
  });
});
