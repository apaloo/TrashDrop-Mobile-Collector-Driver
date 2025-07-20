/// <reference types="cypress" />

describe('Filter Debug Test', () => {
  // Mock user data
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    phone: '+1234567890',
    user_metadata: {
      name: 'Test User',
      role: 'driver'
    },
    app_metadata: {
      provider: 'phone'
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Mock session data
  const mockSession = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: mockUser
  };

  beforeEach(() => {
    // Clear all localStorage and sessionStorage before each test
    cy.window().then((win) => {
      win.localStorage.clear();
      win.sessionStorage.clear();
      
      // Set up the mock session in localStorage
      win.localStorage.setItem('sb-test-auth-token', JSON.stringify({
        currentSession: mockSession,
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      }));
      
      win.localStorage.setItem('sb-test-user', JSON.stringify(mockUser));
      
      // Mock the geolocation API
      const mockGeolocation = {
        getCurrentPosition: (success) => {
          success({
            coords: {
              latitude: 37.7749,
              longitude: -122.4194,
              accuracy: 20,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            },
            timestamp: Date.now()
          });
        },
        watchPosition: (success) => {
          success({
            coords: {
              latitude: 37.7749,
              longitude: -122.4194,
              accuracy: 20,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            },
            timestamp: Date.now()
          });
          return 1; // Return a watch ID
        },
        clearWatch: () => {}
      };
      
      // Override the geolocation object
      Object.defineProperty(win.navigator, 'geolocation', {
        value: mockGeolocation,
        configurable: true
      });
    });
  });

  // Helper function to log element details
  const logElementDetails = (selector, description = '') => {
    cy.get('body').then(($body) => {
      const elements = $body.find(selector);
      cy.log(`\n${description} (${selector}): Found ${elements.length} elements`);
      
      if (elements.length > 0) {
        elements.each((index, el) => {
          const computedStyle = window.getComputedStyle(el);
          const isVisible = el.offsetParent !== null && 
                          !(computedStyle.visibility === 'hidden' || 
                            computedStyle.display === 'none' ||
                            computedStyle.opacity === '0');
          
          cy.log(`Element ${index + 1}:`, {
            tag: el.tagName,
            id: el.id,
            class: el.className,
            text: el.textContent.trim(),
            visible: isVisible,
            position: {
              top: el.offsetTop,
              left: el.offsetLeft,
              bottom: el.offsetTop + el.offsetHeight,
              right: el.offsetLeft + el.offsetWidth
            },
            dimensions: {
              width: el.offsetWidth,
              height: el.offsetHeight
            },
            styles: {
              display: computedStyle.display,
              position: computedStyle.position,
              visibility: computedStyle.visibility,
              opacity: computedStyle.opacity,
              zIndex: computedStyle.zIndex,
              overflow: computedStyle.overflow
            }
          });
        });
      }
    });
  };

  it('should load the map page and find filter elements', () => {
    // Enable verbose logging
    Cypress.config('defaultCommandTimeout', 30000);
    Cypress.config('pageLoadTimeout', 60000);
    
    // Log the current viewport size
    cy.log('Viewport size:', Cypress.config('viewportWidth'), 'x', Cypress.config('viewportHeight'));
    // First, let's check if we can access the app
    cy.visit('/', { timeout: 30000 });
    
    // Log the current URL and title
    cy.url().then(url => cy.log('Initial URL:', url));
    cy.title().then(title => cy.log('Page title:', title));
    
    // Take a screenshot of the initial page
    cy.screenshot('initial-page');
    
    // Log localStorage and sessionStorage
    cy.window().then((win) => {
      cy.log('localStorage:', JSON.stringify(win.localStorage, null, 2));
      cy.log('sessionStorage:', JSON.stringify(win.sessionStorage, null, 2));
      
      // Check if we're redirected to login
      if (win.location.pathname === '/login') {
        cy.log('Redirected to login page');
        
        // Try to log in programmatically
        return cy.window().then((win) => {
          // Set up the mock session in localStorage
          win.localStorage.setItem('sb-test-auth-token', JSON.stringify({
            currentSession: mockSession,
            expiresAt: Math.floor(Date.now() / 1000) + 3600
          }));
          win.localStorage.setItem('sb-test-user', JSON.stringify(mockUser));
          
          // Reload the page to apply the auth state
          win.location.reload();
        });
      }
    });
    
    // Now try to visit the map page with authentication
    cy.visit('/map', {
      timeout: 30000,
      onBeforeLoad(win) {
        // Set up the mock session in localStorage
        win.localStorage.setItem('sb-test-auth-token', JSON.stringify({
          currentSession: mockSession,
          expiresAt: Math.floor(Date.now() / 1000) + 3600
        }));
        win.localStorage.setItem('sb-test-user', JSON.stringify(mockUser));
        
        // Enable console logging for debugging
        cy.spy(win.console, 'log').as('consoleLog');
        cy.spy(win.console, 'error').as('consoleError');
        cy.spy(win.console, 'warn').as('consoleWarn');
      },
      onLoad(win) {
        // Log that the page has loaded
        console.log('Map page loaded:', win.location.href);
      }
    });
    
    // Check if we're on the map page
    cy.url().should('include', '/map');
    
    // Log the current page structure
    cy.document().then((doc) => {
      cy.log('Document title:', doc.title);
      cy.log('Document body classes:', doc.body.className);
      cy.log('Document head:', doc.head.innerHTML);
      
      // Log all script and link tags
      const scripts = Array.from(doc.querySelectorAll('script'));
      const links = Array.from(doc.querySelectorAll('link'));
      
      cy.log('Script tags:', scripts.map(s => ({
        src: s.src || 'inline',
        async: s.async,
        defer: s.defer,
        type: s.type
      })));
      
      cy.log('Link tags:', links.map(l => ({
        rel: l.rel,
        href: l.href,
        as: l.as
      })));
      
      // Log all top-level divs
      const topLevelDivs = Array.from(doc.body.querySelectorAll('body > div'));
      cy.log(`Found ${topLevelDivs.length} top-level divs`);
      topLevelDivs.forEach((div, index) => {
        cy.log(`Div ${index + 1}:`, {
          id: div.id,
          class: div.className,
          children: div.children.length,
          innerHTML: div.innerHTML.substring(0, 200) + (div.innerHTML.length > 200 ? '...' : '')
        });
      });
      
      // Take a screenshot of the current state
      cy.screenshot('page-structure');
    });
    
    // Wait for the map container to be visible with a longer timeout
    cy.get('body', { timeout: 10000 }).should('be.visible');
    
    // Check for common elements that should be present
    cy.get('body').then(($body) => {
      // Log all elements with data-testid attributes
      const testIds = Array.from($body.find('[data-testid]'));
      if (testIds.length > 0) {
        cy.log('Elements with data-testid:', testIds.map(el => ({
          testid: el.getAttribute('data-testid'),
          tag: el.tagName,
          class: el.className,
          text: el.textContent.trim()
        })));
      } else {
        cy.log('No elements with data-testid found');
      }
      
      // Log all React root elements
      const reactRoots = Array.from($body.find('*')).filter(el => 
        Object.keys(el).some(key => key.startsWith('__reactContainer'))
      );
      cy.log(`Found ${reactRoots.length} React root elements`);
      
      // Take a screenshot of the current state
      cy.screenshot('page-elements');
    });
    
    // Log the entire document structure for debugging
    cy.document().then((doc) => {
      cy.log('Document title:', doc.title);
      cy.log('Document body classes:', doc.body.className);
      
      // Log all top-level elements in the body
      const topLevelElements = Array.from(doc.body.children);
      cy.log(`Found ${topLevelElements.length} top-level elements in body`);
      
      topLevelElements.forEach((el, index) => {
        cy.log(`Element ${index + 1}:`, {
          tag: el.tagName,
          id: el.id,
          class: el.className,
          children: el.children.length,
          innerHTML: el.innerHTML.substring(0, 100) + (el.innerHTML.length > 100 ? '...' : '')
        });
      });
    });
    
    // Log details about the viewport
    cy.window().then((win) => {
      cy.log('Viewport size:', win.innerWidth, 'x', win.innerHeight);
      cy.log('Device pixel ratio:', win.devicePixelRatio);
    });

    // Check for common UI elements
    logElementDetails('header, nav, .header, .navbar', 'Header elements');
    logElementDetails('main, .main, .app-content', 'Main content areas');
    logElementDetails('footer, .footer', 'Footer elements');
    
    // Look for the map container
    logElementDetails('.leaflet-container, [class*="map"], [id*="map"]', 'Map containers');
    
    // Look for filter elements with various selectors
    const filterSelectors = [
      '.absolute.bottom-24',
      '.fixed.bottom-24',
      '.filter-container',
      '.filter-panel',
      '.filter-card',
      '.map-controls',
      '.map-filters',
      '.leaflet-control-container',
      '.leaflet-bottom',
      '.leaflet-control',
      '[class*="filter"]',
      'button:contains("Filter")',
      'button:contains("Filters")'
    ];
    
    // Log details for each filter selector
    filterSelectors.forEach(selector => {
      logElementDetails(selector, `Filter elements (${selector})`);
    });
    
    // Log all buttons on the page
    logElementDetails('button, [role="button"]', 'All buttons');
    
    // Log all inputs on the page
    logElementDetails('input, select, textarea', 'Form elements');
    
    // Take a screenshot of the current state
    cy.screenshot('debug-elements');
    
    // Now look for the filter elements in more detail
    cy.get('body').then(($body) => {
      // Look for loading indicators
      const loadingIndicators = $body.find('[role="progressbar"], .loading, .spinner, .loader');
      if (loadingIndicators.length > 0) {
        cy.log('Found loading indicators, waiting for them to disappear...');
        cy.get('[role="progressbar"], .loading, .spinner, .loader', { timeout: 30000 }).should('not.exist');
      }
      
      // Check for error messages or auth prompts
      const errorMessages = $body.find('.error, .auth-prompt, [role="alert"], .MuiAlert-root');
      if (errorMessages.length > 0) {
        cy.log('Found error messages or auth prompts:', errorMessages.map(el => ({
          text: el.textContent.trim(),
          class: el.className,
          html: el.outerHTML
        })));
      }
      
      // Log the entire DOM structure for debugging
      cy.log('Full DOM structure:', {
        html: $body[0].innerHTML.substring(0, 1000) + '...',
        children: Array.from($body.children()).map(el => ({
          tag: el.tagName,
          id: el.id,
          class: el.className,
          children: el.children.length
        }))
      });
      
      // Look for the map container with a more flexible selector
      const mapContainers = $body.find('.leaflet-container, [class*="map"], [id*="map"], [class*="leaflet"]');
      cy.log(`Found ${mapContainers.length} potential map containers`);
      
      // Log details about map containers
      if (mapContainers.length > 0) {
        mapContainers.each((index, container) => {
          cy.log(`Map container ${index + 1}:`, {
            tag: container.tagName,
            id: container.id,
            class: container.className,
            visible: container.offsetParent !== null,
            dimensions: {
              width: container.offsetWidth,
              height: container.offsetHeight
            },
            position: {
              top: container.offsetTop,
              left: container.offsetLeft
            }
          });
        });
      }
      
      // Look for the filter card with various possible selectors
      const filterSelectors = [
        '.absolute.bottom-24',
        '.fixed.bottom-24',
        '.filter-container',
        '.filter-panel',
        '.filter-card',
        '.map-controls',
        '.map-filters',
        '[class*="filter"]',
        'button:contains("Filter")',
        'button:contains("Filters")'
      ];
      
      let filterCardFound = false;
      filterSelectors.forEach(selector => {
        const elements = $body.find(selector);
        if (elements.length > 0 && !filterCardFound) {
          filterCardFound = true;
          cy.log(`Found potential filter card with selector '${selector}':`, elements[0].outerHTML);
          
          // Look for filter controls within this element
          const rangeInputs = elements.find('input[type="range"]');
          const buttons = elements.find('button');
          
          cy.log(`Found ${rangeInputs.length} range inputs and ${buttons.length} buttons in this element`);
          
          // Log button details
          buttons.each((i, btn) => {
            cy.log(`Button ${i + 1}:`, {
              text: btn.textContent.trim(),
              class: btn.className,
              disabled: btn.disabled,
              html: btn.outerHTML
            });
          });
        }
      });
      
      if (!filterCardFound) {
        cy.log('No filter card found with standard selectors. Document structure:', $body[0].outerHTML);
      }
      
      // Take a final screenshot
      cy.screenshot('final-state');
      
      // Log the computed styles of the body to check for any overflow or visibility issues
      cy.window().then((win) => {
        const bodyStyle = win.getComputedStyle($body[0]);
        cy.log('Body styles:', {
          overflow: bodyStyle.overflow,
          position: bodyStyle.position,
          visibility: bodyStyle.visibility,
          display: bodyStyle.display,
          height: bodyStyle.height,
          width: bodyStyle.width
        });
      });
    });
    
    // Check for any console errors or warnings
    cy.get('@consoleError').then((errorSpy) => {
      if (errorSpy.callCount > 0) {
        cy.log('Console errors:', errorSpy.getCalls().map(call => call.args));
      }
    });
    
    cy.get('@consoleWarn').then((warnSpy) => {
      if (warnSpy.callCount > 0) {
        cy.log('Console warnings:', warnSpy.getCalls().map(call => call.args));
      }
    });
  });
});
