# AGENTS.md

This file provides guidance to Gemini Jules (jules.google.com) when working with code in this repository.

## Project Overview

This is a **single-file HTML application** that implements a privacy-focused dream journal. The entire application is contained within `index.html` - there are no separate build tools, package managers, or external dependencies.

## Architecture

### Single-File Structure
- **HTML**: Application structure and UI templates
- **CSS**: HSL-based theme system with utility classes for light/dark themes
- **JavaScript**: Modular functions handling all application logic

### Core Systems

1. **Data Storage**: Uses IndexedDB for local persistence
   - Dreams, goals, voice notes, and settings stored locally
   - No server communication - fully client-side

2. **Theme System**: HSL-based CSS custom properties
   - Light/dark theme support via CSS variables
   - Utility classes for consistent styling

3. **Event System**: Centralized event delegation
   - All interactions handled through `data-action` attributes
   - Event handlers registered in `ACTION_HANDLERS` object

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

### Major Functions by Category

**Data Management** (lines ~6213-11628):
- `initDB()`: IndexedDB initialization
- `saveDream()`, `loadDreams()`: Dream CRUD operations
- `saveGoal()`, `loadGoals()`: Goals management
- `exportDreams()`, `importDreams()`: Data backup/restore

**UI Management** (lines ~3946-4700):
- `switchAppTab()`: Main navigation between sections
- `initializeTheme()`, `switchTheme()`: Theme handling
- Event delegation system via `setupEventDelegation()`

**Voice System** (lines ~5576-6200):
- `toggleRecording()`: Start/stop voice recording
- `transcribeVoiceNote()`: Speech-to-text processing
- `createDreamFromTranscription()`: Convert voice notes to dreams

**Goals & Analytics** (lines ~3082-3704):
- `calculateGoalProgress()`: Track goal completion
- `initCalendar()`: Statistics dashboard
- Dream streak and recall calculations

### Application Flow

1. **Initialization** (line 11629): DOM ready → check compatibility → init DB → load theme → display content
2. **Event Handling**: All user interactions routed through centralized action system
3. **Data Persistence**: Changes auto-saved to IndexedDB with error handling
4. **Theme Application**: CSS custom properties updated dynamically

## Development Guidelines

1. Never use alert() and confirm()  or prompt() or any kind of popup. They don't work in my environment. Only use the custom popup system that's already been designed or display text/confirmation inline somewhere if necessary

2. Increment the version number in some way every time you make a change, I don't really care how, it's just important it changes at all so I can be sure I'm not looking at a cached version. Here:

            <p class="app-footer p">
                Dream Journal vX.XX.X | Not a substitute for professional medical advice
            </p>


and here:

<!-- 
Dream Journal vX.XX.X - A privacy-focused dream tracking application
Copyright (C) 2025 Dream Journal Contributors

3. I know it's long, but it has a single file constraint

### Making Changes
- All code exists in the single HTML file
- CSS uses the existing HSL theme system - avoid hardcoded colors
- JavaScript follows the established pattern of standalone functions
- New features should integrate with the centralized event system

### Key Patterns
- Use `data-action` attributes for interactive elements
- Follow the existing CSS utility class naming
- Maintain the HSL theme variable structure
- Use `createInlineMessage()` for user feedback
- Handle async operations with proper error catching

### Testing
- Open `index.html` directly in a web browser
- Test in Chrome/Edge for full voice features, Firefox/Safari for basic functionality
- Use browser dev tools for debugging - no external testing framework

### Data Handling
- All data is stored locally in IndexedDB
- Encryption available for exports using Web Crypto API
- No network requests - fully offline application
