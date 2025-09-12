/**
 * @fileoverview Application entry point for Dream Journal ES Module version.
 * 
 * This module serves as the main entry point for the ES Module version of the
 * Dream Journal application. It imports the main initialization function and
 * sets up the DOMContentLoaded event listener to start the application.
 * 
 * This separation allows for cleaner module organization where main.js handles
 * the initialization logic and this file handles the DOM event binding.
 * 
 * @module AppEntryPoint
 * @version 2.02.05
 * @author Dream Journal Development Team
 * @since 2.02.05
 * @requires ./main.js
 * @example
 * // This module loads automatically when referenced as a module script:
 * // <script type="module" src="src/app.js"></script>
 */

// ================================
// APPLICATION ENTRY POINT
// ================================

// Import the main application initialization function
import { initializeApp } from '../main.js';

// Start the application when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);