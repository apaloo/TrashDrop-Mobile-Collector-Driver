/// <reference types="cypress" />

// Debug helper function
const logDebugInfo = (message, data = '') => {
  console.log(`[DEBUG] ${message}`, data);
  // Also log to Cypress command log
  if (Cypress && Cypress.log) {
    Cypress.log({
      name: 'DEBUG',
      message: `${message} ${JSON.stringify(data || '')}`
    });
  }
};

describe('Map Page', () => {
  beforeEach(() => {
    // Log test start
    logDebugInfo('Starting test setup');
    
    // Clear any existing sessions and local storage
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Log before visiting the root URL
    logDebugInfo('Visiting root URL');
    cy.visit('/', {
      onBeforeLoad: (win) => {
        logDebugInfo('Window before load');
      },
      onLoad: (win) => {
        logDebugInfo('Window loaded');
      }
    });
    
    // Take a screenshot of the initial page
    cy.screenshot('initial-page');
    
    // Log before programmatic login
    logDebugInfo('Performing programmatic login');
    
    // Programmatically log in
    cy.programmaticLogin();
    
    // Log before visiting map page
    logDebugInfo('Visiting map page');
    
    // Visit the map page with debug info
    cy.visit('/map', {
      onBeforeLoad: (win) => {
        logDebugInfo('Map page before load');
        // Log localStorage after login
        logDebugInfo('localStorage after login', win.localStorage);
      },
      onLoad: (win) => {
        logDebugInfo('Map page loaded');
      }
    });
    
    // Take a screenshot after page load
    cy.screenshot('after-map-page-load');
    
    // Log document structure for debugging
    cy.document().then(doc => {
      logDebugInfo('Document info', {
        title: doc.title,
        readyState: doc.readyState,
        bodyClasses: doc.body.className,
        bodyChildren: doc.body.children.length,
        headChildren: doc.head.children.length
      });
      
      // Log all elements with common map-related classes
      const mapElements = doc.querySelectorAll('[class*="map"], [class*="leaflet"], [id*="map"], canvas, [class*="container"]');
      logDebugInfo(`Found ${mapElements.length} potential map elements`);
      
      // Log information about potential map elements
      mapElements.forEach((el, i) => {
        if (i < 5) { // Limit to first 5 elements to avoid too much logging
          logDebugInfo(`Map element ${i}:`, {
            tag: el.tagName,
            id: el.id,
            class: el.className,
            visible: el.offsetParent !== null,
            width: el.offsetWidth,
            height: el.offsetHeight,
            position: window.getComputedStyle(el).position,
            display: window.getComputedStyle(el).display
          });
        }
      });
    });
    
    // Wait for the map to load with a longer timeout and better error handling
    cy.get('body').then($body => {
      logDebugInfo('Body content:', $body.html().substring(0, 1000) + '...');
    });
    
    // Try to find the map container with a more permissive selector
    cy.get('body').should('be.visible');
    
    // Check for common map container selectors
    const mapSelectors = [
      '.leaflet-container',
      '.map-container',
      '.map',
      '[class*="map"]',
      '[class*="leaflet"]',
      'canvas',
      'div[style*="position: absolute"]'
    ];
    
    // Log before checking for map container
    logDebugInfo('Checking for map container...');
    
    // Try to find a visible map container
    let foundMap = false;
    mapSelectors.forEach(selector => {
      if (!foundMap) {
        cy.get('body').then($body => {
          const elements = $body.find(selector);
          logDebugInfo(`Found ${elements.length} elements matching selector: ${selector}`);
          
          elements.each((i, el) => {
            const $el = Cypress.$(el);
            const isVisible = $el.is(':visible') && $el.width() > 100 && $el.height() > 100;
            
            logDebugInfo(`Element ${i} (${selector}):`, {
              tag: el.tagName,
              id: el.id,
              class: el.className,
              visible: isVisible,
              width: $el.width(),
              height: $el.height(),
              position: $el.css('position'),
              display: $el.css('display')
            });
            
            if (isVisible) {
              foundMap = true;
              logDebugInfo('Found visible map container!', { selector, index: i });
              cy.wrap($el).as('mapContainer');
              return false; // Break the each loop
            }
          });
        });
      }
    });
    
    // If we found a map container, wait for it to be fully loaded
    if (foundMap) {
      cy.get('@mapContainer').should('be.visible');
    } else {
      // If no map container found, log the body structure for debugging
      cy.document().then(doc => {
        logDebugInfo('No map container found. Document structure:', {
          bodyChildren: doc.body.children.length,
          headChildren: doc.head.children.length,
          bodyContent: doc.body.innerHTML.substring(0, 2000) + '...'
        });
      });
      
      // Take a screenshot of the current state
      cy.screenshot('no-map-container-found');
      
      // Fail the test with a descriptive error
      throw new Error('Could not find a visible map container on the page');
    }
  });

  it('should load the map page successfully', () => {
    // Verify URL
    cy.url().should('include', '/map');
    
    // Check for map container
    cy.get('.leaflet-container').should('be.visible');
    
    // Check for bottom navigation
    cy.get('nav[class*="bottom"]', { timeout: 5000 }).should('be.visible');
  });

  it('should display filter controls', () => {
    // Check for filter controls
    cy.get('.filter-card, [class*="filter"], [data-testid*="filter"]', { timeout: 5000 })
      .should('be.visible');
    
    // Check for distance slider
    cy.get('input[type="range"]').should('exist');
    
    // Check for waste type buttons
    const wasteTypes = ['All', 'Plastic', 'Paper', 'Glass', 'Metal', 'Recycling'];
    wasteTypes.forEach(type => {
      cy.contains('button', type).should('be.visible');
    });
  });

  it('should navigate to requests page', () => {
    // Click on requests link in navigation
    cy.get('a[href="/request"], [data-testid="nav-request"], button:contains("Request")')
      .first()
      .click();
    
    // Verify navigation to requests page
    cy.url().should('include', '/request');
    
    // Check for requests content
    cy.contains('h1', 'Requests').should('be.visible');
  });
});
