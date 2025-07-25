// ***********************************************************
// This example support/component.js is processed and
// loaded automatically before your component test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Import global styles
import '../../src/index.css'

// Import the mount command from cypress/react18
import { mount } from 'cypress/react18'

// Add the mount command to Cypress
Cypress.Commands.add('mount', mount)

// Example use:
// cy.mount(<MyComponent />)
