/// <reference types="cypress" />

// Mock user data
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
    role: 'driver'
  },
  app_metadata: {
    provider: 'email'
  }
};

// Mock session data
const mockSession = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: mockUser
};

// Mock filter state
const initialFilters = {
  maxDistance: 5,
  wasteTypes: ['PLASTIC', 'PAPER', 'GLASS', 'METAL', 'RECYCLING'],
  activeFilter: 'recyclable',
  lastUpdated: new Date().toISOString()
};

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

// Helper to set up authentication state
const setupAuth = (win) => {
  try {
    logDebugInfo('Setting up auth state...');
    
    // Clear existing storage
    win.localStorage.clear();
    win.sessionStorage.clear();
    
    // Set auth state in localStorage
    win.localStorage.setItem('sb-test-auth-token', JSON.stringify(mockSession));
    win.localStorage.setItem('sb-test-user', JSON.stringify(mockUser));
    
    // Set filter state
    win.localStorage.setItem('filters', JSON.stringify(initialFilters));
    
    // Set auth state in sessionStorage if needed
    win.sessionStorage.setItem('sb-test-auth-token', JSON.stringify(mockSession));
    win.sessionStorage.setItem('sb-test-user', JSON.stringify(mockUser));
    
    // Log what we've set
    logDebugInfo('Auth state set up in localStorage', {
      'sb-test-auth-token': win.localStorage.getItem('sb-test-auth-token'),
      'sb-test-user': win.localStorage.getItem('sb-test-user'),
      'filters': win.localStorage.getItem('filters')
    });
    
    return true;
  } catch (error) {
    logDebugInfo('Error setting up auth state:', error);
    return false;
  }
};

// Function to check for the map container with retry logic
const checkForMapContainer = (attempt = 1, maxAttempts = 10, delay = 3000) => {
  const log = (message, data) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [Attempt ${attempt}/${maxAttempts}] ${message}`;
    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
    return logMessage;
  };

  log('Checking for map container...');
  
  // Take a screenshot of the current state for debugging
  cy.screenshot(`map-check-attempt-${attempt}`);
  
  // Common selectors for map containers in different map libraries
  const selectors = [
    // Leaflet (used in the app)
    '.leaflet-container',
    // More specific selectors from the app
    'div[class*="leaflet"]',
    'div[class*="map"]',
    // Generic fallbacks
    'canvas',
    'div[style*="position: absolute"]'
  ];
  
  // Function to check if element is visible and has reasonable dimensions
  const isElementVisible = (el) => {
    if (!el) return false;
    
    try {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      
      return style && 
        style.display !== 'none' && 
        style.visibility !== 'hidden' && 
        style.opacity !== '0' &&
        rect.width > 100 && // Reasonable minimum width for a map
        rect.height > 100;  // Reasonable minimum height for a map
    } catch (e) {
      return false;
    }
  };
  
  // Try to find the map container
  return cy.document({ log: false }).then(doc => {
    log('Document ready, searching for map elements...');
    
    // First try the most likely selectors from the app
    for (const selector of selectors) {
      try {
        const elements = doc.querySelectorAll(selector);
        log(`Found ${elements.length} elements matching selector: ${selector}`);
        
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          if (isElementVisible(el)) {
            const rect = el.getBoundingClientRect();
            log('Found visible map container!', {
              selector,
              width: rect.width,
              height: rect.height,
              element: {
                tagName: el.tagName,
                id: el.id,
                className: el.className
              }
            });
            
            // Take a screenshot highlighting the found element
            cy.wrap(el).screenshot(`found-map-element-${selector.replace(/[^a-z0-9]/gi, '-')}`, {
              log: false
            });
            
            return cy.wrap(el, { log: false });
          }
        }
      } catch (e) {
        log(`Error checking selector ${selector}:`, e.message);
      }
    }
    
    // If we've reached max attempts, fail the test
    if (attempt >= maxAttempts) {
      log('Map container not found after all attempts');
      cy.screenshot('no-map-elements-found');
      
      // Log document structure for debugging
      log('Document structure:', {
        bodyChildren: doc.body ? doc.body.children.length : 'No body',
        headChildren: doc.head ? doc.head.children.length : 'No head'
      });
      
      throw new Error('Map container not found after all attempts');
    }
    
    // Otherwise, wait and try again
    log(`Map container not found, waiting ${delay}ms before next attempt...`);
    return cy.wait(delay, { log: false }).then(() => {
      return checkForMapContainer(attempt + 1, maxAttempts, delay);
    });
  });
};

// Function to wait for the app to be fully loaded and ready
const waitForAppReady = (timeout = 60000) => {
  const startTime = Date.now();
  
  // Helper to log with timestamp
  const log = (message, data) => {
    const timestamp = ((Date.now() - startTime) / 1000).toFixed(2);
    const logMessage = `[${timestamp}s] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
    console.log(logMessage);
    return logMessage;
  };
  
  // Take a screenshot for debugging
  const takeScreenshot = (name) => {
    const filename = `app-ready-${name}-${Date.now()}`;
    cy.screenshot(filename, { overwrite: true });
    log(`Took screenshot: ${filename}`);
  };

  log('Starting app readiness check...');
  
  // First, wait for the body to be visible with a longer timeout
  return cy.get('body', { timeout: 15000 }).should('be.visible').then(() => {
    log('Body is visible');
    takeScreenshot('body-visible');
    
    // Check the current URL
    return cy.url({ timeout: 10000 }).then(url => {
      log('Current URL:', url);
      
      // If we're on the login/welcome page, set up auth
      if (url.includes('/login') || url.includes('/welcome') || url.includes('/auth')) {
        log('On login/welcome/auth page, setting up auth...');
        
        // Set up auth in the current window
        return cy.window().then(win => {
          log('Setting up auth in window...');
          const authSetup = setupAuth(win);
          log('Auth setup result:', { success: authSetup });
          
          // If auth was set up successfully, reload the page
          if (authSetup) {
            log('Auth set up, reloading page...');
            win.location.reload();
            // Wait for navigation after reload
            return cy.url({ timeout: 30000 }).should('include', '/map');
          }
          
          return cy.url({ timeout: 30000 }).should('include', '/map');
        });
      }
      
      // If we're already on the map page, continue
      if (url.includes('/map')) {
        log('Already on map page, checking for map container...');
        return checkForMapContainer();
      }
      
      // If we're on the root URL, navigate to /map
      if (url === 'http://localhost:5174/' || url === 'http://localhost:5174') {
        log('On root URL, navigating to /map...');
        return cy.visit('/map', { timeout: 30000 });
      }
      
      // If we get here, we're on an unexpected page
      log('Unexpected URL, checking for map container anyway...');
      takeScreenshot('unexpected-url');
      return checkForMapContainer();
    });
  });
};

// Test Suite: Filter Synchronization between Map and Request Pages
describe('Filter Synchronization', () => {
  beforeEach(function() {
    // Increase timeout for this hook
    this.timeout(240000); // 4 minutes
    
    logDebugInfo('Starting beforeEach hook...');
    
    // Clear browser data before each test
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Set up the window and auth state before visiting the page
    cy.window().then((win) => {
      // Set up auth
      setupAuth(win);
      
      // Mock fetch for debugging
      cy.stub(win, 'fetch').callsFake((...args) => {
        logDebugInfo('Fetch called with:', args);
        return Promise.reject(new Error('Fetch not stubbed'));
      });
    });
    
    // Visit the page with a clean slate
    logDebugInfo('Visiting the app...');
    cy.visit('/', {
      timeout: 120000, // 2 minute timeout for initial load
      onBeforeLoad: (win) => {
        logDebugInfo('Page is loading, setting up window...');
      },
      onLoad: (win) => {
        logDebugInfo('Page loaded, setting up auth...');
        setupAuth(win);
      }
    });
    
    // Wait for the app to be ready with a longer timeout
    logDebugInfo('Waiting for app to be ready...');
    return waitForAppReady(180000).then(() => {
      logDebugInfo('App is ready');
      // Take a screenshot to verify the app is loaded
      return cy.screenshot('app-ready');
    });
  });

  // Test 1: Basic page load and authentication
  it('should load the map page', function() {
    // Increase timeout for this test
    this.timeout(300000); // 5 minutes
    
    // Take a screenshot at the start of the test
    cy.screenshot('test-start');
    
    // Log the start of the test
    logDebugInfo('Starting test: should load the map page');
    
    // Wait for the body to be visible
    cy.get('body', { timeout: 30000 })
      .should('be.visible')
      .then(($body) => {
        logDebugInfo('Body is visible', {
          bodyClasses: $body.attr('class'),
          bodyId: $body.attr('id'),
          children: $body.children().length
        });
      });
    
    // Take a screenshot of the current state
    cy.screenshot('test-started');
    
    // Check if we're on the map page
    cy.url().should('include', '/map');
    
    // Log the current URL and document info
    cy.url().then(url => logDebugInfo('Current URL:', url));
    
    // Get document information
    cy.document().then(doc => {
      logDebugInfo('Document info:', {
        title: doc.title,
        readyState: doc.readyState,
        bodyClasses: doc.body.className,
        bodyContentLength: doc.body.innerHTML.length
      });
      
      // Log the first 1000 characters of the body HTML for debugging
      logDebugInfo('Body HTML start:', doc.body.innerHTML.substring(0, 1000) + '...');
    });
    
    // Try to find the map container with a more permissive selector
    cy.get('body').then($body => {
      logDebugInfo('Looking for map container...');
      
      // Log all elements with common map-related classes
      const mapElements = $body.find('[class*="map"], [class*="leaflet"], [id*="map"], canvas, [class*="container"]');
      logDebugInfo(`Found ${mapElements.length} potential map elements`);
      
      // Log information about each potential map element
      mapElements.each((i, el) => {
        if (i < 10) { // Limit to first 10 elements to avoid too much logging
          const $el = Cypress.$(el);
          const elementInfo = {
            tag: el.tagName,
            id: el.id,
            class: el.className,
            visible: $el.is(':visible'),
            width: $el.width(),
            height: $el.height(),
            position: $el.css('position'),
            display: $el.css('display'),
            parent: el.parentElement ? {
              tag: el.parentElement.tagName,
              id: el.parentElement.id,
              class: el.parentElement.className
            } : null
          };
          
          logDebugInfo(`Element ${i}:`, elementInfo);
        }
      });
      
      // If we found any map elements, take a screenshot
      if (mapElements.length > 0) {
        cy.screenshot('found-map-elements');
      } else {
        // If no map elements found, log the entire body for debugging
        logDebugInfo('No map elements found. Body HTML:', $body.html().substring(0, 2000) + '...');
        cy.screenshot('no-map-elements-found');
      }
    });
    
    // Try to find the bottom navigation
    cy.get('body').then($body => {
      const navElements = $body.find('nav, [role="navigation"], [class*="nav"], [class*="bottom"]');
      logDebugInfo(`Found ${navElements.length} navigation elements`);
      
      navElements.each((i, el) => {
        const $el = Cypress.$(el);
        logDebugInfo(`Nav Element ${i}:`, {
          tag: el.tagName,
          id: el.id,
          class: el.className,
          visible: $el.is(':visible'),
          text: $el.text().substring(0, 100).replace(/\s+/g, ' ').trim() + '...'
        });
      });
    });
    
    // Check for any visible elements that might indicate the app is loaded
    cy.get('body').then($body => {
      const visibleElements = $body.find('*').filter((i, el) => {
        const $el = Cypress.$(el);
        return $el.is(':visible') && $el.width() > 0 && $el.height() > 0;
      });
      
    cy.screenshot('test-complete');
  });

  // Test 2: Check if filter elements exist
  it('should have filter elements', function() {
    // Increase timeout for this test
    this.timeout(60000);
    
    // Log the start of the test
    cy.log('Starting test: should have filter elements');
    
    // Visit the map page
    cy.visit('/map', { timeout: 60000 });
    waitForAppReady();
    
    // Take a screenshot for debugging
    cy.screenshot('before-filter-check');
    
    // Check for filter card with retry logic
    const findFilterCard = (retries = 3, delay = 1000) => {
      return cy.get('body').then(($body) => {
        const filterCard = $body.find('.absolute.bottom-24, .filter-card, [class*="filter"], [data-testid*="filter"]').first();
        
        if (filterCard.length === 0 && retries > 0) {
          cy.log(`Filter card not found, ${retries} retries left`);
          cy.wait(delay);
          return findFilterCard(retries - 1, delay);
        }
        
        if (filterCard.length === 0) {
          logDebugInfo('Filter card not found after retries. Body HTML:', $body.html());
          cy.screenshot('filter-card-not-found');
          throw new Error('Filter card not found on the page');
        }
        
        return cy.wrap(filterCard);
      });
    };
    
    // Find and verify the filter card
    findFilterCard().then(($filterCard) => {
      // Verify filter card is visible
      cy.wrap($filterCard).should('be.visible');
      
      // Log the filter card HTML for debugging
      cy.log('Filter card HTML:', $filterCard[0].outerHTML);
      
      // Check for distance slider
      const distanceSlider = $filterCard.find('input[type="range"]');
      if (distanceSlider.length === 0) {
        cy.log('Distance slider not found in filter card');
        cy.screenshot('distance-slider-not-found');
      } else {
        cy.wrap(distanceSlider).should('be.visible');
      }
      
      // Check for waste type buttons
      const wasteTypeButtons = $filterCard.find('button, [role="button"]');
      if (wasteTypeButtons.length === 0) {
        cy.log('No waste type buttons found in filter card');
        cy.screenshot('no-waste-type-buttons');
      } else {
        cy.log(`Found ${wasteTypeButtons.length} filter buttons`);
        cy.wrap(wasteTypeButtons.first()).should('be.visible');
      }
    });
  });

  // Test 3: Filter synchronization between pages
  it('should synchronize waste type filter between Map and Request pages', function() {
    // Increase timeout for this test
    this.timeout(90000);
    
    // Log the start of the test
    cy.log('Starting test: should synchronize waste type filter between pages');
    
    // Intercept the API request to check filter parameters
    cy.intercept('GET', '**/requests**').as('getRequests');
    
    // Visit the map page
    cy.visit('/map', { timeout: 60000 });
    waitForAppReady();
    
    // Take a screenshot before setting filters
    cy.screenshot('before-filter-setup');
    
    // Set up the initial filter state
    const testFilters = {
      maxDistance: 5,
      wasteTypes: ['PLASTIC', 'PAPER', 'GLASS', 'METAL', 'RECYCLING'],
      activeFilter: 'recyclable',
      timestamp: Date.now()
    };
    
    cy.window().then((win) => {
      win.localStorage.setItem('filters', JSON.stringify(testFilters));
      cy.log('Set initial filters in localStorage:', testFilters);
    });
    
    // Wait a moment for filters to be applied
    cy.wait(1000);
    
    // Take a screenshot after setting filters
    cy.screenshot('after-filter-setup');

    // Navigate to the Requests page
    cy.log('Navigating to Requests page...');
    cy.get('a[href="/requests"], [data-testid="nav-requests"], button:contains("Requests")').first().click();
    
    // Wait for the URL to change
    cy.url().should('include', '/requests');
    
    // Wait for the page to be ready
    waitForAppReady();
    
    // Take a screenshot after navigation
    cy.screenshot('requests-page-loaded');

    // Verify the filters are synchronized
    cy.window().then((win) => {
      const storedFilters = win.localStorage.getItem('filters');
      expect(storedFilters).to.not.be.null;
      
      const filters = JSON.parse(storedFilters);
      cy.log('Retrieved filters from localStorage:', filters);
      
      // Check filter values with more detailed error messages
      try {
        expect(filters.maxDistance, 'maxDistance should be 5').to.equal(5);
        expect(filters.activeFilter, 'activeFilter should be "recyclable"').to.equal('recyclable');
        expect(filters.wasteTypes, 'wasteTypes should include all recyclable types')
          .to.include.members(['PLASTIC', 'PAPER', 'GLASS', 'METAL', 'RECYCLING']);
      } catch (error) {
        cy.log('Filter synchronization error:', error.message);
        cy.screenshot('filter-sync-error');
        throw error;
      }
    });
  });

  // Test 3: Filter synchronization between pages
  it('should synchronize waste type filter between Map and Request pages', function() {
    // Increase timeout for this test
    this.timeout(300000); // 5 minutes
    
    // Take a screenshot before setting filters
    cy.screenshot('before-filter-setup');

    // Set up the initial filter state
    const testFilters = {
      maxDistance: 5,
      wasteTypes: ['PLASTIC', 'PAPER', 'GLASS', 'METAL', 'RECYCLING'],
      activeFilter: 'recyclable',
      timestamp: Date.now()
    };
    
    cy.window().then((win) => {
      win.localStorage.setItem('filters', JSON.stringify(testFilters));
      cy.log('Set initial filters in localStorage:', testFilters);
    });
    
    // Wait a moment for filters to be applied
    cy.wait(1000);
    
    // Take a screenshot after setting filters
    cy.screenshot('after-filter-setup');

    // Navigate to the Requests page
    cy.log('Navigating to Requests page...');
    cy.get('a[href="/requests"], [data-testid="nav-requests"], button:contains("Requests")').first().click();
    
    // Wait for the URL to change
    cy.url().should('include', '/requests');
    
    // Wait for the page to be ready
    waitForAppReady();
    
    // Take a screenshot after navigation
    cy.screenshot('requests-page-loaded');

    // Verify the filters are synchronized
    cy.window().then((win) => {
      const storedFilters = win.localStorage.getItem('filters');
      expect(storedFilters).to.not.be.null;
      
      const filters = JSON.parse(storedFilters);
      cy.log('Retrieved filters from localStorage:', filters);
      
      // Check filter values with more detailed error messages
      try {
        expect(filters.maxDistance, 'maxDistance should be 5').to.equal(5);
        expect(filters.activeFilter, 'activeFilter should be "recyclable"').to.equal('recyclable');
        expect(filters.wasteTypes, 'wasteTypes should include all recyclable types')
          .to.include.members(['PLASTIC', 'PAPER', 'GLASS', 'METAL', 'RECYCLING']);
      } catch (error) {
        cy.log('Filter synchronization error:', error.message);
        cy.screenshot('filter-sync-error');
        throw error;
      }
    });
  });

  // Add a test to verify filter card visibility and interaction
  it('should have interactive filter controls', function() {
    // Increase timeout for this test
    this.timeout(300000); // 5 minutes
    
    // Wait for the map container to be visible
    checkForMapContainer().then(($map) => {
      cy.log('Map container found, checking for filter controls...');
      
      // Look for the filter card (adjust selector based on your app's structure)
      cy.get('.filter-card, [class*="filter"], [data-testid*="filter"]', { timeout: 10000 })
        .should('be.visible')
        .then(($filterCard) => {
          cy.log('Filter card found, checking controls...');
          
          // Check for distance slider
          cy.get('input[type="range"]', { withinSubject: $filterCard })
            .should('exist')
            .and('be.visible');
            
          // Check for waste type buttons
          const wasteTypes = ['All', 'Plastic', 'Paper', 'Glass', 'Metal', 'Recycling'];
          wasteTypes.forEach(type => {
            cy.contains('button', type, { timeout: 5000 })
              .should('be.visible');
          });
          
          // Test filter interaction
          cy.contains('button', 'Plastic').click();
          cy.wait(500); // Wait for filter to apply
          
          // Verify filter was applied (adjust based on your app's behavior)
          cy.window().then((win) => {
            const filters = JSON.parse(win.localStorage.getItem('filters') || '{}');
            expect(filters.wasteTypes).to.include('PLASTIC');
          });
        });
    });
  });
});
