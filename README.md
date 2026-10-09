# Majesty Tactical Map

Browser-based tactical map platform for Majesty RP with: 
- 3D-style tactical board
- map editor for placing and shaping objects
- offline editor workflow
- real-time browser sync across devices
- Discord presence/session layer
- mobile-friendly layout without installing an app

## Features

- Isometric tactical board with grid and map layers
- Editor tools for rectangle, circle, polygon, marker, and wall objects
- Shape controls for size, position, rotation, corner radius, opacity, and color
- Local persistence and session-based data model
- REST API + WebSocket synchronization across browsers
- Discord activity payload builder for each session
- Responsive mobile UI to view or edit quickly from a phone browser

## Quick start

```bash
npm install
npm start
```

Then open:
- http://localhost:3000

## Project structure

- `server.js` — Express API and WebSocket server
- `public/` — browser app UI and map editor
- `data/default-map.json` — starting map state

## API

- `GET /api/health` — server status
- `GET /api/map` — load the active map
- `POST /api/map` — save map state
- `GET /api/discord/presence` — get Discord presence payload
- `POST /api/discord/presence` — update presence state
- `GET /ws` — WebSocket stream for live map events

## Browser usage

1. Open the app in a browser.
2. Select a tool from the left panel.
3. Click on the map to add a shape.
4. Adjust size and properties in the inspector.
5. Save the map to persist it.
6. Share the URL to other devices on the same network or hosting environment.

## Architecture

This project is built around a “thick-client browser” approach:
- the map state is processed locally in the browser
- a single shared JSON state is synced via API/WebSocket
- each user/session has their own map presence data
- Discord activity is layered on top without requiring a native app

## Notes

This is intentionally built as a browser-first tactical system rather than a native mobile wrapper. It keeps the map construction and tactical planning tools accessible by anyone with a web browser.
