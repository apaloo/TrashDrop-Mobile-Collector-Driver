import React from 'react';
import { mount } from '@cypress/react';

// A simple test component
const TestComponent = () => {
  return (
    <div data-testid="test-component">
      <h1>React Test Component</h1>
      <p>If you can see this, React is working in the test environment!</p>
      <button 
        data-testid="test-button" 
        onClick={() => {
          const element = document.createElement('div');
          element.textContent = 'Button clicked!';
          element.id = 'click-message';
          document.body.appendChild(element);
        }}
      >
        Click Me
      </button>
    </div>
  );
};

describe('React Component Test', () => {
  it('should render the test component', () => {
    // Mount the test component
    mount(<TestComponent />);
    
    // Check if the component rendered
    cy.get('[data-testid="test-component"]').should('exist');
    
    // Check the content
    cy.contains('h1', 'React Test Component').should('be.visible');
    cy.contains('p', 'If you can see this, React is working in the test environment!').should('be.visible');
    
    // Test interactivity
    cy.get('[data-testid="test-button"]').click();
    cy.get('#click-message').should('contain', 'Button clicked!');
  });
});
