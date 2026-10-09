const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');

const statusText = document.getElementById('statusText');
const syncBadge = document.getElementById('syncBadge');
const mapTitle = document.getElementById('mapTitle');

const toolButtons = [...document.querySelectorAll('.tool')];
const userNameInput = document.getElementById('userNameInput');
const sessionIdInput = document.getElementById('sessionIdInput');
const sessionConnectBtn = document.getElementById('connectSessionBtn');
const presenceBtn = document.getElementById('presenceBtn');
const saveMapBtn = document.getElementById('saveMapBtn');
const addObjectBtn = document.getElementById('addObjectBtn');
const newMapBtn = document.getElementById('newMapBtn');

const objectNameInput = document.getElementById('objectNameInput');
const layerSelect = document.getElementById('layerSelect');
const fillInput = document.getElementById('fillInput');
const strokeInput = document.getElementById('strokeInput');
const posXInput = document.getElementById('posXInput');
const posYInput = document.getElementById('posYInput');
const sizeWInput = document.getElementById('sizeWInput');
const sizeHInput = document.getElementById('sizeHInput');
const rotationInput = document.getElementById('rotationInput');
const radiusInput = document.getElementById('radiusInput');
const cornerInput = document.getElementById('cornerInput');
const opacityInput = document.getElementById('opacityInput');
const discordStatusInput = document.getElementById('discordStatusInput');
const discordDetailsInput = document.getElementById('discordDetailsInput');
const discordStateInput = document.getElementById('discordStateInput');

const state = {
  tool: 'select',
  map: null,
  selectedId: null,
  drag: null,
  socket: null,
  sessionId: null,
  isDirty: false,
  hover: null
};

const defaultMap = {
  id: 'fortazan-kudo',
  name: 'Fortazan Kudo',
  description: 'Tactical map prototype',
  width: 1600,
  height: 1000,
  gridSize: 40,
  layers: [
    { id: 'terrain', name: 'Terrain', visible: true },
    { id: 'structures', name: 'Structures', visible: true },
    { id: 'tactics', name: 'Tactical markers', visible: true }
  ],
  objects: [],
  players: [],
  markers: [],
  updatedAt: new Date().toISOString()
};

function setStatus(text, mode = 'info') {
  statusText.textContent = text;
  statusText.style.color = mode === 'error' ? '#fca5a5' : mode === 'success' ? '#86efac' : '#94a3b8';
}

function setSyncBadge(connected) {
  syncBadge.textContent = connected ? 'live' : 'offline';
  syncBadge.style.background = connected ? 'rgba(34, 197, 94, 0.12)' : 'rgba(148, 163, 184, 0.12)';
  syncBadge.style.color = connected ? '#86efac' : '#cbd5e1';
}

function cloneMap(map) {
  return JSON.parse(JSON.stringify(map || defaultMap));
}

function getSelectedObject() {
  return (state.map?.objects || []).find((item) => item.id === state.selectedId) || null;
}

function toWorldPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const screenX = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const screenY = ((event.clientY - rect.top) / rect.height) * canvas.height;

  return {
    x: screenX - canvas.width / 2,
    y: screenY - 80
  };
}

function worldToCanvas(worldX, worldY) {
  return {
    x: worldX + canvas.width / 2,
    y: worldY + canvas.height / 2
  };
}

function canvasToWorld(screenX, screenY) {
  return {
    x: screenX - canvas.width / 2,
    y: screenY - canvas.height / 2
  };
}

function generateId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

function makeRectObject(x, y, width = 120, height = 80) {
  return {
    id: generateId('rect'),
    name: 'Rect object',
    type: 'rectangle',
    layer: 'structures',
    x,
    y,
    width,
    height,
    rotation: 0,
    cornerRadius: 14,
    fill: '#4f46e5',
    stroke: '#e2e8f0',
    strokeWidth: 2,
    opacity: 0.9,
    z: 10,
    locked: false
  };
}

function makeCircleObject(x, y, radius = 60) {
  return {
    id: generateId('circle'),
    name: 'Circle zone',
    type: 'circle',
    layer: 'tactics',
    x,
    y,
    radius,
    fill: '#60a5fa',
    stroke: '#dbeafe',
    strokeWidth: 2,
    opacity: 0.5,
    z: 18
  };
}

function makeMarkerObject(x, y, label = 'M') {
  return {
    id: generateId('marker'),
    name: 'Marker',
    type: 'marker',
    layer: 'tactics',
    x,
    y,
    width: 42,
    height: 42,
    rotation: 0,
    fill: '#f59e0b',
    stroke: '#fef3c7',
    strokeWidth: 2,
    opacity: 0.96,
    z: 20,
    label
  };
}

function makePolygonObject(x, y) {
  return {
    id: generateId('poly'),
    name: 'Polygon',
    type: 'polygon',
    layer: 'terrain',
    x,
    y,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 30 },
      { x: 120, y: 100 },
      { x: 40, y: 150 },
      { x: -20, y: 80 }
    ],
    fill: '#0ea5e9',
    stroke: '#e0f2fe',
    strokeWidth: 2,
    opacity: 0.8,
    z: 14,
    rotation: 0
  };
}

function getObjectPoints(object) {
  if (!object) return [];

  switch (object.type) {
    case 'rectangle': {
      const { x, y, width, height } = object;
      return [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height }
      ];
    }
    case 'circle': {
      const points = [];
      const rad = object.radius || 60;
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        points.push({
          x: object.x + Math.cos(angle) * rad,
          y: object.y + Math.sin(angle) * rad
        });
      }
      return points;
    }
    case 'polygon': {
      return (object.points || []).map((point) => ({
        x: object.x + point.x,
        y: object.y + point.y
      }));
    }
    case 'marker': {
      const { x, y, width = 40, height = 40 } = object;
      return [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height }
      ];
    }
    default:
      return [];
  }
}

function getBoundingBoxForObject(object) {
  const points = getObjectPoints(object);
  if (!points.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function toCanvasPoint(worldX, worldY) {
  const p = worldToCanvas(worldX, worldY);
  return p;
}

function drawGrid() {
  const step = 40;
  ctx.strokeStyle = 'rgba(148,163,184,0.14)';
  ctx.lineWidth = 1;

  for (let x = -canvas.width; x < canvas.width * 2; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = -canvas.height; y < canvas.height * 2; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawRoundedRect(object) {
  const { x, y, width, height, cornerRadius = 14 } = object;
  const localX = x + canvas.width / 2;
  const localY = y + canvas.height / 2;

  ctx.beginPath();
  const r = Math.min(cornerRadius, width / 2, height / 2);

  ctx.moveTo(localX + r, localY);
  ctx.lineTo(localX + width - r, localY);
  ctx.quadraticCurveTo(localX + width, localY, localX + width, localY + r);
  ctx.lineTo(localX + width, localY + height - r);
  ctx.quadraticCurveTo(localX + width, localY + height, localX + width - r, localY + height);
  ctx.lineTo(localX + r, localY + height);
  ctx.quadraticCurveTo(localX, localY + height, localX, localY + height - r);
  ctx.lineTo(localX, localY + r);
  ctx.quadraticCurveTo(localX, localY, localX + r, localY);
  ctx.closePath();

  ctx.fillStyle = object.fill;
  ctx.globalAlpha = object.opacity || 1;
  ctx.fill();

  ctx.strokeStyle = object.stroke || '#fff';
  ctx.lineWidth = object.strokeWidth || 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawCircle(object) {
  const cx = object.x + canvas.width / 2;
  const cy = object.y + canvas.height / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, object.radius, object.radius, 0, 0, Math.PI * 2);
  ctx.fillStyle = object.fill;
  ctx.globalAlpha = object.opacity || 1;
  ctx.fill();
  ctx.strokeStyle = object.stroke || '#ffffff';
  ctx.lineWidth = object.strokeWidth || 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPolygonShape(object) {
  const points = (object.points || []).map((point) => ({
    x: object.x + point.x + canvas.width / 2,
    y: object.y + point.y + canvas.height / 2
  }));

  if (!points.length) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = object.fill;
  ctx.globalAlpha = object.opacity || 1;
  ctx.fill();
  ctx.strokeStyle = object.stroke || '#fff';
  ctx.lineWidth = object.strokeWidth || 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawMarker(object) {
  const cx = object.x + canvas.width / 2;
  const cy = object.y + canvas.height / 2;

  ctx.beginPath();
  ctx.moveTo(cx, cy - 20);
  ctx.lineTo(cx + 18, cy);
  ctx.lineTo(cx, cy + 20);
  ctx.lineTo(cx - 18, cy);
  ctx.closePath();

  ctx.fillStyle = object.fill;
  ctx.globalAlpha = object.opacity || 1;
  ctx.fill();
  ctx.strokeStyle = object.stroke || '#fff';
  ctx.lineWidth = object.strokeWidth || 2;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(object.label || 'M', cx, cy + 4);
  ctx.globalAlpha = 1;
}

function drawPlayer(player) {
  const px = player.x + canvas.width / 2;
  const py = player.y + canvas.height / 2;

  ctx.beginPath();
  ctx.fillStyle = player.color || '#34d399';
  ctx.arc(px, py, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(player.name || 'Player', px, py - 18);
}

function drawMarkerLabel(marker) {
  const mx = marker.x + canvas.width / 2;
  const my = marker.y + canvas.height / 2;

  ctx.fillStyle = marker.color || '#fbbf24';
  ctx.beginPath();
  ctx.arc(mx, my, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(marker.label || 'Mark', mx + 14, my + 4);
}

function drawSelection(object) {
  if (!object) return;
  const box = getBoundingBoxForObject(object);
  if (!box) return;

  const startX = box.x + canvas.width / 2;
  const startY = box.y + canvas.height / 2;

  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(startX, startY, box.width, box.height);
  ctx.setLineDash([]);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  if (!state.map) return;

  const sortedObjects = [...(state.map.objects || [])].sort((a, b) => (a.z || 0) - (b.z || 0));

  sortedObjects.forEach((object) => {
    if (object.type === 'rectangle') drawRoundedRect(object);
    if (object.type === 'circle') drawCircle(object);
    if (object.type === 'polygon') drawPolygonShape(object);
    if (object.type === 'marker') drawMarker(object);
  });

  (state.map.markers || []).forEach(drawMarkerLabel);
  (state.map.players || []).forEach(drawPlayer);

  const selected = getSelectedObject();
  if (selected) drawSelection(selected);
}

function refreshInspector() {
  const object = getSelectedObject();
  if (!object) {
    objectNameInput.value = '';
    layerSelect.value = 'structures';
    fillInput.value = '#4f46e5';
    strokeInput.value = '#e2e8f0';
    posXInput.value = 0;
    posYInput.value = 0;
    sizeWInput.value = 100;
    sizeHInput.value = 100;
    rotationInput.value = 0;
    radiusInput.value = 50;
    cornerInput.value = 0;
    opacityInput.value = 0.9;
    return;
  }

  objectNameInput.value = object.name || '';
  layerSelect.value = object.layer || 'structures';
  fillInput.value = object.fill || '#4f46e5';
  strokeInput.value = object.stroke || '#e2e8f0';
  posXInput.value = Math.round(object.x || 0);
  posYInput.value = Math.round(object.y || 0);
  sizeWInput.value = Math.round(object.width || object.radius || 100);
  sizeHInput.value = Math.round(object.height || object.radius || 100);
  rotationInput.value = Math.round(object.rotation || 0);
  radiusInput.value = Math.round(object.radius || 50);
  cornerInput.value = Math.round(object.cornerRadius || 0);
  opacityInput.value = Number(object.opacity || 0.9).toFixed(1);
}

function applyInspectorToSelected() {
  const object = getSelectedObject();
  if (!object) return;

  object.name = objectNameInput.value || object.name;
  object.layer = layerSelect.value;
  object.fill = fillInput.value;
  object.stroke = strokeInput.value;
  object.x = Number(posXInput.value || 0);
  object.y = Number(posYInput.value || 0);
  object.width = Number(sizeWInput.value || 100);
  object.height = Number(sizeHInput.value || 100);
  object.rotation = Number(rotationInput.value || 0);
  object.radius = Number(radiusInput.value || 50);
  object.cornerRadius = Number(cornerInput.value || 0);
  object.opacity = Number(opacityInput.value || 0.9);
  state.isDirty = true;
  render();
}

Object.entries({
  objectNameInput,
  layerSelect,
  fillInput,
  strokeInput,
  posXInput,
  posYInput,
  sizeWInput,
  sizeHInput,
  rotationInput,
  radiusInput,
  cornerInput,
  opacityInput
}).forEach(([key, el]) => {
  if (el) {
    el.addEventListener('input', applyInspectorToSelected);
  }
});

function setTool(tool) {
  state.tool = tool;
  toolButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === tool);
  });
}

toolButtons.forEach((button) => {
  button.addEventListener('click', () => setTool(button.dataset.tool));
});

function addObjectAtPosition(x, y) {
  let item;
  if (state.tool === 'rectangle') item = makeRectObject(x, y, 120, 80);
  if (state.tool === 'circle') item = makeCircleObject(x, y, 60);
  if (state.tool === 'marker') item = makeMarkerObject(x, y, 'M');
  if (state.tool === 'polygon') item = makePolygonObject(x, y);

  if (!item) return;

  state.map.objects.push(item);
  state.selectedId = item.id;
  refreshInspector();
  state.isDirty = true;
  render();
}

function deleteSelectedObject() {
  if (!state.selectedId) return;

  state.map.objects = state.map.objects.filter((item) => item.id !== state.selectedId);
  state.selectedId = null;
  state.isDirty = true;
  refreshInspector();
  render();
}

canvas.addEventListener('pointerdown', (event) => {
  const world = toWorldPointer(event);
  const object = [...(state.map?.objects || [])].reverse().find((item) => {
    const box = getBoundingBoxForObject(item);
    if (!box) return false;
    return world.x >= box.x && world.x <= box.x + box.width && world.y >= box.y && world.y <= box.y + box.height;
  });

  if (state.tool === 'erase') {
    if (object) {
      deleteSelectedObject();
      state.map.objects = state.map.objects.filter((item) => item.id !== object.id);
    }
    return;
  }

  if (state.tool === 'select') {
    state.selectedId = object ? object.id : null;
    refreshInspector();
    render();
    return;
  }

  if (!object && state.tool !== 'select') {
    addObjectAtPosition(world.x, world.y);
    return;
  }

  if (object) {
    state.selectedId = object.id;
    refreshInspector();
    render();
  }
});

canvas.addEventListener('pointermove', (event) => {
  if (!state.map) return;
  const world = toWorldPointer(event);
  state.hover = world;

  if (state.drag && state.selectedId) {
    const selected = getSelectedObject();
    if (selected) {
      selected.x = Number((selected.x + (world.x - state.drag.x)).toFixed(1));
      selected.y = Number((selected.y + (world.y - state.drag.y)).toFixed(1));
      posXInput.value = Math.round(selected.x);
      posYInput.value = Math.round(selected.y);
      state.drag.x = world.x;
      state.drag.y = world.y;
      state.isDirty = true;
      render();
    }
  }
});

canvas.addEventListener('pointerup', () => {
  state.drag = null;
});

canvas.addEventListener('pointerleave', () => {
  state.drag = null;
});

canvas.addEventListener('dblclick', () => {
  if (state.selectedId && state.tool === 'select') {
    const selected = getSelectedObject();
    if (selected && selected.type === 'marker') {
      selected.label = prompt('Marker label', selected.label || 'M') || selected.label || 'M';
      render();
    }
  }
});

async function fetchMap() {
  try {
    const response = await fetch('/api/map');
    const data = await response.json();
    state.map = data;
    mapTitle.textContent = data.name || 'Fortazan Kudo';
    setStatus('Map loaded');
    render();
    refreshInspector();
  } catch (error) {
    console.error('Fetch map failed:', error);
    state.map = cloneMap(defaultMap);
    mapTitle.textContent = state.map.name;
    setStatus('Default map loaded', 'error');
    render();
  }
}

async function saveMap() {
  if (!state.map) return;

  try {
    const response = await fetch('/api/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.map)
    });

    const data = await response.json();
    state.map = data;
    state.isDirty = false;
    setStatus('Map saved', 'success');
    render();

    if (state.socket && state.socket.readyState === 1) {
      state.socket.send(JSON.stringify({ type: 'map:save', payload: state.map }));
    }
  } catch (error) {
    console.error('Save failed:', error);
    setStatus('Could not save map', 'error');
  }
}

async function connectSession() {
  const userName = userNameInput.value || 'Operator';
  const sessionId = sessionIdInput.value || `session-${Date.now()}`;

  try {
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userName, status: 'on-map' })
    });

    const data = await response.json();
    state.sessionId = data.sessionId;
    sessionIdInput.value = data.sessionId;
    setStatus(`Session connected: ${data.sessionId}`, 'success');
    setSyncBadge(true);
  } catch (error) {
    console.error('Connect failed:', error);
    setStatus('Session setup failed', 'error');
  }
}

async function updateDiscordPresence() {
  const sessionId = sessionIdInput.value || state.sessionId || 'global';

  try {
    const response = await fetch('/api/discord/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        status: discordStatusInput.value || 'In tactical planning',
        details: discordDetailsInput.value || 'Fortazan Kudo',
        state: discordStateInput.value || 'Tracking enemy positions'
      })
    });

    const payload = await response.json();
    setStatus(`Discord state: ${payload.status}`, 'success');
  } catch (error) {
    console.error('Discord update failed:', error);
    setStatus('Discord update failed', 'error');
  }
}

function connectWebSocket() {
  const socket = new WebSocket(`ws://${window.location.host}`);
  state.socket = socket;

  socket.onopen = () => {
    setSyncBadge(true);
    setStatus('Live sync connected');
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'map:update') {
        state.map = message.payload;
        render();
        setStatus('Map synchronized', 'success');
      }

      if (message.type === 'presence:update') {
        setStatus(`Presence: ${message.payload.status}`, 'success');
      }
    } catch (error) {
      console.error('WebSocket parse error:', error);
    }
  };

  socket.onclose = () => {
    setSyncBadge(false);
    setStatus('Disconnected from live sync');
  };
}

function attachActions() {
  saveMapBtn.addEventListener('click', saveMap);
  sessionConnectBtn.addEventListener('click', connectSession);
  presenceBtn.addEventListener('click', updateDiscordPresence);
  addObjectBtn.addEventListener('click', () => {
    const obj = makeRectObject(220, 200, 120, 80);
    state.map.objects.push(obj);
    state.selectedId = obj.id;
    refreshInspector();
    render();
  });

  newMapBtn.addEventListener('click', () => {
    state.map = cloneMap(defaultMap);
    state.selectedId = null;
    render();
    setStatus('New default map loaded');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      deleteSelectedObject();
    }
    if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      saveMap();
    }
  });
}

async function init() {
  attachActions();
  await fetchMap();
  connectWebSocket();
  refreshInspector();
}

init();
