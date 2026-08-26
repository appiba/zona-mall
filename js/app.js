const ACTIVITIES = [
    'MIRANDO PRODUCTO',
    'MIRANDO VITRINA',
    'PREGUNTANDO',
    'COMPRANDO',
    'CONSUMIENDO',
    'ESPERANDO',
    'SENTADO',
    'INTERACTUANDO CON ISLA',
    'ACTIVACION DE MARCA',
    'MIRANDO PUBLICIDAD',
    'OTRO'
  ];

  const state = {
    app: null,
    maps: [],
    zones: [],
    locales: [],
    config: {},
    selectedFloor: null,
    current: null,
    isDrawing: false,
    activePointerId: null,
    lastPoint: null,
    lastCaptureAt: 0,
    pendingPoints: [],
    pendingEvents: [],
    routeByFloor: {},
    stay: null,
    staysCount: 0,
    staySecondsTotal: 0,
    visitedFloors: new Set(),
    startedAt: null,
    timerId: null,
    stayTimerId: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
    pinch: null,
    mapLoaded: false
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', boot);

  function boot() {
    cacheElements();
    bindStaticEvents();
    renderActivityButtons();
    callServer('initApp')
      .then((app) => {
        state.app = app;
        state.maps = (window.ZonarConfig.maps || app.maps || []).map((map) => ({ ...map }));
        state.zones = normalizeZones(app.zonas || []);
        state.locales = app.locales || [];
        state.config = app.config || {};
        document.title = app.appName || 'Zonar Mall';
        els.appName.textContent = app.appName || 'Zonar Mall';
        renderSurveyors(app.encuestadores || []);
        renderFloorButtons();
        renderManualEventOptions();
      })
      .catch((error) => {
        showMapMessage('No se pudo iniciar la aplicacion. Revisa la conexion con Google Apps Script.');
        console.error(error);
      });
  }

  function cacheElements() {
    [
      'setupView',
      'trackerView',
      'setupForm',
      'appName',
      'surveyorSelect',
      'ageSelect',
      'genderSelect',
      'originSelect',
      'visitTypeSelect',
      'initialFloorOptions',
      'floorDialogOptions',
      'personBadge',
      'floorBadge',
      'surveyorBadge',
      'mainTimer',
      'mapViewport',
      'mapImage',
      'drawCanvas',
      'stayMarker',
      'mapMessage',
      'liftPanel',
      'startStayBtn',
      'pauseFollowBtn',
      'stayPanel',
      'stayTimer',
      'detectedLocation',
      'activityButtons',
      'manualPauseBtn',
      'manualEventBtn',
      'changeFloorBtn',
      'finishBtn',
      'floorDialog',
      'eventDialog',
      'manualEventSelect',
      'manualEventObservation',
      'saveManualEventBtn',
      'zoomOutBtn',
      'zoomResetBtn',
      'zoomInBtn'
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });
    state.ctx = els.drawCanvas.getContext('2d');
  }

  function bindStaticEvents() {
    els.setupForm.addEventListener('submit', startNewPerson);
    els.mapViewport.addEventListener('pointerdown', handlePointerDown);
    els.mapViewport.addEventListener('pointermove', handlePointerMove);
    els.mapViewport.addEventListener('pointerup', handlePointerUp);
    els.mapViewport.addEventListener('pointercancel', handlePointerUp);
    els.mapImage.addEventListener('load', () => {
      state.mapLoaded = true;
      hideMapMessage();
      resizeCanvas();
      replayFloor();
    });
    els.mapImage.addEventListener('error', () => {
      state.mapLoaded = false;
      resizeCanvas();
      showMapMessage(`Agrega la imagen oficial para ${getFloorLabel(state.selectedFloor)} en CONFIG antes de dibujar.`);
    });
    window.addEventListener('resize', () => {
      resizeCanvas();
      replayFloor();
      positionStayMarker();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.isDrawing) {
        stopDrawing();
        showLiftPanel();
      }
    });
    els.startStayBtn.addEventListener('click', startStayFromLastPoint);
    els.pauseFollowBtn.addEventListener('click', markFollowPause);
    els.manualPauseBtn.addEventListener('click', markManualPause);
    els.manualEventBtn.addEventListener('click', () => openDialog(els.eventDialog));
    els.saveManualEventBtn.addEventListener('click', saveManualEvent);
    els.changeFloorBtn.addEventListener('click', () => openDialog(els.floorDialog));
    els.finishBtn.addEventListener('click', finishTracking);
    els.zoomInBtn.addEventListener('click', () => setZoom(state.zoom + 0.2));
    els.zoomOutBtn.addEventListener('click', () => setZoom(state.zoom - 0.2));
    els.zoomResetBtn.addEventListener('click', () => setZoom(1));
    setInterval(flushAll, getNumberConfig('AUTO_SAVE_INTERVAL', 5000));
  }

  function renderSurveyors(surveyors) {
    els.surveyorSelect.innerHTML = '';
    const list = surveyors.length ? surveyors : ['E01', 'E02', 'E03', 'E04', 'E05', 'E06'].map((codigo) => ({ codigo, nombre: codigo }));
    list.forEach((surveyor) => {
      const option = document.createElement('option');
      option.value = surveyor.codigo;
      option.textContent = surveyor.codigo;
      els.surveyorSelect.append(option);
    });
  }

  function renderFloorButtons() {
    els.initialFloorOptions.innerHTML = '';
    els.floorDialogOptions.innerHTML = '';
    state.maps.forEach((map, index) => {
      const setupButton = buildFloorButton(map, () => {
        state.selectedFloor = map.id;
        updateFloorButtonStates();
      });
      const dialogButton = buildFloorButton(map, () => {
        closeDialog(els.floorDialog);
        changeFloor(map.id);
      });
      els.initialFloorOptions.append(setupButton);
      els.floorDialogOptions.append(dialogButton);
      if (index === 0 && !state.selectedFloor) {
        state.selectedFloor = map.id;
      }
    });
    updateFloorButtonStates();
  }

  function buildFloorButton(map, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.floor = map.id;
    button.textContent = map.label;
    button.addEventListener('click', onClick);
    return button;
  }

  function updateFloorButtonStates() {
    document.querySelectorAll('[data-floor]').forEach((button) => {
      button.classList.toggle('active', button.dataset.floor === state.selectedFloor);
    });
  }

  function renderManualEventOptions() {
    els.manualEventSelect.innerHTML = '';
    ACTIVITIES.forEach((activity) => {
      const option = document.createElement('option');
      option.value = activity;
      option.textContent = activity;
      els.manualEventSelect.append(option);
    });
  }

  function renderActivityButtons() {
    els.activityButtons.innerHTML = '';
    ACTIVITIES.forEach((activity) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = activity;
      button.addEventListener('click', () => toggleStayActivity(activity, button));
      els.activityButtons.append(button);
    });
  }

  function startNewPerson(event) {
    event.preventDefault();
    if (!state.selectedFloor) {
      return;
    }
    const payload = {
      encuestador: els.surveyorSelect.value,
      edad_rango: els.ageSelect.value,
      genero: els.genderSelect.value,
      procedencia: els.originSelect.value,
      tipo_visita: els.visitTypeSelect.value,
      piso_inicio: state.selectedFloor
    };
    callServer('createPerson', payload)
      .then((record) => {
        state.current = record;
        state.current.encuestador = payload.encuestador;
        state.startedAt = new Date(record.hora_inicio || Date.now());
        state.visitedFloors = new Set([state.selectedFloor]);
        state.routeByFloor = {};
        state.pendingPoints = [];
        state.pendingEvents = [];
        state.staysCount = 0;
        state.staySecondsTotal = 0;
        els.personBadge.textContent = record.persona_id;
        els.surveyorBadge.textContent = payload.encuestador;
        els.setupView.classList.add('hidden');
        els.trackerView.classList.remove('hidden');
        loadFloor(state.selectedFloor);
        startMainTimer();
      })
      .catch((error) => {
        console.error(error);
        alert('No se pudo crear la persona. Intenta nuevamente.');
      });
  }

  function loadFloor(floorId) {
    const map = getMap(floorId);
    state.selectedFloor = floorId;
    state.visitedFloors.add(floorId);
    els.floorBadge.textContent = map ? map.label : floorId;
    updateFloorButtonStates();
    resetZoom();
    hideLiftPanel();
    hideStayPanel();
    state.mapLoaded = false;
    els.mapImage.removeAttribute('src');
    if (map && map.src && map.src.startsWith('data:')) {
      els.mapImage.src = map.src;
    } else if (map && (map.fileId || map.fileName)) {
      showMapMessage(`Cargando mapa de ${map.label}...`);
      callServer('getMapData', floorId)
        .then((asset) => {
          if (state.selectedFloor === floorId) {
            els.mapImage.src = asset.dataUrl;
          }
        })
        .catch((error) => {
          console.error(error);
          showMapMessage(`Sube ${map.fileName || map.label} a Google Drive y ejecuta syncMapFileIdsByName.`);
        });
    } else {
      els.mapImage.src = map ? map.src : '';
    }
    resizeCanvas();
    replayFloor();
  }

  function changeFloor(nextFloor) {
    if (!state.current || nextFloor === state.selectedFloor) {
      return;
    }
    if (state.stay) {
      finishStay();
    }
    flushAll();
    const previous = state.selectedFloor;
    queueEvent({
      actividad: 'CAMBIO_PISO',
      observacion: `${getFloorLabel(previous)} -> ${getFloorLabel(nextFloor)}`
    });
    flushEvents();
    state.lastPoint = null;
    loadFloor(nextFloor);
  }

  function handlePointerDown(event) {
    if (!state.current || !state.mapLoaded) {
      return;
    }
    if (event.pointerType === 'touch' && event.isPrimary === false) {
      return;
    }
    if (state.stay) {
      finishStay();
    }
    const point = screenToMapCoordinates(event.clientX, event.clientY);
    if (!point) {
      return;
    }
    event.preventDefault();
    els.mapViewport.setPointerCapture(event.pointerId);
    hideLiftPanel();
    state.isDrawing = true;
    state.activePointerId = event.pointerId;
    state.lastPoint = point;
    state.lastCaptureAt = 0;
    addRoutePoint(point, 'INICIO_SEGMENTO');
  }

  function handlePointerMove(event) {
    if (!state.isDrawing || event.pointerId !== state.activePointerId) {
      return;
    }
    event.preventDefault();
    const point = screenToMapCoordinates(event.clientX, event.clientY);
    if (!point) {
      return;
    }
    const now = Date.now();
    const interval = getNumberConfig('POINT_CAPTURE_INTERVAL_MS', 180);
    if (now - state.lastCaptureAt < interval) {
      drawTemporarySegment(state.lastPoint, point);
      return;
    }
    addRoutePoint(point, 'RUTA');
  }

  function handlePointerUp(event) {
    if (!state.isDrawing || event.pointerId !== state.activePointerId) {
      return;
    }
    event.preventDefault();
    const point = screenToMapCoordinates(event.clientX, event.clientY);
    if (point) {
      addRoutePoint(point, 'FIN_SEGMENTO');
    }
    stopDrawing();
    showLiftPanel();
    flushRoutePoints();
  }

  function stopDrawing() {
    state.isDrawing = false;
    state.activePointerId = null;
  }

  function addRoutePoint(point, tipo) {
    if (!state.routeByFloor[state.selectedFloor]) {
      state.routeByFloor[state.selectedFloor] = [];
    }
    const normalized = normalizeCoordinates(point.x, point.y);
    const routePoint = {
      x: normalized.x,
      y: normalized.y,
      tipo,
      timestamp: new Date().toISOString()
    };
    state.routeByFloor[state.selectedFloor].push(routePoint);
    state.pendingPoints.push({
      persona_id: state.current.persona_id,
      recorrido_id: state.current.recorrido_id,
      piso: state.selectedFloor,
      x_normalized: routePoint.x,
      y_normalized: routePoint.y,
      timestamp: routePoint.timestamp,
      tipo
    });
    drawSegment(state.lastPoint, routePoint);
    state.lastPoint = routePoint;
    state.lastCaptureAt = Date.now();
  }

  function drawTemporarySegment(from, to) {
    if (!from || !to) {
      return;
    }
    replayFloor();
    drawSegment(from, to, true);
  }

  function drawSegment(from, to, temporary) {
    if (!from || !to) {
      return;
    }
    const ctx = state.ctx;
    const a = mapToScreenCoordinates(from.x, from.y);
    const b = mapToScreenCoordinates(to.x, to.y);
    if (!a || !b) {
      return;
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = temporary ? 'rgba(24, 116, 82, 0.42)' : 'rgba(24, 116, 82, 0.78)';
    ctx.lineWidth = getNumberConfig('MAP_LINE_WIDTH', 4);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function replayFloor() {
    clearCanvas();
    const points = state.routeByFloor[state.selectedFloor] || [];
    for (let index = 1; index < points.length; index += 1) {
      drawSegment(points[index - 1], points[index]);
    }
  }

  function clearCanvas() {
    const canvas = els.drawCanvas;
    state.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function resizeCanvas() {
    const rect = els.mapViewport.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    els.drawCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    els.drawCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    els.drawCanvas.style.width = `${rect.width}px`;
    els.drawCanvas.style.height = `${rect.height}px`;
    state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function startStayFromLastPoint() {
    if (!state.lastPoint) {
      return;
    }
    hideLiftPanel();
    const location = detectLocation(state.lastPoint);
    state.stay = {
      permanencia_id: cryptoRandomId(),
      point: { x: state.lastPoint.x, y: state.lastPoint.y },
      floor: state.selectedFloor,
      startedAt: new Date(),
      activities: [],
      location
    };
    els.detectedLocation.textContent = location ? `${location.nombre} ${location.codigo || ''}`.trim() : 'Sin local asociado';
    els.stayTimer.textContent = '00:00';
    els.stayPanel.classList.remove('hidden');
    positionStayMarker();
    els.stayMarker.classList.remove('hidden');
    clearInterval(state.stayTimerId);
    state.stayTimerId = setInterval(updateStayTimer, 250);
  }

  function finishStay() {
    if (!state.stay) {
      return;
    }
    const stay = state.stay;
    const endedAt = new Date();
    const duration = Math.max(0, Math.round((endedAt - stay.startedAt) / 1000));
    const minStay = getNumberConfig('MIN_STAY_SECONDS', 3);
    clearInterval(state.stayTimerId);
    hideStayPanel();
    els.stayMarker.classList.add('hidden');
    state.stay = null;
    if (duration < minStay) {
      return;
    }
    state.staysCount += 1;
    state.staySecondsTotal += duration;
    const location = stay.location || {};
    callServer('savePermanencia', {
      permanencia_id: stay.permanencia_id,
      persona_id: state.current.persona_id,
      piso: stay.floor,
      x: stay.point.x,
      y: stay.point.y,
      local_codigo: location.codigo || '',
      local_nombre: location.nombre || '',
      hora_inicio: stay.startedAt.toISOString(),
      hora_fin: endedAt.toISOString(),
      duracion_segundos: duration,
      clasificacion: classifyStay(duration)
    }).catch((error) => {
      queueOffline('savePermanencia', {
        permanencia_id: stay.permanencia_id,
        persona_id: state.current.persona_id,
        piso: stay.floor,
        x: stay.point.x,
        y: stay.point.y,
        local_codigo: location.codigo || '',
        local_nombre: location.nombre || '',
        hora_inicio: stay.startedAt.toISOString(),
        hora_fin: endedAt.toISOString(),
        duracion_segundos: duration,
        clasificacion: classifyStay(duration)
      });
      console.error(error);
    });
    if (stay.activities.length) {
      const events = stay.activities.map((entry) => ({
        evento_id: cryptoRandomId(),
        persona_id: state.current.persona_id,
        permanencia_id: stay.permanencia_id,
        timestamp: entry.timestamp,
        actividad: entry.activity,
        local_codigo: location.codigo || '',
        local_nombre: location.nombre || '',
        observacion: ''
      }));
      callServer('saveEvents', events).catch((error) => {
        queueOffline('saveEvents', events);
        console.error(error);
      });
    }
  }

  function updateStayTimer() {
    if (!state.stay) {
      return;
    }
    const seconds = Math.max(0, Math.floor((Date.now() - state.stay.startedAt.getTime()) / 1000));
    els.stayTimer.textContent = formatClock(seconds, false);
  }

  function toggleStayActivity(activity, button) {
    if (!state.stay) {
      return;
    }
    button.classList.add('selected');
    state.stay.activities.push({
      activity,
      timestamp: new Date().toISOString()
    });
  }

  function markFollowPause() {
    hideLiftPanel();
    state.lastPoint = null;
    queueEvent({ actividad: 'PAUSA_SEGUIMIENTO', observacion: getFloorLabel(state.selectedFloor) });
    flushEvents();
  }

  function markManualPause() {
    if (!state.current) {
      return;
    }
    queueEvent({ actividad: 'PAUSA', observacion: getFloorLabel(state.selectedFloor) });
    flushEvents();
  }

  function saveManualEvent() {
    if (!state.current) {
      return;
    }
    queueEvent({
      actividad: els.manualEventSelect.value,
      observacion: els.manualEventObservation.value
    });
    els.manualEventObservation.value = '';
    closeDialog(els.eventDialog);
    flushEvents();
  }

  function queueEvent(event) {
    if (!state.current) {
      return;
    }
    state.pendingEvents.push({
      evento_id: cryptoRandomId(),
      persona_id: state.current.persona_id,
      permanencia_id: event.permanencia_id || '',
      timestamp: event.timestamp || new Date().toISOString(),
      actividad: event.actividad,
      local_codigo: event.local_codigo || '',
      local_nombre: event.local_nombre || '',
      observacion: event.observacion || ''
    });
  }

  function finishTracking() {
    if (!state.current) {
      return;
    }
    const ok = confirm(`Finalizar recorrido de ${state.current.persona_id}?`);
    if (!ok) {
      return;
    }
    if (state.stay) {
      finishStay();
    }
    stopDrawing();
    hideLiftPanel();
    const duration = Math.max(0, Math.round((Date.now() - state.startedAt.getTime()) / 1000));
    flushAll()
      .then(() => callServer('finalizePerson', {
        persona_id: state.current.persona_id,
        duracion_total: duration,
        pisos_visitados: Array.from(state.visitedFloors),
        numero_permanencias: state.staysCount,
        tiempo_total_permanencia: state.staySecondsTotal
      }))
      .then(() => {
        clearInterval(state.timerId);
        alert(`${state.current.persona_id} finalizado.`);
        window.location.reload();
      })
      .catch((error) => {
        console.error(error);
        alert('No se pudo finalizar en Sheets. Los datos pendientes quedaron en este dispositivo.');
      });
  }

  function flushAll() {
    return Promise.all([flushRoutePoints(), flushEvents(), flushOfflineQueue()]);
  }

  function flushRoutePoints() {
    if (!state.pendingPoints.length) {
      return Promise.resolve({ saved: 0 });
    }
    const batch = state.pendingPoints.splice(0, state.pendingPoints.length);
    const chunks = chunkArray(batch, 8);
    return chunks.reduce((chain, chunk) => (
      chain.then(() => callServer('saveRoutePoints', chunk))
    ), Promise.resolve()).catch((error) => {
      queueOffline('saveRoutePoints', batch);
      console.error(error);
    });
  }

  function flushEvents() {
    if (!state.pendingEvents.length) {
      return Promise.resolve({ saved: 0 });
    }
    const batch = state.pendingEvents.splice(0, state.pendingEvents.length);
    return callServer('saveEvents', batch).catch((error) => {
      queueOffline('saveEvents', batch);
      console.error(error);
    });
  }

  function queueOffline(method, payload) {
    const key = offlineKey();
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    items.push({ method, payload, queuedAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(items));
  }

  function flushOfflineQueue() {
    const key = offlineKey();
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    if (!items.length) {
      return Promise.resolve();
    }
    return items.reduce((chain, item) => (
      chain.then(() => callServer(item.method, item.payload))
    ), Promise.resolve()).then(() => {
      localStorage.removeItem(key);
    }).catch((error) => {
      console.error(error);
    });
  }

  function offlineKey() {
    return 'zonarMallOfflineQueue';
  }

  function callServer(method, payload) {
    return window.ZonarAPI.call(method, payload);
  }

  function screenToMapCoordinates(clientX, clientY) {
    const rect = getRenderedMapRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      return null;
    }
    return normalizeCoordinates(x, y);
  }

  function mapToScreenCoordinates(x, y) {
    const rect = getRenderedMapRect();
    if (!rect) {
      return null;
    }
    const viewportRect = els.mapViewport.getBoundingClientRect();
    return {
      x: rect.left - viewportRect.left + (x * rect.width),
      y: rect.top - viewportRect.top + (y * rect.height)
    };
  }

  function normalizeCoordinates(x, y) {
    return {
      x: Math.min(1, Math.max(0, Number(x))),
      y: Math.min(1, Math.max(0, Number(y)))
    };
  }

  function denormalizeCoordinates(x, y) {
    return mapToScreenCoordinates(x, y);
  }

  function getRenderedMapRect() {
    const imageRect = els.mapImage.getBoundingClientRect();
    const naturalWidth = els.mapImage.naturalWidth || 0;
    const naturalHeight = els.mapImage.naturalHeight || 0;
    if (!naturalWidth || !naturalHeight) {
      return imageRect;
    }
    const imageRatio = naturalWidth / naturalHeight;
    const boxRatio = imageRect.width / imageRect.height;
    let width = imageRect.width;
    let height = imageRect.height;
    let left = imageRect.left;
    let top = imageRect.top;
    if (boxRatio > imageRatio) {
      width = imageRect.height * imageRatio;
      left = imageRect.left + (imageRect.width - width) / 2;
    } else {
      height = imageRect.width / imageRatio;
      top = imageRect.top + (imageRect.height - height) / 2;
    }
    return { left, top, width, height };
  }

  function detectLocation(point) {
    const floorZones = state.zones.filter((zone) => zone.piso === state.selectedFloor || zone.piso === getFloorLabel(state.selectedFloor));
    const polygonHit = floorZones.find((zone) => zone.polygon && pointInPolygon(point, zone.polygon));
    if (polygonHit) {
      return polygonHit;
    }
    const maxDistance = getNumberConfig('NEARBY_LOCATION_DISTANCE', 0.035);
    let nearest = null;
    floorZones.forEach((zone) => {
      if (!zone.polygon || !zone.polygon.length) {
        return;
      }
      const center = centroid(zone.polygon);
      const distance = Math.hypot(point.x - center.x, point.y - center.y);
      if (distance <= maxDistance && (!nearest || distance < nearest.distance)) {
        nearest = { zone, distance };
      }
    });
    return nearest ? nearest.zone : null;
  }

  function normalizeZones(rows) {
    return rows.map((row) => {
      let polygon = [];
      try {
        polygon = row.polygon_json ? JSON.parse(row.polygon_json) : [];
      } catch (error) {
        polygon = [];
      }
      return {
        zona_id: row.zona_id,
        codigo: row.codigo,
        nombre: row.nombre,
        tipo: row.tipo,
        piso: row.piso,
        polygon
      };
    });
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = Number(polygon[i].x);
      const yi = Number(polygon[i].y);
      const xj = Number(polygon[j].x);
      const yj = Number(polygon[j].y);
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.000001) + xi);
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  function centroid(polygon) {
    const total = polygon.reduce((sum, point) => ({
      x: sum.x + Number(point.x || 0),
      y: sum.y + Number(point.y || 0)
    }), { x: 0, y: 0 });
    return {
      x: total.x / polygon.length,
      y: total.y / polygon.length
    };
  }

  function positionStayMarker() {
    if (!state.stay) {
      return;
    }
    const screen = mapToScreenCoordinates(state.stay.point.x, state.stay.point.y);
    if (!screen) {
      return;
    }
    els.stayMarker.style.left = `${screen.x}px`;
    els.stayMarker.style.top = `${screen.y}px`;
  }

  function setZoom(nextZoom) {
    if (state.isDrawing) {
      return;
    }
    state.zoom = Math.min(3, Math.max(1, Number(nextZoom)));
    els.mapImage.style.transform = `scale(${state.zoom})`;
    els.drawCanvas.style.transform = `scale(${state.zoom})`;
    replayFloor();
    positionStayMarker();
  }

  function resetZoom() {
    state.zoom = 1;
    els.mapImage.style.transform = 'scale(1)';
    els.drawCanvas.style.transform = 'scale(1)';
  }

  function startMainTimer() {
    clearInterval(state.timerId);
    const tick = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - state.startedAt.getTime()) / 1000));
      els.mainTimer.textContent = formatClock(seconds, true);
    };
    tick();
    state.timerId = setInterval(tick, 500);
  }

  function formatClock(totalSeconds, includeHours) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (!includeHours) {
      return `${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function classifyStay(seconds) {
    if (seconds < 3) return 'NO_CUENTA';
    if (seconds <= 5) return 'ATENCION_BREVE';
    if (seconds <= 15) return 'INTERES';
    if (seconds <= 30) return 'INTERES_ALTO';
    if (seconds <= 60) return 'PERMANENCIA_FUERTE';
    return 'PERMANENCIA_MUY_ALTA';
  }

  function getNumberConfig(key, fallback) {
    const value = Number(state.config[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  function getMap(floorId) {
    return state.maps.find((map) => map.id === floorId);
  }

  function getFloorLabel(floorId) {
    const map = getMap(floorId);
    return map ? map.label : floorId;
  }

  function showLiftPanel() {
    els.liftPanel.classList.remove('hidden');
  }

  function hideLiftPanel() {
    els.liftPanel.classList.add('hidden');
  }

  function hideStayPanel() {
    els.stayPanel.classList.add('hidden');
    els.activityButtons.querySelectorAll('button').forEach((button) => button.classList.remove('selected'));
  }

  function showMapMessage(message) {
    els.mapMessage.textContent = message;
    els.mapMessage.classList.remove('hidden');
  }

  function hideMapMessage() {
    els.mapMessage.classList.add('hidden');
  }

  function openDialog(dialog) {
    if (!dialog || dialog.open) {
      return;
    }
    try {
      dialog.showModal();
    } catch (error) {
      console.error(error);
    }
  }

  function closeDialog(dialog) {
    if (!dialog || !dialog.open) {
      return;
    }
    try {
      dialog.close();
    } catch (error) {
      console.error(error);
    }
  }

  function cryptoRandomId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function chunkArray(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }
