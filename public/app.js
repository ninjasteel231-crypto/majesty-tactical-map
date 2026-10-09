const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');

const statusText = document.getElementById('statusText');
const syncBadge = document.getElementById('syncBadge');
const mapTitle = document.getElementById('mapTitle');

const toolButtons = [...document.querySelectorAll('.tool')];
const playerNameInput = document.getElementById('playerNameInput');
const sessionIdInput = document.getElementById('sessionIdInput');
const addObjectBtn = document.getElementById('addObjectBtn');
const saveMapBtn = document.getElementById('saveMapBtn');
const resetMapBtn = document.getElementById('resetMapBtn');
const mobileViewBtn = document.getElementById('mobileViewBtn');
const connectSessionBtn = document.getElementById('connectSessionBtn');
const presenceBtn = document.getElementById('presenceBtn');
const layerList = document.getElementById('layerList');

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
  mode: 'edit', // 'edit' or 'view'
  map: null,
  selectedId: null,
  selectedHandle: null, // 'move', 'tl', 'tr', 'bl', 'br', 'resize'
  socket: null,
  drag: null,
  isDirty: false,
  sessionId: null,
  mapId: 'fortazan-kudo',
  visibleLayers: {}
};

const HANDLE_SIZE = 8;
const HANDLE_DIST = 12;

const defaultMap = {
  id: 'fortazan-kudo',
  name: 'Fortazan Kudo',
  description: 'Main tactical map',
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
      y: 150,
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
      name: 'Building A',
      type: 'rectangle',
      layer: 'structures',
      x: 470,
      y: 420,
      width: 260,
      height: 180,
      rotation: 0,
      cornerRadius: 18,
      fill: '#475569',
      stroke: '#e2e8f0',
      strokeWidth: 2,
      opacity: 0.92,
      z: 10
    },
    {
      id: 'enemy-1',
      name: 'Enemy marker',
      type: 'marker',
      layer: 'tactics',
      x: 790,
      y: 500,
      width: 74,
      height: 74,
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
    { id: 'player-alpha', name: 'Alpha', x: 300, y: 330, color: '#34d399', active: true },
    { id: 'player-beta', name: 'Bravo', x: 570, y: 360, color: '#60a5fa', active: true }
  ],
  markers: [
    { id: 'm-1', label: 'Checkpoint', x: 680, y: 260, color: '#fbbf24' }
  ],
  updatedAt: new Date().toISOString()
};

function setStatus(text, type = 'info') {
  statusText.textContent = text;
  if (type === 'success') statusText.style.color = '#86efac';
  else if (type === 'error') statusText.style.color = '#fca5a5';
  else statusText.style.color = '#94a3b8';
}

function setSyncBadge(online) {
  syncBadge.textContent = online ? 'live' : 'offline';
  syncBadge.style.background = online ? 'rgba(34, 197, 94, 0.12)' : 'rgba(148, 163, 184, 0.12)';
  syncBadge.style.color = online ? '#86efac' : '#cbd5e1';
}

function cloneMap(map) {
  return JSON.parse(JSON.stringify(map || defaultMap));
}

function generateId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

function getSelectedObject() {
  return state.map?.objects.find((obj) => obj.id === state.selectedId) || null;
}

function isLayerVisible(layerId) {
  if (state.visibleLayers[layerId] === undefined) {
    const layer = state.map?.layers.find(l => l.id === layerId);
    return layer?.visible ?? true;
  }
  return state.visibleLayers[layerId];
}

function toggleLayerVisibility(layerId) {
  state.visibleLayers[layerId] = !isLayerVisible(layerId);
  renderLayerList();
  render();
}

function renderLayerList() {
  layerList.innerHTML = '';
  (state.map?.layers || []).forEach((layer) => {
    const visible = isLayerVisible(layer.id);
    const div = document.createElement('div');
    div.className = 'layer-item';
    div.innerHTML = `
      <button class="layer-toggle" data-layer-id="${layer.id}" style="opacity: ${visible ? 1 : 0.5}">
        ${visible ? '👁' : '👁‍🗨'}
      </button>
      <span class="layer-name">${layer.name}</span>
    `;
    div.querySelector('.layer-toggle').addEventListener('click', () => toggleLayerVisibility(layer.id));
    layerList.appendChild(div);
  });
}

function getObjectPoints(obj) {
  if (!obj) return [];

  switch (obj.type) {
    case 'rectangle':
      return [
        { x: obj.x, y: obj.y },
        { x: obj.x + obj.width, y: obj.y },
        { x: obj.x + obj.width, y: obj.y + obj.height },
        { x: obj.x, y: obj.y + obj.height }
      ];
    case 'circle': {
      const points = [];
      const radius = obj.radius || 50;
      for (let i = 0; i < 24; i++) {
        const angle = (Math.PI * 2 * i) / 24;
        points.push({
          x: obj.x + Math.cos(angle) * radius,
          y: obj.y + Math.sin(angle) * radius
        });
      }
      return points;
    }
    case 'polygon':
      return (obj.points || []).map((p) => ({ x: obj.x + p.x, y: obj.y + p.y }));
    case 'marker':
      return [
        { x: obj.x, y: obj.y },
        { x: obj.x + obj.width, y: obj.y },
        { x: obj.x + obj.width, y: obj.y + obj.height },
        { x: obj.x, y: obj.y + obj.height }
      ];
    default:
      return [];
  }
}

function getBoundingBox(obj) {
  const points = getObjectPoints(obj);
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

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function worldToCanvas(x, y) {
  return {
    x: x + canvas.width / 2,
    y: y + canvas.height / 2
  };
}

function pointerToWorld(event) {
  const rect = canvas.getBoundingClientRect();
  const sx = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const sy = ((event.clientY - rect.top) / rect.height) * canvas.height;
  return {
    x: sx - canvas.width / 2,
    y: sy - canvas.height / 2
  };
}

function getHandleAtPosition(obj, world) {
  if (!obj) return null;
  const box = getBoundingBox(obj);
  if (!box) return null;

  const handles = {
    tl: { x: box.x, y: box.y },
    tr: { x: box.x + box.width, y: box.y },
    bl: { x: box.x, y: box.y + box.height },
    br: { x: box.x + box.width, y: box.y + box.height },
    move: { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  };

  for (const [name, pos] of Object.entries(handles)) {
    const dist = Math.hypot(world.x - pos.x, world.y - pos.y);
    if (dist <= HANDLE_DIST) return name;
  }

  return null;
}

function drawGrid() {
  const step = state.map?.gridSize || 40;
  ctx.strokeStyle = 'rgba(148,163,184,0.12)';
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

function drawRoundedRect(obj) {
  const p = worldToCanvas(obj.x, obj.y);
  const radius = Math.min(obj.cornerRadius || 0, obj.width / 2, obj.height / 2);
  const x = p.x;
  const y = p.y;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + obj.width - radius, y);
  ctx.quadraticCurveTo(x + obj.width, y, x + obj.width, y + radius);
  ctx.lineTo(x + obj.width, y + obj.height - radius);
  ctx.quadraticCurveTo(x + obj.width, y + obj.height, x + obj.width - radius, y + obj.height);
  ctx.lineTo(x + radius, y + obj.height);
  ctx.quadraticCurveTo(x, y + obj.height, x, y + obj.height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  ctx.fillStyle = obj.fill || '#4f46e5';
  ctx.globalAlpha = obj.opacity || 1;
  ctx.fill();
  ctx.strokeStyle = obj.stroke || '#fff';
  ctx.lineWidth = obj.strokeWidth || 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawCircle(obj) {
  const p = worldToCanvas(obj.x, obj.y);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, obj.radius || 50, obj.radius || 50, 0, 0, Math.PI * 2);
  ctx.fillStyle = obj.fill || '#60a5fa';
  ctx.globalAlpha = obj.opacity || 1;
  ctx.fill();
  ctx.strokeStyle = obj.stroke || '#fff';
  ctx.lineWidth = obj.strokeWidth || 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPolygon(obj) {
  const points = (obj.points || []).map((p) => {
    const cp = worldToCanvas(obj.x + p.x, obj.y + p.y);
    return { x: cp.x, y: cp.y };
  });

  if (!points.length) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = obj.fill || '#0ea5e9';
  ctx.globalAlpha = obj.opacity || 1;
  ctx.fill();
  ctx.strokeStyle = obj.stroke || '#fff';
  ctx.lineWidth = obj.strokeWidth || 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawMarker(obj) {
  const p = worldToCanvas(obj.x, obj.y);
  const width = obj.width || 42;
  const height = obj.height || 42;

  ctx.beginPath();
  ctx.moveTo(p.x, p.y - height / 2);
  ctx.lineTo(p.x + width / 2, p.y);
  ctx.lineTo(p.x, p.y + height / 2);
  ctx.lineTo(p.x - width / 2, p.y);
  ctx.closePath();
  ctx.fillStyle = obj.fill || '#f59e0b';
  ctx.globalAlpha = obj.opacity || 1;
  ctx.fill();
  ctx.strokeStyle = obj.stroke || '#fff';
  ctx.lineWidth = obj.strokeWidth || 2;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(obj.label || 'M', p.x, p.y + 4);
  ctx.globalAlpha = 1;
}

function drawPlayers() {
  (state.map?.players || []).forEach((player) => {
    const p = worldToCanvas(player.x, player.y);
    ctx.beginPath();
    ctx.fillStyle = player.color || '#34d399';
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(player.name || 'Player', p.x, p.y - 18);
  });
}

function drawMapMarkers() {
  (state.map?.markers || []).forEach((marker) => {
    const p = worldToCanvas(marker.x, marker.y);
    ctx.beginPath();
    ctx.fillStyle = marker.color || '#fbbf24';
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(marker.label || 'Mark', p.x + 14, p.y + 4);
  });
}

function drawSelectionHandles(bounds) {
  if (!bounds) return;
  const p = worldToCanvas(bounds.x, bounds.y);

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(p.x, p.y, bounds.width, bounds.height);
  ctx.setLineDash([]);

  // Draw handles
  const handles = [
    { x: p.x, y: p.y, name: 'tl' },
    { x: p.x + bounds.width, y: p.y, name: 'tr' },
    { x: p.x, y: p.y + bounds.height, name: 'bl' },
    { x: p.x + bounds.width, y: p.y + bounds.height, name: 'br' }
  ];

  handles.forEach(({ x, y }) => {
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
  });

  // Draw move handle in center
  const cx = p.x + bounds.width / 2;
  const cy = p.y + bounds.height / 2;
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.arc(cx, cy, HANDLE_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function render() {
  if (!state.map) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  const visibleObjects = state.map.objects.filter(obj => isLayerVisible(obj.layer));
  const sortedObjects = [...visibleObjects].sort((a, b) => (a.z || 0) - (b.z || 0));

  sortedObjects.forEach((obj) => {
    if (obj.type === 'rectangle') drawRoundedRect(obj);
    else if (obj.type === 'circle') drawCircle(obj);
    else if (obj.type === 'polygon') drawPolygon(obj);
    else if (obj.type === 'marker') drawMarker(obj);
  });

  drawMapMarkers();
  drawPlayers();

  const selectedObj = getSelectedObject();
  const box = selectedObj ? getBoundingBox(selectedObj) : null;
  if (box && state.mode === 'edit') {
    drawSelectionHandles(box);
  }
}

function refreshInspector() {
  const item = getSelectedObject();
  if (!item) {
    objectNameInput.value = '';
    layerSelect.value = 'structures';
    fillInput.value = '#4f46e5';
    strokeInput.value = '#e2e8f0';
    posXInput.value = '0';
    posYInput.value = '0';
    sizeWInput.value = '100';
    sizeHInput.value = '100';
    rotationInput.value = '0';
    radiusInput.value = '50';
    cornerInput.value = '0';
    opacityInput.value = '0.9';
    return;
  }

  objectNameInput.value = item.name || '';
  layerSelect.value = item.layer || 'structures';
  fillInput.value = item.fill || '#4f46e5';
  strokeInput.value = item.stroke || '#e2e8f0';
  posXInput.value = Math.round(item.x || 0);
  posYInput.value = Math.round(item.y || 0);
  sizeWInput.value = Math.round(item.width || item.radius || 100);
  sizeHInput.value = Math.round(item.height || item.radius || 100);
  rotationInput.value = Math.round(item.rotation || 0);
  radiusInput.value = Math.round(item.radius || 50);
  cornerInput.value = Math.round(item.cornerRadius || 0);
  opacityInput.value = Number(item.opacity || 0.9).toFixed(1);
}

function applyInspector() {
  const item = getSelectedObject();
  if (!item) return;

  item.name = objectNameInput.value || item.name;
  item.layer = layerSelect.value;
  item.fill = fillInput.value;
  item.stroke = strokeInput.value;
  item.x = Number(posXInput.value || 0);
  item.y = Number(posYInput.value || 0);
  item.width = Number(sizeWInput.value || 100);
  item.height = Number(sizeHInput.value || 100);
  item.radius = Number(radiusInput.value || 50);
  item.rotation = Number(rotationInput.value || 0);
  item.cornerRadius = Number(cornerInput.value || 0);
  item.opacity = Number(opacityInput.value || 0.9);

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
}).forEach(([_, el]) => {
  if (el) el.addEventListener('input', applyInspector);
});

function setTool(tool) {
  state.tool = tool;
  toolButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tool === tool));
}

toolButtons.forEach((btn) => btn.addEventListener('click', () => setTool(btn.dataset.tool)));

function makeRectangle(x, y) {
  return {
    id: generateId('rect'),
    name: 'Rectangle object',
    type: 'rectangle',
    layer: 'structures',
    x,
    y,
    width: 140,
    height: 90,
    rotation: 0,
    cornerRadius: 18,
    fill: '#4f46e5',
    stroke: '#e2e8f0',
    strokeWidth: 2,
    opacity: 0.9,
    z: 10
  };
}

function makeCircle(x, y) {
  return {
    id: generateId('circle'),
    name: 'Zone',
    type: 'circle',
    layer: 'tactics',
    x,
    y,
    radius: 60,
    fill: '#60a5fa',
    stroke: '#dbeafe',
    strokeWidth: 2,
    opacity: 0.5,
    z: 18
  };
}

function makeMarker(x, y) {
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
    label: 'M'
  };
}

function makePolygon(x, y) {
  return {
    id: generateId('poly'),
    name: 'Polygon',
    type: 'polygon',
    layer: 'terrain',
    x,
    y,
    points: [
      { x: 0, y: 0 },
      { x: 120, y: 35 },
      { x: 150, y: 110 },
      { x: 50, y: 150 },
      { x: -10, y: 80 }
    ],
    fill: '#0ea5e9',
    stroke: '#e0f2fe',
    strokeWidth: 2,
    opacity: 0.8,
    z: 12
  };
}

function addObjectAtPosition(x, y) {
  let obj = null;

  if (state.tool === 'rectangle') obj = makeRectangle(x, y);
  if (state.tool === 'circle') obj = makeCircle(x, y);
  if (state.tool === 'marker') obj = makeMarker(x, y);
  if (state.tool === 'polygon') obj = makePolygon(x, y);

  if (!obj) return;

  state.map.objects.push(obj);
  state.selectedId = obj.id;
  state.isDirty = true;
  refreshInspector();
  render();
}

function deleteSelected() {
  if (!state.selectedId) return;
  state.map.objects = state.map.objects.filter((obj) => obj.id !== state.selectedId);
  state.selectedId = null;
  state.isDirty = true;
  refreshInspector();
  render();
}

canvas.addEventListener('pointerdown', (event) => {
  if (state.mode !== 'edit') return;

  const world = pointerToWorld(event);
  const selectedObj = getSelectedObject();

  // Check for handle interaction first
  if (selectedObj && state.tool === 'select') {
    const handle = getHandleAtPosition(selectedObj, world);
    if (handle) {
      state.selectedHandle = handle;
      state.drag = world;
      return;
    }
  }

  if (state.tool === 'erase') {
    const clicked = [...state.map.objects].reverse().find((obj) => {
      if (!isLayerVisible(obj.layer)) return false;
      const box = getBoundingBox(obj);
      if (!box) return false;
      return world.x >= box.x && world.x <= box.x + box.width && world.y >= box.y && world.y <= box.y + box.height;
    });

    if (clicked) {
      state.map.objects = state.map.objects.filter((obj) => obj.id !== clicked.id);
      state.selectedId = null;
      render();
      state.isDirty = true;
    }
    return;
  }

  if (state.tool === 'select') {
    const clicked = [...state.map.objects].reverse().find((obj) => {
      if (!isLayerVisible(obj.layer)) return false;
      const box = getBoundingBox(obj);
      if (!box) return false;
      return world.x >= box.x && world.x <= box.x + box.width && world.y >= box.y && world.y <= box.y + box.height;
    });

    state.selectedId = clicked ? clicked.id : null;
    refreshInspector();
    render();
    return;
  }

  addObjectAtPosition(world.x, world.y);
});

canvas.addEventListener('pointermove', (event) => {
  if (!state.map || !state.selectedId || state.mode !== 'edit') return;

  if (state.drag) {
    const world = pointerToWorld(event);
    const item = getSelectedObject();
    if (!item) return;

    if (state.selectedHandle === 'move') {
      item.x = Number((item.x + (world.x - state.drag.x)).toFixed(1));
      item.y = Number((item.y + (world.y - state.drag.y)).toFixed(1));
    } else if (state.selectedHandle === 'br') {
      item.width = Math.max(20, Number((item.width + (world.x - state.drag.x)).toFixed(1)));
      item.height = Math.max(20, Number((item.height + (world.y - state.drag.y)).toFixed(1)));
    } else if (state.selectedHandle === 'tr') {
      item.width = Math.max(20, Number((item.width + (world.x - state.drag.x)).toFixed(1)));
      item.y = Number((item.y + (world.y - state.drag.y)).toFixed(1));
      item.height = Math.max(20, Number((item.height - (world.y - state.drag.y)).toFixed(1)));
    } else if (state.selectedHandle === 'bl') {
      item.x = Number((item.x + (world.x - state.drag.x)).toFixed(1));
      item.width = Math.max(20, Number((item.width - (world.x - state.drag.x)).toFixed(1)));
      item.height = Math.max(20, Number((item.height + (world.y - state.drag.y)).toFixed(1)));
    } else if (state.selectedHandle === 'tl') {
      item.x = Number((item.x + (world.x - state.drag.x)).toFixed(1));
      item.y = Number((item.y + (world.y - state.drag.y)).toFixed(1));
      item.width = Math.max(20, Number((item.width - (world.x - state.drag.x)).toFixed(1)));
      item.height = Math.max(20, Number((item.height - (world.y - state.drag.y)).toFixed(1)));
    }

    state.drag = world;
    posXInput.value = Math.round(item.x);
    posYInput.value = Math.round(item.y);
    sizeWInput.value = Math.round(item.width || item.radius || 100);
    sizeHInput.value = Math.round(item.height || item.radius || 100);
    state.isDirty = true;
    render();
  }
});

canvas.addEventListener('pointerup', () => {
  state.drag = null;
  state.selectedHandle = null;
});

canvas.addEventListener('pointerleave', () => {
  state.drag = null;
  state.selectedHandle = null;
});

async function fetchMap() {
  try {
    const response = await fetch('/api/maps/fortazan-kudo');
    const data = await response.json();
    state.map = data;
    state.mapId = data.id;
    mapTitle.textContent = data.name || 'Fortazan Kudo';
    state.visibleLayers = {};
    renderLayerList();
    setStatus('Map loaded', 'success');
    render();
    refreshInspector();
  } catch (error) {
    console.error(error);
    state.map = cloneMap(defaultMap);
    mapTitle.textContent = state.map.name;
    state.visibleLayers = {};
    renderLayerList();
    setStatus('Loaded default map', 'error');
    render();
    refreshInspector();
  }
}

async function saveMap() {
  if (!state.map) return;

  try {
    const response = await fetch(`/api/maps/${state.map.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.map)
    });

    const saved = await response.json();
    state.map = saved;
    state.isDirty = false;
    setStatus('Map saved', 'success');
    render();

    if (state.socket && state.socket.readyState === 1) {
      state.socket.send(JSON.stringify({ type: 'map:save', payload: saved }));
    }
  } catch (error) {
    console.error('Save failed:', error);
    setStatus('Could not save map', 'error');
  }
}

async function connectSession() {
  const sessionId = sessionIdInput.value || `session-${Date.now()}`;
  const userName = playerNameInput.value || 'Operator';

  try {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: sessionId,
        userName,
        status: 'On map',
        mapId: state.mapId || 'fortazan-kudo'
      })
    });

    const data = await response.json();
    state.sessionId = data.id;
    sessionIdInput.value = data.id;
    setStatus(`Session connected: ${data.id}`, 'success');
    setSyncBadge(true);
  } catch (error) {
    console.error('Session connect failed:', error);
    setStatus('Session setup failed', 'error');
  }
}

async function updateDiscordPresence() {
  try {
    const response = await fetch('/api/discord/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionIdInput.value || state.sessionId || 'session-operator-1',
        status: discordStatusInput.value || 'In tactical planning',
        details: discordDetailsInput.value || 'Fortazan Kudo',
        state: discordStateInput.value || 'Tracking enemy positions'
      })
    });

    const payload = await response.json();
    setStatus(`Discord: ${payload.status}`, 'success');
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
        state.visibleLayers = {};
        renderLayerList();
        setStatus('Map synchronized', 'success');
        render();
      }
      if (message.type === 'presence:update') {
        setStatus(`Presence: ${message.payload.status}`, 'success');
      }
    } catch (error) {
      console.error('WS parse error:', error);
    }
  };

  socket.onclose = () => {
    setSyncBadge(false);
    setStatus('Live sync offline');
  };
}

function attachActions() {
  addObjectBtn.addEventListener('click', () => {
    const x = 200 + Math.random() * 200;
    const y = 200 + Math.random() * 180;
    const obj = makeRectangle(x, y);
    state.map.objects.push(obj);
    state.selectedId = obj.id;
    state.isDirty = true;
    refreshInspector();
    render();
  });

  saveMapBtn.addEventListener('click', saveMap);
  resetMapBtn.addEventListener('click', () => {
    state.map = cloneMap(defaultMap);
    state.selectedId = null;
    state.visibleLayers = {};
    renderLayerList();
    setStatus('Default map restored');
    render();
  });

  connectSessionBtn.addEventListener('click', connectSession);
  presenceBtn.addEventListener('click', updateDiscordPresence);
  mobileViewBtn.addEventListener('click', () => window.open('/mobile', '_blank'));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      deleteSelected();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
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
