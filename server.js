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
const MAP_FILE = path.join(DATA_DIR, 'map-state.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

const defaultMap = {
  id: 'fortazan-kudo',
  name: 'Fortazan Kudo',
  description: 'Tactical map prototype',
  width: 1200,
  height: 900,
  gridSize: 40,
  layers: [
    { id: 'terrain', name: 'Terrain', visible: true },
    { id: 'structures', name: 'Structures', visible: true },
    { id: 'tactics', name: 'Tactical markers', visible: true }
  ],
  objects: [
    {
      id: 'wall-1',
      name: 'Outer wall',
      type: 'rectangle',
      layer: 'structures',
      x: 180,
      y: 170,
      width: 480,
      height: 120,
      rotation: 0,
      cornerRadius: 18,
      fill: '#2d3748',
      stroke: '#dbeafe',
      strokeWidth: 2,
      opacity: 0.9,
      z: 10,
      locked: false
    },
    {
      id: 'marker-1',
      name: 'Enemy marker',
      type: 'marker',
      layer: 'tactics',
      x: 560,
      y: 420,
      width: 80,
      height: 80,
      rotation: 0,
      fill: '#ef4444',
      stroke: '#fecaca',
      opacity: 0.95,
      z: 20,
      label: 'E-1'
    },
    {
      id: 'circle-1',
      name: 'Zone',
      type: 'circle',
      layer: 'tactics',
      x: 760,
      y: 420,
      radius: 80,
      fill: '#60a5fa',
      stroke: '#dbeafe',
      opacity: 0.38,
      z: 18
    }
  ],
  players: [
    {
      id: 'session-player-1',
      name: 'Operator',
      x: 350,
      y: 260,
      color: '#22c55e',
      active: true,
      status: 'on-map'
    }
  ],
  markers: [
    { id: 'marker-a', label: 'Alert', x: 680, y: 300, color: '#f59e0b' }
  ],
  updatedAt: new Date().toISOString()
};

function loadMap() {
  try {
    if (!fs.existsSync(MAP_FILE)) {
      fs.writeFileSync(MAP_FILE, JSON.stringify(defaultMap, null, 2));
      return structuredClone(defaultMap);
    }

    const fileContent = fs.readFileSync(MAP_FILE, 'utf8');
    const parsed = JSON.parse(fileContent);
    return parsed;
  } catch (error) {
    console.error('Failed to load map state:', error);
    return structuredClone(defaultMap);
  }
}

function saveMap(mapState) {
  const payload = {
    ...mapState,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(MAP_FILE, JSON.stringify(payload, null, 2));
  return payload;
}

let mapState = loadMap();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function broadcast(message) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'ready', map: mapState.name, updatedAt: mapState.updatedAt });
});

app.get('/api/map', (req, res) => {
  mapState = loadMap();
  res.json(mapState);
});

app.post('/api/map', (req, res) => {
  const incoming = req.body;
  if (!incoming || !incoming.objects) {
    return res.status(400).json({ error: 'Invalid map payload.' });
  }

  mapState = saveMap(incoming);
  broadcast({ type: 'map:update', payload: mapState });
  res.json(mapState);
});

app.post('/api/session', (req, res) => {
  const { sessionId, userName, status } = req.body || {};
  const safeId = sessionId || `session-${Date.now()}`;
  const player = {
    id: `player-${safeId}`,
    name: userName || 'Operator',
    x: 360,
    y: 260,
    color: '#34d399',
    active: true,
    status: status || 'on-map'
  };

  mapState.players = mapState.players || [];
  const existingIndex = mapState.players.findIndex((p) => p.id === player.id);

  if (existingIndex >= 0) {
    mapState.players[existingIndex] = { ...mapState.players[existingIndex], ...player };
  } else {
    mapState.players.push(player);
  }

  mapState = saveMap(mapState);
  broadcast({ type: 'session:update', payload: { sessionId: safeId, player } });
  res.json({ sessionId: safeId, player });
});

app.get('/api/discord/presence', (req, res) => {
  const payload = {
    application: 'majesty-tactical-map',
    status: 'In tactical planning',
    details: 'Fortazan Kudo',
    state: 'Tracking enemy positions',
    largeImage: 'map',
    largeText: 'Majesty RP tactical map',
    smallImage: 'discord',
    smallText: 'Session active',
    timestamps: {
      start: Date.now() - 1000 * 60 * 12
    }
  };

  res.json(payload);
});

app.post('/api/discord/presence', (req, res) => {
  const incoming = req.body || {};
  const payload = {
    application: 'majesty-tactical-map',
    status: incoming.status || 'In tactical planning',
    details: incoming.details || 'Fortazan Kudo',
    state: incoming.state || 'Tracking enemy positions',
    largeImage: incoming.largeImage || 'map',
    largeText: incoming.largeText || 'Majesty RP tactical map',
    smallImage: incoming.smallImage || 'discord',
    smallText: incoming.smallText || 'Session active',
    sessionId: incoming.sessionId || 'global'
  };

  broadcast({ type: 'presence:update', payload });
  res.json(payload);
});

app.get('/api/session/:id?', (req, res) => {
  const { id } = req.params;
  const player = mapState.players.find((p) => p.id === `player-${id}` || p.id === id);
  res.json({ sessionId: id || 'global', player: player || null, map: mapState.name });
});

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'ready', payload: { map: mapState, connected: true } }));

  socket.on('message', (raw) => {
    try {
      const parsed = JSON.parse(raw.toString());
      if (parsed.type === 'map:save' && parsed.payload) {
        mapState = saveMap(parsed.payload);
        broadcast({ type: 'map:update', payload: mapState });
      }

      if (parsed.type === 'presence:update' && parsed.payload) {
        broadcast({ type: 'presence:update', payload: parsed.payload });
      }
    } catch (error) {
      console.error('WS message parse error:', error);
    }
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Majesty tactical map server running at http://localhost:${PORT}`);
});
