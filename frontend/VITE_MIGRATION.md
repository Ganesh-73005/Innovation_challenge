# Migration from CRACO to Vite

This project has been migrated from Create React App (CRA) with CRACO to Vite.

## Changes Made

### 1. Package Dependencies
- **Removed:**
  - `@craco/craco`
  - `react-scripts`
  - `cra-template`
  - `@babel/plugin-proposal-private-property-in-object`

- **Added:**
  - `vite` (^6.0.5)
  - `@vitejs/plugin-react` (^4.3.4)
  - `@types/react` (^18.3.12)
  - `@types/react-dom` (^18.3.1)

### 2. Configuration Files
- **Created:** `vite.config.js` - Vite configuration with:
  - React plugin
  - Path alias `@` pointing to `src/`
  - Server configuration (port 3000, auto-open)
  - Build optimization with code splitting
  - Source maps enabled

- **Removed:** `craco.config.js`

- **Updated:** 
  - `tailwind.config.js` - Updated content paths to reference `./index.html` instead of `./public/index.html`
  - `index.html` - Moved from `public/` to root and added Vite entry script

### 3. Scripts
Updated `package.json` scripts:
- `npm start` → `npm run dev` (or `npm start` - both work)
- `npm run build` → Uses Vite build
- `npm run preview` → Preview production build

### 4. File Structure
- `index.html` moved from `public/` to root directory (Vite requirement)
- Entry point: `<script type="module" src="/src/index.js"></script>`

## Installation & Usage

### Install Dependencies
```bash
cd frontend
npm install
```

### Development
```bash
npm run dev
# or
npm start
```
Server will start on http://localhost:3000

### Build for Production
```bash
npm run build
```
Output will be in `dist/` directory

### Preview Production Build
```bash
npm run preview
```

## Key Differences

1. **Faster Development:** Vite uses native ES modules for instant server start
2. **Better Performance:** Optimized builds with code splitting
3. **Modern Tooling:** Uses Rollup for production builds
4. **Path Aliases:** Configured in `vite.config.js` instead of `jsconfig.json` (though jsconfig.json still works for IDE support)

## Notes

- The `public/` folder still exists for static assets (images, fonts, etc.)
- All existing React code should work without changes
- Path aliases (`@/`) continue to work as before
- Tailwind CSS configuration remains the same

