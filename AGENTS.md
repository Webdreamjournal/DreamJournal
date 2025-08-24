# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a single-file HTML dream journal application (DreamJournal.html) that prioritizes privacy and offline functionality. The entire application is contained in one self-contained HTML file with embedded CSS, JavaScript, and all dependencies.

## Architecture

### Core Components
- **Single File Application**: All code exists in `DreamJournal.html` - CSS, JavaScript, and HTML are embedded together
- **Dual Storage System**: 
  - IndexedDB for persistent storage (default)
  - In-memory storage fallback when IndexedDB unavailable
  - Automatic switching between storage types with data migration
- **Security Layer**: PIN-based encryption for dream entries with failed attempt protection
- **Voice Recording**: MediaRecorder API integration with transcription capabilities
- **Theme System**: HSL-based color system with light/dark theme support

### Key Data Structures
- **Dreams Store**: Main entries with title, content, date, lucid flags, tags, and dream signs
- **Voice Notes Store**: Audio recordings with metadata, transcriptions, and timestamps
- **Settings**: Theme preferences, PIN configuration, storage type selection

### Major Functionality Areas
1. **Dream Management**: CRUD operations with inline editing, search, filtering, and pagination
2. **Voice Recording**: Record, playback, transcription, and dream creation from voice notes
3. **Security**: PIN protection, auto-lock, PIN reset mechanisms
4. **Data Export**: JSON export with optional password protection and AI analysis format
5. **Privacy Features**: No external servers, local-only storage, encryption options

## Development Notes

1. Never use alert() and confirm()  or prompt() or any kind of popup. They don't work in my environment. Only use the custom popup system that's already been designed or display text/confirmation inline somewhere if necessary

2. Increment the version number in some way every time you make a change, I don't really care how, it's just important it changes at all so I can be sure I'm not looking at a cached version

3. I know it's long, but it has a single file constraint


### No Build System
- This is a single HTML file with no build process, package.json, or dependencies
- Open `DreamJournal.html` directly in a web browser to run the application
- No compilation, bundling, or server setup required

### Code Organization
- CSS: HSL theme system with utility classes (lines ~20-2000)
- JavaScript: Modular functions organized by feature area (lines ~2000+)
- HTML: Tab-based UI structure with overlays for PIN protection

### Key Constants and Configuration
- `CONSTANTS` object contains all app configuration (storage limits, timing, etc.)
- Database version controlled via `DB_VERSION` for schema migrations
- Voice storage limits and security timeouts are configurable

### Testing and Development
- No automated tests - manual testing in browser required
- Use browser DevTools for debugging
- IndexedDB can be inspected via Application tab in Chrome DevTools
- Console logging available for storage operations and errors

## Security Considerations
- PIN protection uses browser's built-in password input with timing attack prevention
- All encryption/decryption happens client-side
- No network requests - completely offline application
- Failed PIN attempts trigger progressive delays