# Majesty Tactical Map

Browser-first tactical map platform for Majesty RP.

This repository is shaped around a browser-based “thick client” architecture:
- the tactical map is edited directly in the browser
- the map state is stored as JSON and synchronized via API/WebSocket
- each user gets an independent session and presence state
- the same map can be opened on desktop, tablet, or mobile browser
- Discord activity can be updated per session without installing a native app

## Project goals

- Build a tactical 3D-style board with 2D editing tools and transform controls
- Allow offline map design and placement of structures, roads, zones, and markers
- Manage active players with per-session presence
- Keep all data client-side and sync only the map state between devices
- Make a mobile view that is usable without a dedicated app

## Stage 2 additions

This version adds:
- map management over a real data store
- multiple map IDs and session tracking
- separate mobile viewer mode
- stronger browser editor state and selection tools
- Discord presence payload support and live WebSocket sync
- a cleaner project structure for future expansion

## Run locally

```bash
npm install
npm start
```

Open:
- Desktop editor: http://localhost:3000/
- Mobile view: http://localhost:3000/mobile

## File structure

```text
/
  README.md
  server.js
  package.json
  .gitignore
  data/
    maps.json
    sessions.json
  public/
    index.html
    styles.css
    app.js
    mobile.html
    mobile.css
    mobile.js
```

## API

- `GET /api/health` — health check
- `GET /api/maps` — list all maps
- `GET /api/maps/:id` — get a single map
- `POST /api/maps/:id` — save a map state
- `GET /api/sessions` — list active sessions
- `POST /api/sessions` — create/update a session
- `GET /api/discord/presence` — return presence payload
- `POST /api/discord/presence` — update presence payload

## Editing features

- select / move / delete objects
- rectangle, circle, polygon, and marker tools
- size, position, opacity, color, layer adjustments
- map save to server
- live sync between browser clients

## Not included yet

This is still a web-first tactical tool, not a native app. It is intentionally designed to run in-browser with no installation friction, which matches your requirement for “no one wants to install an app.”
