/// <reference types="cypress" />

describe('React Application Check', () => {
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
        
        // Add a global function to check for React components
        win.__cypressCheckReact = function() {
          try {
            // Check if React is loaded
            if (!window.React || !window.ReactDOM) {
              return { reactLoaded: false, error: 'React or ReactDOM not found in window object' };
            }
            
            // Try to find the root React component
            const rootElement = document.getElementById('root');
            if (!rootElement) {
              return { reactLoaded: false, error: 'Root element not found' };
            }
            
            // Check if the root element has React content
            const rootInstance = rootElement._reactRootContainer || 
                               rootElement._reactRoot || 
                               (rootElement[Object.keys(rootElement).find(key => key.startsWith('__reactContainer'))]);
            
            if (!rootInstance) {
              return { reactLoaded: false, error: 'No React instance found on root element' };
            }
            
            // Try to get the React component tree
            let componentTree = [];
            try {
              // This is a simplified approach - in a real app, you might need to traverse the fiber tree
              const walkTree = (node, depth = 0) => {
                if (!node || depth > 10) return; // Limit depth to prevent infinite recursion
                
                const component = {
                  type: node.type?.name || String(node.type) || 'Unknown',
                  props: node.pendingProps || node.memoizedProps || {},
                  state: node.memoizedState,
                  key: node.key,
                  ref: node.ref,
                  children: []
                };
                
                let child = node.child;
                while (child) {
                  const childComponent = walkTree(child, depth + 1);
                  if (childComponent) {
                    component.children.push(childComponent);
                  }
                  child = child.sibling;
                }
                
                return component;
              };
              
              const rootFiber = rootInstance._internalRoot?.current;
              if (rootFiber) {
                componentTree = walkTree(rootFiber) || [];
              }
            } catch (e) {
              console.error('Error walking React tree:', e);
            }
            
            return {
              reactLoaded: true,
              rootElement: {
                id: rootElement.id,
                className: rootElement.className,
                children: rootElement.children.length,
                innerHTML: rootElement.innerHTML.substring(0, 500) + (rootElement.innerHTML.length > 500 ? '...' : '')
              },
              componentTree: componentTree,
              reactVersion: window.React?.version,
              reactDOMVersion: window.ReactDOM?.version
            };
          } catch (e) {
            return { reactLoaded: false, error: e.message };
          }
        };
      }
    });
  });
  
  it('should have React properly loaded', () => {
    // Check if React is loaded
    cy.window().should('have.property', 'React');
    cy.window().should('have.property', 'ReactDOM');
    
    // Check for the root element
    cy.get('#root').should('exist');
    
    // Use our custom function to check React state
    cy.window().then((win) => {
      const result = win.__cypressCheckReact();
      console.log('React check result:', JSON.stringify(result, null, 2));
      
      // Assert that React is loaded
      expect(result.reactLoaded, 'React should be loaded').to.be.true;
      
      // Check if there's an error
      if (result.error) {
        console.error('React error:', result.error);
        throw new Error(`React error: ${result.error}`);
      }
      
      // Check if the root element has content
      if (result.rootElement) {
        console.log('Root element content:', result.rootElement.innerHTML);
        expect(result.rootElement.innerHTML.trim().length, 'Root element should have content').to.be.greaterThan(0);
      }
      
      // Log React version information
      console.log(`React version: ${result.reactVersion || 'unknown'}`);
      console.log(`ReactDOM version: ${result.reactDOMVersion || 'unknown'}`);
      
      // Log component tree if available
      if (result.componentTree) {
        console.log('Component tree:', JSON.stringify(result.componentTree, null, 2));
      }
    });
    
    // Check for any React error boundaries
    cy.get('body').then(($body) => {
      const errorBoundaries = $body.find('[class*="error-boundary"], [class*="errorBoundary"]');
      if (errorBoundaries.length > 0) {
        console.error('Found React error boundaries with errors:', errorBoundaries.length);
        errorBoundaries.each((i, el) => {
          console.error(`Error boundary ${i + 1}:`, el.outerHTML);
        });
        throw new Error('React error boundaries with errors detected');
      }
    });
    
    // Check for any React hydration warnings/errors in the console
    cy.window().then((win) => {
      const originalConsoleError = win.console.error;
      const reactErrors = [];
      
      win.console.error = function() {
        const args = Array.from(arguments);
        const errorMessage = args.join(' ');
        
        // Check for React hydration warnings/errors
        if (errorMessage.includes('Hydration') || 
            errorMessage.includes('ReactDOM') || 
            errorMessage.includes('Minified React error')) {
          reactErrors.push(args);
        }
        
        originalConsoleError.apply(win.console, args);
      };
      
      // Wait a moment for any async rendering to complete
      return new Cypress.Promise((resolve) => {
        setTimeout(() => {
          win.console.error = originalConsoleError;
          
          if (reactErrors.length > 0) {
            console.error('React errors detected during test:');
            reactErrors.forEach((error, i) => {
              console.error(`React error ${i + 1}:`, error);
            });
            
            throw new Error(`Detected ${reactErrors.length} React errors (see console for details)`);
          }
          
          resolve();
        }, 1000);
      });
    });
  });
  
  it('should render the application UI', () => {
    // Check for common UI elements that should be present in the app
    cy.get('body').then(($body) => {
      // Look for any visible content
      const visibleElements = $body.find('*').filter((i, el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               el.offsetWidth > 0 && 
               el.offsetHeight > 0;
      });
      
      console.log(`Found ${visibleElements.length} visible elements on the page`);
      
      // Log the first 10 visible elements
      const elementsToLog = Math.min(10, visibleElements.length);
      for (let i = 0; i < elementsToLog; i++) {
        const el = visibleElements[i];
        console.log(`Element ${i + 1}:`, {
          tag: el.tagName,
          id: el.id || null,
          class: el.className || null,
          text: el.textContent ? el.textContent.trim().substring(0, 100) + 
                (el.textContent.trim().length > 100 ? '...' : '') : null
        });
      }
      
      // Check if we have any content at all
      if (visibleElements.length === 0) {
        console.warn('No visible elements found on the page');
        console.warn('Document body:', $body[0].outerHTML);
      } else {
        // Check for common React app containers
        const hasAppContainer = $body.find('[class*="app" i], [id*="app" i]').length > 0;
        const hasRootContent = $body.find('#root').html().trim().length > 0;
        
        console.log('Has app container:', hasAppContainer);
        console.log('Root has content:', hasRootContent);
        
        if (!hasAppContainer && !hasRootContent) {
          console.warn('No app container or root content found');
        }
      }
    });
    
    // Check for any loading indicators
    cy.get('body').then(($body) => {
      const loadingIndicators = $body.find('[class*="loading" i], [class*="spinner" i], [class*="loader" i]');
      if (loadingIndicators.length > 0) {
        console.log(`Found ${loadingIndicators.length} loading indicators`);
        loadingIndicators.each((i, el) => {
          console.log(`Loading indicator ${i + 1}:`, el.outerHTML);
        });
      } else {
        console.log('No loading indicators found');
      }
    });
  });
});
