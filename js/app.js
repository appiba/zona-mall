const ACTIVITY_META = window.ZonarActivityMeta || null;
const ACTIVITIES = ACTIVITY_META ? ACTIVITY_META.list() : [
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
    locationPoints: [],
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
    toastTimerId: null,
    floorSwitcherTimerId: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
    pinch: null,
    mapLoaded: false,
    locationOptions: []
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
        state.locales = [
          ...(app.locales || []),
          ...(window.ZonarConfig.knownLocations || [])
        ];
        state.locationPoints = normalizeLocationPoints(window.ZonarConfig.locationPoints || {});
        state.config = app.config || {};
        document.title = app.appName || 'Zonar Mall';
        els.appName.textContent = app.appName || 'Zonar Mall';
        renderSurveyors(app.encuestadores || []);
        renderFloorButtons();
        renderManualEventOptions();
        renderLocationOptions();
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
      'floorQuickOptions',
      'floorSwitchPanel',
      'quickFloorLabel',
      'personBadge',
      'floorBadge',
      'surveyorBadge',
      'mainTimer',
      'mapViewport',
      'mapImage',
      'drawCanvas',
      'liveLocationBadge',
      'stayMarker',
      'mapMessage',
      'liftPanel',
      'startStayBtn',
      'pauseFollowBtn',
      'stayPanel',
      'stayTimer',
      'detectedLocation',
      'stayLocationInput',
      'locationDatalist',
      'activityButtons',
      'manualPauseBtn',
      'manualEventBtn',
      'changeFloorBtn',
      'finishBtn',
      'eventDialog',
      'manualEventSelect',
      'manualEventObservation',
      'saveManualEventBtn',
      'saveStayBtn',
      'toastMessage',
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
      if (state.lastPoint) {
        updateLiveLocation(state.lastPoint);
      }
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
    els.saveStayBtn.addEventListener('click', () => finishStay({ manual: true }));
    els.changeFloorBtn.addEventListener('click', highlightFloorSwitcher);
    els.finishBtn.addEventListener('click', finishTracking);
    els.zoomInBtn.addEventListener('click', () => setZoom(state.zoom + 0.2));
    els.zoomOutBtn.addEventListener('click', () => setZoom(state.zoom - 0.2));
    els.zoomResetBtn.addEventListener('click', () => setZoom(1));
    els.stayLocationInput.addEventListener('input', updateStayLocationDisplay);
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
    els.floorQuickOptions.innerHTML = '';
    state.maps.forEach((map, index) => {
      const setupButton = buildFloorButton(map, () => {
        state.selectedFloor = map.id;
        updateFloorButtonStates();
      });
      const quickButton = buildFloorButton(map, () => {
        changeFloor(map.id);
      });
      els.initialFloorOptions.append(setupButton);
      els.floorQuickOptions.append(quickButton);
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
      button.setAttribute('aria-pressed', button.dataset.floor === state.selectedFloor ? 'true' : 'false');
    });
    if (els.quickFloorLabel) {
      els.quickFloorLabel.textContent = getFloorLabel(state.selectedFloor);
    }
  }

  function highlightFloorSwitcher() {
    if (!state.current) {
      return;
    }
    window.clearTimeout(state.floorSwitcherTimerId);
    els.floorSwitchPanel.classList.add('attention');
    state.floorSwitcherTimerId = window.setTimeout(() => {
      els.floorSwitchPanel.classList.remove('attention');
    }, 1400);
  }

  function renderManualEventOptions() {
    els.manualEventSelect.innerHTML = '';
    ACTIVITIES.forEach((activity) => {
      const meta = getActivityMeta(activity);
      const option = document.createElement('option');
      option.value = activity;
      option.textContent = meta.label;
      els.manualEventSelect.append(option);
    });
  }

  function renderActivityButtons() {
    els.activityButtons.innerHTML = '';
    ACTIVITIES.forEach((activity) => {
      const meta = getActivityMeta(activity);
      const button = document.createElement('button');
      button.type = 'button';
      button.style.setProperty('--activity-color', meta.color);
      button.title = meta.description;
      button.textContent = meta.label;
      button.addEventListener('click', () => toggleStayActivity(activity, button));
      els.activityButtons.append(button);
    });
  }

  function renderLocationOptions() {
    const entries = [];
    const seen = {};
    const addEntry = (item) => {
      const code = String(item.codigo || '').trim();
      const name = String(item.nombre || '').trim();
      if (!code && !name) {
        return;
      }
      const floor = String(item.piso || '').trim();
      const value = formatLocationValue({ codigo: code, nombre: name || code });
      const key = `${floor}|${code}|${name}`.toUpperCase();
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      entries.push({
        codigo: code,
        nombre: name || code,
        piso: floor,
        tipo: item.tipo || '',
        value
      });
    };

    state.zones.forEach(addEntry);
    state.locales.forEach(addEntry);
    state.locationOptions = entries.sort((a, b) => a.value.localeCompare(b.value, 'es'));
    els.locationDatalist.innerHTML = '';
    state.locationOptions.forEach((entry) => {
      const option = document.createElement('option');
      option.value = entry.value;
      option.label = entry.piso ? `${entry.piso} · ${entry.codigo || entry.nombre}` : entry.codigo || entry.nombre;
      els.locationDatalist.append(option);
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
    hideLiveLocationBadge();
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
    els.floorSwitchPanel.classList.remove('attention');
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
    hideLiveLocationBadge();
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
      hideLiveLocationBadge();
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
    updateLiveLocation(point);
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
    updateLiveLocation(routePoint);
  }

  function drawTemporarySegment(from, to) {
    if (!from || !to) {
      return;
    }
    replayFloor();
    drawSegment(from, to, true);
    updateLiveLocation(to);
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
    hideLiveLocationBadge();
    const location = detectLocation(state.lastPoint);
    state.stay = {
      permanencia_id: cryptoRandomId(),
      point: { x: state.lastPoint.x, y: state.lastPoint.y },
      floor: state.selectedFloor,
      startedAt: new Date(),
      activities: [],
      primaryActivity: '',
      location
    };
    els.stayLocationInput.value = location ? formatLocationValue(location) : '';
    updateStayLocationDisplay();
    els.stayMarker.style.setProperty('--stay-color', getActivityMeta('OTRO').color);
    els.stayTimer.textContent = '00:00';
    updateSaveStayButton(0);
    els.stayPanel.classList.remove('hidden');
    positionStayMarker();
    els.stayMarker.classList.remove('hidden');
    clearInterval(state.stayTimerId);
    state.stayTimerId = setInterval(updateStayTimer, 250);
  }

  function finishStay(options) {
    if (!state.stay) {
      return;
    }
    const settings = options || {};
    const stay = state.stay;
    const endedAt = new Date();
    const duration = Math.max(0, Math.round((endedAt - stay.startedAt) / 1000));
    const minStay = getNumberConfig('MIN_STAY_SECONDS', 3);
    const location = resolveStayLocation(stay);
    if (duration < minStay && settings.manual) {
      updateSaveStayButton(duration);
      showToast(`Espera ${minStay - duration} s mas para guardar esta permanencia.`, true);
      return;
    }
    clearInterval(state.stayTimerId);
    hideStayPanel();
    els.stayMarker.classList.add('hidden');
    state.stay = null;
    if (duration < minStay) {
      return;
    }
    state.staysCount += 1;
    state.staySecondsTotal += duration;
    const permanenciaPayload = {
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
    };
    callServer('savePermanencia', permanenciaPayload).catch((error) => {
      queueOffline('savePermanencia', permanenciaPayload);
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
    if (settings.manual) {
      showToast(`Permanencia guardada: ${duration}s en ${location.nombre || 'zona sin nombre'}.`);
    }
  }

  function updateStayTimer() {
    if (!state.stay) {
      return;
    }
    const seconds = Math.max(0, Math.floor((Date.now() - state.stay.startedAt.getTime()) / 1000));
    els.stayTimer.textContent = formatClock(seconds, false);
    updateSaveStayButton(seconds);
  }

  function updateSaveStayButton(seconds) {
    const minStay = getNumberConfig('MIN_STAY_SECONDS', 3);
    const remaining = Math.max(0, minStay - Number(seconds || 0));
    els.saveStayBtn.disabled = remaining > 0;
    els.saveStayBtn.textContent = remaining > 0
      ? `Guardar en ${remaining} s`
      : 'Guardar permanencia';
  }

  function toggleStayActivity(activity, button) {
    if (!state.stay) {
      return;
    }
    els.activityButtons.querySelectorAll('button').forEach((item) => item.classList.remove('selected'));
    const meta = getActivityMeta(activity);
    button.classList.add('selected');
    state.stay.primaryActivity = activity;
    els.stayMarker.style.setProperty('--stay-color', meta.color);
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

  function normalizedNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return 0;
    }
    return Math.min(1, Math.max(0, number));
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
    const floorZones = state.zones.filter((zone) => matchesFloor(zone.piso, state.selectedFloor));
    const polygonHit = floorZones.find((zone) => zone.polygon && pointInPolygon(point, zone.polygon));
    if (polygonHit) {
      return polygonHit;
    }
    const configuredHit = nearestConfiguredLocation(point);
    if (configuredHit) {
      return configuredHit;
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

  function nearestConfiguredLocation(point) {
    let nearest = null;
    state.locationPoints
      .filter((location) => matchesFloor(location.piso, state.selectedFloor))
      .forEach((location) => {
        const distance = Math.hypot(point.x - location.x, point.y - location.y);
        const radius = Number(location.radius || getNumberConfig('NEARBY_LOCATION_DISTANCE', 0.045));
        if (distance <= radius && (!nearest || distance < nearest.distance)) {
          nearest = { location, distance };
        }
      });
    return nearest ? nearest.location : null;
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

  function normalizeLocationPoints(pointsByFloor) {
    const index = {};
    state.locales.forEach((location) => {
      const key = `${floorLookupKey(location.piso)}|${String(location.codigo || '').toUpperCase()}`;
      if (!index[key]) {
        index[key] = location;
      }
    });

    return Object.keys(pointsByFloor).flatMap((floorId) => (
      (pointsByFloor[floorId] || []).map((point) => {
        const code = String(point.codigo || '').trim();
        const match = index[`${floorLookupKey(floorId)}|${code.toUpperCase()}`] || {};
        return {
          codigo: code,
          nombre: match.nombre || code,
          tipo: match.tipo || 'LOCAL',
          piso: floorId,
          x: normalizedNumber(point.x),
          y: normalizedNumber(point.y),
          radius: Number(point.radius || getNumberConfig('NEARBY_LOCATION_DISTANCE', 0.045))
        };
      })
    ));
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

  function updateLiveLocation(point) {
    if (!point || !state.mapLoaded || state.stay) {
      hideLiveLocationBadge();
      return;
    }
    const location = detectLocation(point);
    const screen = mapToScreenCoordinates(point.x, point.y);
    if (!location || !screen) {
      hideLiveLocationBadge();
      return;
    }
    els.liveLocationBadge.querySelector('strong').textContent = formatLocationValue(location);
    els.liveLocationBadge.style.left = `${screen.x}px`;
    els.liveLocationBadge.style.top = `${screen.y}px`;
    els.liveLocationBadge.classList.remove('hidden');
  }

  function hideLiveLocationBadge() {
    els.liveLocationBadge.classList.add('hidden');
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
    if (state.lastPoint) {
      updateLiveLocation(state.lastPoint);
    }
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

  function normalizeFloorText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }

  function floorLookupKey(value) {
    const normalized = normalizeFloorText(value);
    const map = state.maps.find((item) => (
      normalizeFloorText(item.id) === normalized ||
      normalizeFloorText(item.label) === normalized
    ));
    return map ? normalizeFloorText(map.id) : normalized;
  }

  function matchesFloor(value, floorId) {
    if (!value || !floorId) {
      return false;
    }
    return floorLookupKey(value) === floorLookupKey(floorId);
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
    els.stayLocationInput.value = '';
    els.detectedLocation.textContent = 'Sin local asociado';
    els.saveStayBtn.disabled = true;
    els.saveStayBtn.textContent = 'Guardar permanencia';
  }

  function updateStayLocationDisplay() {
    if (!state.stay) {
      return;
    }
    const location = resolveStayLocation(state.stay);
    els.detectedLocation.textContent = location.nombre || 'Sin local asociado';
  }

  function resolveStayLocation(stay) {
    const typed = String(els.stayLocationInput.value || '').trim();
    const detected = stay.location || {};
    if (!typed) {
      return {
        codigo: detected.codigo || '',
        nombre: detected.nombre || '',
        piso: detected.piso || stay.floor,
        tipo: detected.tipo || ''
      };
    }
    const normalized = typed.toLowerCase();
    const match = (state.locationOptions || []).find((entry) => (
      entry.value.toLowerCase() === normalized &&
      (!entry.piso || matchesFloor(entry.piso, stay.floor))
    )) || (state.locationOptions || []).find((entry) => entry.value.toLowerCase() === normalized);
    if (match) {
      return {
        codigo: match.codigo || detected.codigo || '',
        nombre: match.nombre || typed,
        piso: match.piso || stay.floor,
        tipo: match.tipo || detected.tipo || ''
      };
    }
    return {
      codigo: detected.codigo || '',
      nombre: typed,
      piso: stay.floor,
      tipo: detected.tipo || ''
    };
  }

  function formatLocationValue(location) {
    const code = String(location.codigo || '').trim();
    const name = String(location.nombre || '').trim();
    if (name && code && name.toUpperCase().includes(code.toUpperCase())) {
      return name;
    }
    if (name && code) {
      return `${name} (${code})`;
    }
    return name || code || '';
  }

  function getActivityMeta(activity) {
    if (ACTIVITY_META) {
      return ACTIVITY_META.get(activity);
    }
    return {
      id: String(activity || 'OTRO'),
      label: String(activity || 'Otro').toLowerCase(),
      color: '#475569',
      description: ''
    };
  }

  function showToast(message, isWarning) {
    window.clearTimeout(state.toastTimerId);
    els.toastMessage.textContent = message;
    els.toastMessage.classList.toggle('warning', Boolean(isWarning));
    els.toastMessage.classList.remove('hidden');
    state.toastTimerId = window.setTimeout(() => {
      els.toastMessage.classList.add('hidden');
    }, 2400);
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
