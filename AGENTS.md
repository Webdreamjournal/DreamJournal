# AGENTS.md

This file provides guidance when working with code in this repository.

## Project Overview

This is a **modular HTML application** that implements a privacy-focused dream journal. Originally a single-file application, it has been successfully refactored into separate JavaScript modules for better maintainability.

## Architecture

### Current Modular Structure
- **DreamJournal.html**: Main HTML structure and UI templates
- **dream-journal.css**: HSL-based theme system with utility classes for light/dark themes
- **JavaScript Modules**: Separated into logical domains for maintainability

### JavaScript Module Organization
1. **constants.js**: Application constants and configuration values
2. **state.js**: Global application state management
3. **storage.js**: IndexedDB operations and data persistence layer
4. **dom-helpers.js**: DOM manipulation utilities and UI helpers
5. **security.js**: PIN protection and encryption functionality
6. **dream-crud.js**: Dream entry CRUD operations
7. **voice-notes.js**: Voice recording and transcription features
8. **goals.js**: Lucid dreaming goals system
9. **stats.js**: Statistics and calendar views
10. **import-export.js**: Data backup/restore functionality
11. **action-router.js**: Centralized event handling and action routing
12. **main.js**: Application initialization and theme management
13. **dream-journal.js**: Legacy code and remaining utilities

### Core Systems

1. **Data Storage**: Uses IndexedDB for local persistence
   - Dreams, goals, voice notes, and settings stored locally
   - No server communication - fully client-side

2. **Theme System**: HSL-based CSS custom properties
   - Light/dark theme support via CSS variables
   - Utility classes for consistent styling

3. **Event System**: Centralized event delegation via action-router.js
   - All interactions handled through `data-action` attributes
   - Event handlers mapped in `ACTION_MAP` object
   - Unified click/change handlers with context extraction

4. **Voice Recording**: Browser-based audio recording and transcription
   - MediaRecorder API for audio capture
   - SpeechRecognition API for transcription (Chrome/Edge only)
   - Local storage with configurable limits

### Key Components

- **Dream Management**: CRUD operations for dream entries with categories, emotions, and dream signs
- **Goals System**: Track lucid dreaming goals with progress calculation
- **Voice Notes**: Record and transcribe voice memos with automatic dream creation
- **Statistics**: Calendar view and analytics dashboard
- **Data Export/Import**: Encrypted backup/restore functionality
- **PIN Protection**: Optional security layer for sensitive content

### Key Functions by Module

**storage.js**: Database and persistence layer
- `initDB()`: IndexedDB initialization and migration
- `loadItemFromStore()`, `saveItemToStore()`: Generic CRUD operations
- `loadDreams()`, `loadVoiceNotes()`, `loadGoals()`: Data retrieval

**dream-crud.js**: Dream entry management
- `saveDream()`: Create/update dream entries
- `editDream()`, `deleteDream()`: Dream modification operations
- `clearDreamForm()`: Form state management

**action-router.js**: Event handling and routing
- `extractActionContext()`: Context extraction from DOM events
- `ACTION_MAP`: Comprehensive action-to-handler mapping
- `handleUnifiedClick()`: Central click event processor

**main.js**: Application lifecycle
- `initializeTheme()`: Theme system setup
- `setupEventDelegation()`: Event system initialization
- Application startup and compatibility checks

**voice-notes.js**: Audio recording system
- `toggleRecording()`: Start/stop voice recording
- `transcribeVoiceNote()`: Speech-to-text processing
- `createDreamFromTranscription()`: Auto-dream creation

**goals.js & stats.js**: Analytics and goal tracking
- `calculateGoalProgress()`: Goal completion tracking
- `initCalendar()`: Statistics dashboard
- Dream streak and pattern analysis

### Application Flow

1. **Initialization** (main.js): DOM ready → compatibility checks → IndexedDB init → theme loading → UI display
2. **Event Handling** (action-router.js): All user interactions routed through centralized `ACTION_MAP`
3. **Data Persistence** (storage.js): Changes auto-saved to IndexedDB with migration support
4. **Module Loading**: Scripts loaded in dependency order via DreamJournal.html

### Script Loading Order
The application loads modules in this specific order to handle dependencies:
1. constants.js → state.js → storage.js → dom-helpers.js
2. security.js → dream-crud.js → voice-notes.js → goals.js
3. stats.js → import-export.js → action-router.js → main.js

## Development Commands

### Running the Application
- **Development**: Open DreamJournal.html in VS Code with Live Server extension
- **Testing**: Use browser dev tools for debugging (F12)
- **Supported Browsers**: 
  - Chrome/Edge (full features including voice)
  - Firefox/Safari (basic functionality, no voice features)

### Version Management
Current version: v1.43.19 (after duplication cleanup)

## Development Guidelines

Never use alert() and confirm()  or prompt() or any kind of pop-up. They don't work in my environment. Only use the custom popup system that's already been designed or display text/confirmation inline somewhere if necessary

Increment the version number in some way every time you make a change; I don't really care how. It's referenced in 3 places. Here:

1.
<!-- 
Dream Journal vX.XX.X - A privacy-focused dream tracking application
Copyright (C) 2025 Dream Journal Contributors

2.
// Create comprehensive export object
                const exportData = {
                    version: "vX.XX.X", // Updated version
                    exportDate: new Date().toISOString(),
                    exportType: "complete",

3.
            <p class="app-footer p">
                Dream Journal vX.XX.X | Not a substitute for professional medical advice
            </p>

### Making Changes
- **CSS**: Use existing HSL theme system - avoid hardcoded colors
- **JavaScript**: Place new functions in appropriate module based on domain
- **Event Handling**: Add new actions to ACTION_MAP in action-router.js
- **Constants**: Define configuration values in constants.js
- **Version Numbers**: Update version in 3 locations (see above)

### Module Guidelines
- **Constants**: Add new configuration to constants.js
- **State Management**: Use state.js for global application state
- **DOM Operations**: Use dom-helpers.js utilities for DOM manipulation
- **New Actions**: Register in ACTION_MAP and follow data-action pattern
- **Data Operations**: Use storage.js generic functions for IndexedDB operations

### Key Patterns
- Use `data-action` attributes for interactive elements
- Follow the existing CSS utility class naming
- Maintain the HSL theme variable structure
- Use `createInlineMessage()` for user feedback
- Handle async operations with proper error catching

### Testing & Debugging
- **Development Server**: Use VS Code Live Server extension
- **Browser Testing**: Chrome/Edge for full voice features, Firefox/Safari for basic functionality
- **Debugging**: Browser dev tools (F12) - no external testing framework
- **Module Loading**: Check browser console for script load order issues
- **Database Issues**: Use browser Application/Storage tab to inspect IndexedDB

### Data Handling
- All data is stored locally in IndexedDB
- Encryption available for exports using Web Crypto API
- No network requests - fully offline application