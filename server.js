const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const MAPS_FILE = path.join(DATA_DIR, 'maps.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

function defaultMap() {
  return {
    id: 'fortazan-kudo',
    name: 'Fortazan Kudo',
    description: 'Main tactical map for the operation',
    width: 1600,
    height: 1000,
    gridSize: 40,
    layers: [
      { id: 'terrain', name: 'Terrain', visible: true },
      { id: 'structures', name: 'Structures', visible: true },
      { id: 'tactics', name: 'Tactical markers', visible: true }
    ],
    objects: [
      {
        id: 'road-1',
        name: 'Main road',
        type: 'rectangle',
        layer: 'terrain',
        x: 120,
        y: 160,
        width: 620,
        height: 120,
        rotation: 0,
        cornerRadius: 28,
        fill: '#334155',
        stroke: '#cbd5e1',
        strokeWidth: 2,
        opacity: 0.8,
        z: 5
      },
      {
        id: 'building-1',
        name: 'Building',
        type: 'rectangle',
        layer: 'structures',
        x: 440,
        y: 450,
        width: 260,
        height: 180,
        rotation: 0,
        cornerRadius: 18,
        fill: '#475569',
        stroke: '#e2e8f0',
        strokeWidth: 2,
        opacity: 0.9,
        z: 10
      },
      {
        id: 'enemy-1',
        name: 'Enemy marker',
        type: 'marker',
        layer: 'tactics',
        x: 780,
        y: 500,
        width: 70,
        height: 70,
        rotation: 0,
        fill: '#ef4444',
        stroke: '#fecaca',
        strokeWidth: 2,
        opacity: 1,
        z: 20,
        label: 'E-1'
      }
    ],
    players: [
      { id: 'player-alpha', name: 'Alpha', x: 320, y: 280, color: '#34d399', active: true },
      { id: 'player-beta', name: 'Bravo', x: 560, y: 310, color: '#60a5fa', active: true }
    ],
    markers: [
      { id: 'mark-1', label: 'Checkpoint', x: 650, y: 260, color: '#fbbf24' }
    ],
    updatedAt: new Date().toISOString()
  };
}

function defaultSessions() {
  return {
    sessions: [
      {
        id: 'session-operator-1',
        userName: 'Operator',
        status: 'On map',
        connectedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        mapId: 'fortazan-kudo'
      }
    ]
  };
}

function loadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
      return JSON.parse(JSON.stringify(fallback));
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return JSON.parse(JSON.stringify(fallback));
  }
}

function saveJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function ensureMapStore() {
  const mapStore = loadJson(MAPS_FILE, { maps: { 'fortazan-kudo': defaultMap() } });
  const data = mapStore && mapStore.maps ? mapStore : { maps: mapStore };

  if (!data.maps || !data.maps['fortazan-kudo']) {
    data.maps = { ...data.maps, 'fortazan-kudo': defaultMap() };
  }

  saveJson(MAPS_FILE, data);
  return data;
}

function getMapStore() {
  return ensureMapStore();
}

let mapStore = getMapStore();
let sessionsStore = loadJson(SESSIONS_FILE, defaultSessions());

function broadcast(message) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'ready', mapCount: Object.keys(mapStore.maps || {}).length });
});

app.get('/api/maps', (req, res) => {
  const maps = Object.values(mapStore.maps || {}).map((map) => ({
    id: map.id,
    name: map.name,
    description: map.description,
    updatedAt: map.updatedAt
  }));

  res.json({ maps });
});

app.get('/api/maps/:id', (req, res) => {
  const mapId = req.params.id;
  const map = (mapStore.maps || {})[mapId];

  if (!map) {
    return res.status(404).json({ error: 'Map not found.' });
  }

  res.json(map);
});

app.post('/api/maps/:id', (req, res) => {
  const mapId = req.params.id;
  const incoming = req.body;

  if (!incoming || !incoming.objects) {
    return res.status(400).json({ error: 'Invalid map payload.' });
  }

  const updated = {
    ...incoming,
    id: mapId,
    updatedAt: new Date().toISOString()
  };

  mapStore.maps = mapStore.maps || {};
  mapStore.maps[mapId] = updated;
  saveJson(MAPS_FILE, mapStore);

  broadcast({ type: 'map:update', payload: updated });
  res.json(updated);
});

app.get('/api/sessions', (req, res) => {
  const list = Array.isArray(sessionsStore.sessions) ? sessionsStore.sessions : [];
  res.json({ sessions: list });
});

app.post('/api/sessions', (req, res) => {
  const payload = req.body || {};
  const id = payload.id || `session-${Date.now()}`;

  const entry = {
    id,
    userName: payload.userName || 'Operator',
    status: payload.status || 'On map',
    mapId: payload.mapId || 'fortazan-kudo',
    connectedAt: payload.connectedAt || new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };

  sessionsStore.sessions = Array.isArray(sessionsStore.sessions) ? sessionsStore.sessions : [];
  const idx = sessionsStore.sessions.findIndex((session) => session.id === id);

  if (idx >= 0) {
    sessionsStore.sessions[idx] = { ...sessionsStore.sessions[idx], ...entry };
  } else {
    sessionsStore.sessions.push(entry);
  }

  saveJson(SESSIONS_FILE, sessionsStore);
  broadcast({ type: 'session:update', payload: entry });
  res.json(entry);
});

app.get('/api/discord/presence', (req, res) => {
  const sessionId = req.query.sessionId || 'session-operator-1';
  const payload = {
    application: 'majesty-tactical-map',
    status: 'In tactical planning',
    details: 'Fortazan Kudo',
    state: 'Tracking enemy positions',
    largeImage: 'map',
    largeText: 'Majesty RP tactical map',
    smallImage: 'discord',
    smallText: 'Session active',
    sessionId
  };

  res.json(payload);
});

app.post('/api/discord/presence', (req, res) => {
  const body = req.body || {};
  const payload = {
    application: 'majesty-tactical-map',
    status: body.status || 'In tactical planning',
    details: body.details || 'Fortazan Kudo',
    state: body.state || 'Tracking enemy positions',
    largeImage: body.largeImage || 'map',
    largeText: body.largeText || 'Majesty RP tactical map',
    smallImage: body.smallImage || 'discord',
    smallText: body.smallText || 'Session active',
    sessionId: body.sessionId || 'global'
  };

  broadcast({ type: 'presence:update', payload });
  res.json(payload);
});

app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'ready', payload: { maps: Object.values(mapStore.maps || {}), sessions: sessionsStore.sessions } }));

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type === 'map:save' && message.payload) {
        const { id } = message.payload;
        mapStore.maps = mapStore.maps || {};
        mapStore.maps[id] = { ...message.payload, updatedAt: new Date().toISOString() };
        saveJson(MAPS_FILE, mapStore);
        broadcast({ type: 'map:update', payload: mapStore.maps[id] });
      }

      if (message.type === 'presence:update' && message.payload) {
        broadcast({ type: 'presence:update', payload: message.payload });
      }
    } catch (error) {
      console.error('WS parse error:', error);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Majesty tactical map server is running on http://localhost:${PORT}`);
});
