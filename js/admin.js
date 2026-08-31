(function () {
  const ADMIN_AUTH = {
    sessionKey: 'zonarMallAdminSession',
    maxAgeMs: 8 * 60 * 60 * 1000,
    usernameHash: 'daff9c7f4b63b9fd17e84f3c8ac13fe5f2104e4829fb8ed103b8c46e75d738f3',
    credentialHash: '55f071bc1a69f9cc3714e2a49fe5283a429a6be4e47f2be4031a1cfb9017610a'
  };

  const state = {
    data: null,
    selectedFloorId: null,
    authenticated: false,
    localDirectory: [],
    localStatsIndex: {},
    localFilters: {
      search: '',
      floor: '',
      category: ''
    }
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', boot);

  function boot() {
    [
      'statusBanner',
      'visitorsMetric',
      'staysMetric',
      'timeMetric',
      'interactionsMetric',
      'floorTabs',
      'selectedFloorTitle',
      'adminMapImage',
      'heatmapCanvas',
      'poiLabels',
      'activityLegend',
      'poiList',
      'floorBars',
      'activityBars',
      'conclusionList',
      'floorReports',
      'refreshBtn',
      'printBtn',
      'logoutBtn',
      'reportSubtitle',
      'loginView',
      'adminShell',
      'loginForm',
      'adminUserInput',
      'adminPassInput',
      'loginError',
      'loginSubmitBtn',
      'newLocalBtn',
      'localAdminSearch',
      'localFloorFilter',
      'localCategoryFilter',
      'localEditorForm',
      'localCodeInput',
      'localNameInput',
      'localFloorInput',
      'localCategoryInput',
      'localTypeInput',
      'localActiveInput',
      'saveLocalBtn',
      'clearLocalFormBtn',
      'localDirectoryStatus',
      'localDirectoryList'
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });

    els.loginForm.addEventListener('submit', handleLogin);
    els.logoutBtn.addEventListener('click', () => showLogin(true));
    els.refreshBtn.addEventListener('click', loadDashboard);
    els.printBtn.addEventListener('click', printReport);
    els.adminMapImage.addEventListener('load', renderHeatmap);
    els.newLocalBtn.addEventListener('click', clearLocalForm);
    els.clearLocalFormBtn.addEventListener('click', clearLocalForm);
    els.localEditorForm.addEventListener('submit', saveLocalEntry);
    els.localAdminSearch.addEventListener('input', () => {
      state.localFilters.search = els.localAdminSearch.value;
      renderLocalDirectory();
    });
    els.localFloorFilter.addEventListener('change', () => {
      state.localFilters.floor = els.localFloorFilter.value;
      renderLocalDirectory();
    });
    els.localCategoryFilter.addEventListener('change', () => {
      state.localFilters.category = els.localCategoryFilter.value;
      renderLocalDirectory();
    });
    window.addEventListener('resize', renderHeatmap);
    window.addEventListener('beforeprint', preparePrintReport);
    renderLocalEditorOptions();
    if (hasValidAdminSession()) {
      unlockAdmin();
    } else {
      showLogin(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError('');
    els.loginSubmitBtn.disabled = true;
    els.loginSubmitBtn.textContent = 'Verificando...';

    try {
      const username = normalizeAdminUser(els.adminUserInput.value);
      const password = String(els.adminPassInput.value || '');
      const userHash = await digestText(username);
      const credentialHash = await digestText(`${username}:${password}`);
      if (userHash !== ADMIN_AUTH.usernameHash || credentialHash !== ADMIN_AUTH.credentialHash) {
        throw new Error('Credenciales invalidas');
      }
      sessionStorage.setItem(ADMIN_AUTH.sessionKey, JSON.stringify({
        userHash,
        signedInAt: Date.now()
      }));
      els.adminPassInput.value = '';
      unlockAdmin();
    } catch (error) {
      if (!error || error.message !== 'Credenciales invalidas') {
        console.error(error);
      }
      setLoginError('Usuario o clave incorrectos.');
      els.adminPassInput.select();
    } finally {
      els.loginSubmitBtn.disabled = false;
      els.loginSubmitBtn.textContent = 'Entrar al panel';
    }
  }

  function hasValidAdminSession() {
    try {
      const raw = sessionStorage.getItem(ADMIN_AUTH.sessionKey);
      if (!raw) {
        return false;
      }
      const session = JSON.parse(raw);
      const age = Date.now() - Number(session.signedInAt || 0);
      return session.userHash === ADMIN_AUTH.usernameHash && age >= 0 && age <= ADMIN_AUTH.maxAgeMs;
    } catch (error) {
      return false;
    }
  }

  function unlockAdmin() {
    state.authenticated = true;
    els.loginView.classList.add('hidden');
    els.adminShell.classList.remove('hidden');
    els.adminShell.removeAttribute('aria-hidden');
    loadDashboard();
    loadLocalDirectory();
  }

  function showLogin(clearSession) {
    if (clearSession) {
      sessionStorage.removeItem(ADMIN_AUTH.sessionKey);
    }
    state.authenticated = false;
    state.data = null;
    state.selectedFloorId = null;
    els.adminShell.classList.add('hidden');
    els.adminShell.setAttribute('aria-hidden', 'true');
    els.loginView.classList.remove('hidden');
    setLoginError('');
    window.requestAnimationFrame(() => els.adminUserInput.focus());
  }

  function normalizeAdminUser(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  async function digestText(value) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Este navegador no puede validar el acceso administrador.');
    }
    const encoded = new TextEncoder().encode(value);
    const buffer = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function setLoginError(message) {
    els.loginError.textContent = message;
  }

  function printReport() {
    preparePrintReport();
    window.requestAnimationFrame(() => window.print());
  }

  function preparePrintReport() {
    state.localFilters.search = '';
    state.localFilters.floor = '';
    state.localFilters.category = '';
    els.localAdminSearch.value = '';
    els.localFloorFilter.value = '';
    els.localCategoryFilter.value = '';
    renderLocalDirectory();
    renderHeatmap();
  }

  function loadLocalDirectory() {
    setDirectoryStatus('Cargando directorio de locales...');
    window.ZonarAPI.call('getLocalDirectory', {})
      .then((rows) => {
        state.localDirectory = mergeLocalDirectory(rows || [], localDefaults());
        renderLocalDirectory();
        clearLocalForm();
        setDirectoryStatus(`${state.localDirectory.length} registros listos para editar.`);
      })
      .catch((error) => {
        console.error(error);
        state.localDirectory = mergeLocalDirectory([], localDefaults());
        renderLocalDirectory();
        clearLocalForm();
        setDirectoryStatus('Mostrando el directorio base. Actualiza Apps Script para guardar cambios en Google Sheets.', true);
      });
  }

  function renderLocalEditorOptions() {
    const floors = window.ZonarConfig.maps || [];
    const options = floors.map((floor) => `<option value="${escapeHtml(floor.id)}">${escapeHtml(floor.label)}</option>`).join('');
    els.localFloorInput.innerHTML = options;
    els.localFloorFilter.innerHTML = `<option value="">Todos los pisos</option>${options}`;
    els.localCategoryFilter.innerHTML = '<option value="">Todas las categorias</option>';
  }

  function renderLocalFilterOptions() {
    const currentFloor = els.localFloorFilter.value;
    const currentCategory = els.localCategoryFilter.value;
    const floors = window.ZonarConfig.maps || [];
    els.localFloorFilter.innerHTML = '<option value="">Todos los pisos</option>';
    floors.forEach((floor) => {
      const option = document.createElement('option');
      option.value = floor.id;
      option.textContent = floor.label;
      els.localFloorFilter.append(option);
    });
    els.localFloorFilter.value = currentFloor;

    const categories = uniqueValues(state.localDirectory.map((local) => local.categoria).filter(Boolean));
    els.localCategoryFilter.innerHTML = '<option value="">Todas las categorias</option>';
    categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      els.localCategoryFilter.append(option);
    });
    els.localCategoryFilter.value = currentCategory;
  }

  function renderLocalDirectory() {
    renderLocalFilterOptions();
    els.localDirectoryList.innerHTML = '';
    const rows = filteredLocalDirectory();
    if (!rows.length) {
      els.localDirectoryList.innerHTML = '<div class="empty-state">No hay locales con esos filtros.</div>';
      return;
    }
    rows.forEach((local) => {
      const stats = localStatsFor(local);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'directory-item';
      button.classList.toggle('has-data', stats.stays > 0);
      button.classList.toggle('inactive', String(local.activo || 'SI').toUpperCase() === 'NO');
      button.style.setProperty('--directory-color', localTypeColor(local.tipo));
      button.title = `Editar ${local.nombre || local.codigo}`;

      const code = document.createElement('b');
      code.className = 'directory-code';
      code.textContent = local.codigo || 'S/C';

      const text = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = local.nombre || 'Sin nombre';
      const meta = document.createElement('span');
      meta.textContent = `${floorLabel(local.piso)} · ${local.categoria || localTypeLabel(local.tipo)} · ${localTypeLabel(local.tipo)}`;
      const statGrid = document.createElement('div');
      statGrid.className = 'directory-stats';
      statGrid.innerHTML = `
        <b><em>${numberLabel(stats.stays)}</em><small>Permanencias</small></b>
        <b><em>${numberLabel(stats.visitors)}</em><small>Visitantes</small></b>
        <b><em>${percentLabel(stats.percentage)}</em><small>Del total</small></b>
      `;
      const activity = document.createElement('p');
      activity.className = 'directory-activity';
      activity.textContent = stats.stays
        ? `Actividad: ${stats.activities.length ? stats.activities.map((item) => `${activityLabel(item.name)} ${item.count}`).join(' · ') : 'Sin actividad marcada'}`
        : 'Sin permanencias registradas';
      const people = document.createElement('p');
      people.className = 'directory-people';
      people.textContent = stats.people.length
        ? `Estuvieron: ${stats.people.map((item) => item.label).join(', ')}${stats.extraPeople ? ` y ${stats.extraPeople} mas` : ''}`
        : 'Sin visitantes asociados todavia';
      text.append(name, meta, statGrid, activity, people);

      button.append(code, text);
      button.addEventListener('click', () => fillLocalForm(local));
      els.localDirectoryList.append(button);
    });
  }

  function filteredLocalDirectory() {
    const term = normalizeText(state.localFilters.search);
    return state.localDirectory
      .filter((local) => !state.localFilters.floor || local.piso === state.localFilters.floor)
      .filter((local) => !state.localFilters.category || local.categoria === state.localFilters.category)
      .filter((local) => {
        if (!term) {
          return true;
        }
        return normalizeText(`${local.codigo} ${local.nombre} ${local.categoria} ${local.tipo} ${floorLabel(local.piso)}`).includes(term);
      })
      .sort(compareLocals);
  }

  function fillLocalForm(local) {
    els.localCodeInput.value = local.codigo || '';
    els.localNameInput.value = local.nombre || '';
    els.localFloorInput.value = local.piso || ((window.ZonarConfig.maps || [])[0] || {}).id || '';
    els.localCategoryInput.value = local.categoria || '';
    els.localTypeInput.value = local.tipo || 'LOCAL';
    els.localActiveInput.value = String(local.activo || 'SI').toUpperCase() === 'NO' ? 'NO' : 'SI';
    setDirectoryStatus(`Editando ${local.nombre || local.codigo}. Cambia el nombre y guarda.`);
  }

  function clearLocalForm() {
    els.localEditorForm.reset();
    els.localTypeInput.value = 'LOCAL';
    els.localActiveInput.value = 'SI';
    els.localFloorInput.value = state.localFilters.floor || ((window.ZonarConfig.maps || [])[0] || {}).id || '';
    setDirectoryStatus('Puedes editar un registro de la lista o crear uno nuevo.');
  }

  function saveLocalEntry(event) {
    event.preventDefault();
    const payload = {
      codigo: String(els.localCodeInput.value || '').trim().toUpperCase(),
      nombre: String(els.localNameInput.value || '').trim(),
      categoria: String(els.localCategoryInput.value || '').trim(),
      piso: els.localFloorInput.value,
      tipo: els.localTypeInput.value,
      activo: els.localActiveInput.value
    };
    if (!payload.codigo || !payload.nombre || !payload.piso) {
      setDirectoryStatus('Codigo, nombre y piso son obligatorios.', true);
      return;
    }
    els.saveLocalBtn.disabled = true;
    els.saveLocalBtn.textContent = 'Guardando...';
    window.ZonarAPI.call('saveLocal', payload)
      .then((saved) => {
        upsertLocal(saved || payload, 'SHEETS');
        renderLocalDirectory();
        fillLocalForm(saved || payload);
        setDirectoryStatus(`${payload.codigo} guardado. El cambio queda disponible para nuevas capturas.`);
      })
      .catch((error) => {
        console.error(error);
        setDirectoryStatus('No se pudo guardar. Actualiza Apps Script con el Code.gs nuevo y revisa permisos.', true);
      })
      .finally(() => {
        els.saveLocalBtn.disabled = false;
        els.saveLocalBtn.textContent = 'Guardar local';
      });
  }

  function mergeLocalDirectory(rows, defaults) {
    const index = new Map();
    (defaults || []).forEach((row) => {
      const local = normalizeLocal(row, 'BASE');
      if (local) {
        index.set(localKey(local), local);
      }
    });
    (rows || []).forEach((row) => {
      const local = normalizeLocal(row, 'SHEETS');
      if (local) {
        index.set(localKey(local), local);
      }
    });
    return Array.from(index.values()).sort(compareLocals);
  }

  function upsertLocal(row, source) {
    const local = normalizeLocal(row, source || 'SHEETS');
    if (!local) {
      return;
    }
    const key = localKey(local);
    const next = state.localDirectory.filter((item) => localKey(item) !== key);
    next.push(local);
    state.localDirectory = next.sort(compareLocals);
  }

  function normalizeLocal(row, source) {
    const codigo = String(row.codigo || '').trim().toUpperCase();
    const nombre = String(row.nombre || '').trim();
    const piso = String(row.piso || '').trim();
    if (!codigo || !piso) {
      return null;
    }
    return {
      codigo,
      nombre: nombre || codigo,
      categoria: String(row.categoria || '').trim(),
      piso,
      tipo: String(row.tipo || 'LOCAL').trim().toUpperCase(),
      activo: String(row.activo || 'SI').trim().toUpperCase() === 'NO' ? 'NO' : 'SI',
      source
    };
  }

  function localDefaults() {
    return window.ZonarDirectoryDefaults || window.ZonarConfig.knownLocations || [];
  }

  function localKey(local) {
    return `${String(local.piso || '').toUpperCase()}|${String(local.codigo || '').toUpperCase()}`;
  }

  function compareLocals(a, b) {
    const floorDiff = floorSortWeight(a.piso) - floorSortWeight(b.piso);
    if (floorDiff !== 0) {
      return floorDiff;
    }
    const typeDiff = localTypeWeight(a.tipo) - localTypeWeight(b.tipo);
    if (typeDiff !== 0) {
      return typeDiff;
    }
    return String(a.codigo || a.nombre).localeCompare(String(b.codigo || b.nombre), 'es', { numeric: true });
  }

  function floorSortWeight(floorId) {
    const index = (window.ZonarConfig.maps || []).findIndex((floor) => floor.id === floorId);
    return index === -1 ? 999 : index;
  }

  function localTypeWeight(type) {
    const normalized = String(type || '').toUpperCase();
    if (normalized === 'ZONA') return 0;
    if (normalized === 'LOCAL') return 1;
    if (normalized === 'ISLA') return 2;
    if (normalized === 'PARQUEADERO') return 3;
    return 4;
  }

  function floorLabel(floorId) {
    const floor = (window.ZonarConfig.maps || []).find((item) => item.id === floorId);
    return floor ? floor.label : floorId || 'Sin piso';
  }

  function localTypeLabel(type) {
    const normalized = String(type || '').toUpperCase();
    if (normalized === 'ISLA') return 'Isla';
    if (normalized === 'ZONA') return 'Zona';
    if (normalized === 'PARQUEADERO') return 'Parqueadero';
    return 'Local';
  }

  function localTypeColor(type) {
    const normalized = String(type || '').toUpperCase();
    if (normalized === 'ISLA') return '#b64135';
    if (normalized === 'ZONA') return '#12664a';
    if (normalized === 'PARQUEADERO') return '#1769aa';
    return '#b8831f';
  }

  function uniqueValues(values) {
    return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'es'));
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function setDirectoryStatus(message, isError) {
    els.localDirectoryStatus.textContent = message || '';
    els.localDirectoryStatus.classList.toggle('error', Boolean(isError));
  }

  function buildLocalStatsIndex(data) {
    const index = {};
    const totals = (data && data.totals) || {};
    const totalStays = Number(totals.stays || 0);
    ((data && data.floors) || []).forEach((floor) => {
      (floor.heatPoints || []).forEach((point) => {
        const code = String(point.local_codigo || '').trim().toUpperCase();
        const name = String(point.local_nombre || '').trim();
        if (!code && !name) {
          return;
        }
        const key = localStatsKey(floor.id, code || normalizeText(name));
        if (!index[key]) {
          index[key] = {
            piso: floor.id,
            codigo: code,
            nombre: name,
            stays: 0,
            totalSeconds: 0,
            people: {},
            activityCounts: {},
            totalStays
          };
        }
        const stat = index[key];
        stat.stays += 1;
        stat.totalSeconds += Number(point.seconds || point.weight || 0);
        const personLabel = formatPersonLabel(point);
        if (personLabel) {
          if (!stat.people[personLabel]) {
            stat.people[personLabel] = { label: personLabel, stays: 0, seconds: 0 };
          }
          stat.people[personLabel].stays += 1;
          stat.people[personLabel].seconds += Number(point.seconds || 0);
        }
        const activities = point.activities && point.activities.length
          ? point.activities
          : (point.topActivity ? [{ name: point.topActivity, count: 1 }] : []);
        activities.forEach((activity) => {
          const name = activity.name || 'SIN_ACTIVIDAD';
          stat.activityCounts[name] = (stat.activityCounts[name] || 0) + Number(activity.count || 1);
        });
        if (name) {
          index[localStatsKey(floor.id, normalizeText(name))] = stat;
        }
      });
    });
    return index;
  }

  function localStatsFor(local) {
    const codeKey = localStatsKey(local.piso, local.codigo);
    const nameKey = localStatsKey(local.piso, normalizeText(local.nombre));
    const raw = state.localStatsIndex[codeKey] || state.localStatsIndex[nameKey] || null;
    const totalStays = Number(((state.data || {}).totals || {}).stays || 0);
    if (!raw) {
      return {
        stays: 0,
        visitors: 0,
        percentage: 0,
        totalSeconds: 0,
        people: [],
        extraPeople: 0,
        activities: []
      };
    }
    const people = Object.keys(raw.people)
      .map((key) => raw.people[key])
      .sort((a, b) => b.stays - a.stays || b.seconds - a.seconds);
    return {
      stays: raw.stays,
      visitors: people.length,
      percentage: totalStays ? (raw.stays / totalStays) * 100 : 0,
      totalSeconds: raw.totalSeconds,
      people: people.slice(0, 4),
      extraPeople: Math.max(0, people.length - 4),
      activities: activityBreakdown(raw.activityCounts).slice(0, 3)
    };
  }

  function localStatsKey(floorId, value) {
    return `${String(floorId || '').toUpperCase()}|${String(value || '').toUpperCase()}`;
  }

  function formatPersonLabel(point) {
    const person = String(point.persona_id || '').trim();
    if (!person) {
      return '';
    }
    const surveyor = String(point.encuestador || '').trim();
    return surveyor ? `${person}/${surveyor}` : person;
  }

  function activityBreakdown(counts) {
    return Object.keys(counts || {})
      .map((name) => ({ name, count: counts[name] }))
      .sort((a, b) => b.count - a.count || activityLabel(a.name).localeCompare(activityLabel(b.name), 'es'));
  }

  function percentLabel(value) {
    const number = Number(value || 0);
    if (number <= 0) {
      return '0%';
    }
    if (number < 1) {
      return `${number.toFixed(1)}%`;
    }
    return `${Math.round(number)}%`;
  }

  function loadDashboard() {
    if (!state.authenticated) {
      return;
    }
    setStatus('Cargando resultados...');
    window.ZonarAPI.call('getDashboardData', {})
      .then((data) => {
        state.data = data;
        state.localStatsIndex = buildLocalStatsIndex(data);
        state.selectedFloorId = state.selectedFloorId || firstFloorWithData(data).id;
        renderDashboard();
        renderLocalDirectory();
        setStatus(`Actualizado ${formatDateTime(data.generatedAt)}.`);
      })
      .catch((error) => {
        console.error(error);
        setStatus('No se pudo cargar el panel. Revisa permisos del Apps Script y la conexion con Google Sheets.', true);
      });
  }

  function renderDashboard() {
    const data = state.data;
    if (!data) {
      return;
    }
    const totals = data.totals || {};
    els.reportSubtitle.textContent = `Resultados de permanencia por planta y parqueaderos · ${formatDateTime(data.generatedAt)}`;
    els.visitorsMetric.textContent = numberLabel(totals.visitors || totals.trackedVisitors || 0);
    els.staysMetric.textContent = numberLabel(totals.stays || 0);
    els.timeMetric.textContent = durationLabel(totals.totalSeconds || 0);
    els.interactionsMetric.textContent = numberLabel(totals.interactions || 0);

    renderFloorTabs(data.floors || []);
    renderSelectedFloor();
    renderFloorBars(data.floors || []);
    renderConclusions(data.conclusions || []);
    renderFloorReports(data.floors || []);
  }

  function renderFloorTabs(floors) {
    els.floorTabs.innerHTML = '';
    floors.forEach((floor) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = floor.label;
      button.classList.toggle('active', floor.id === state.selectedFloorId);
      button.addEventListener('click', () => {
        state.selectedFloorId = floor.id;
        renderDashboard();
      });
      els.floorTabs.append(button);
    });
  }

  function renderSelectedFloor() {
    const floor = selectedFloor();
    if (!floor) {
      return;
    }
    els.selectedFloorTitle.textContent = floor.label;
    const map = (window.ZonarConfig.maps || []).find((item) => item.id === floor.id);
    if (map && !els.adminMapImage.src.endsWith(map.src)) {
      els.adminMapImage.src = map.src;
    } else {
      renderHeatmap();
    }
    renderPoiList(floor.pointsOfInterest || []);
    renderActivityBars(floor.activities || []);
    renderActivityLegend(floor);
  }

  function renderHeatmap() {
    const floor = selectedFloor();
    if (!floor) {
      return;
    }
    const canvas = els.heatmapCanvas;
    const frame = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const frameRect = frame.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(frameRect.width * dpr));
    canvas.height = Math.max(1, Math.floor(frameRect.height * dpr));
    canvas.style.width = `${frameRect.width}px`;
    canvas.style.height = `${frameRect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, frameRect.width, frameRect.height);
    els.poiLabels.innerHTML = '';
    if (!els.adminMapImage.naturalWidth || !els.adminMapImage.naturalHeight) {
      return;
    }
    const rect = renderedImageRect(frame, els.adminMapImage);
    const points = floor.heatPoints || [];
    if (!points.length) {
      drawEmptyMapMessage(ctx, frameRect, 'Sin permanencias registradas en este mapa');
      return;
    }
    const maxWeight = Math.max(...points.map((point) => Number(point.weight || 1)));
    const heatSize = window.matchMedia('(max-width: 820px)').matches
      ? { base: 22, spread: 34 }
      : { base: 34, spread: 58 };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    points.forEach((point) => {
      const x = rect.left + (Number(point.x) * rect.width);
      const y = rect.top + (Number(point.y) * rect.height);
      const normalized = Math.max(0.12, Math.min(1, Number(point.weight || 1) / maxWeight));
      const meta = getActivityMeta(point.topActivity || 'OTRO');
      drawHeatPoint(ctx, x, y, heatSize.base + (normalized * heatSize.spread), normalized, meta.color);
    });
    ctx.restore();
    renderPoiLabels(floor.pointsOfInterest || [], rect);
  }

  function drawHeatPoint(ctx, x, y, radius, intensity, color) {
    const rgb = hexToRgb(color);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.58 + intensity * 0.22})`);
    gradient.addColorStop(0.28, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.36 + intensity * 0.18})`);
    gradient.addColorStop(0.58, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.16 + intensity * 0.12})`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function renderPoiLabels(pois, rect) {
    const limit = window.matchMedia('(max-width: 820px)').matches ? 3 : 5;
    pois.slice(0, limit).forEach((poi, index) => {
      const meta = getActivityMeta(poi.topActivity || 'OTRO');
      const label = document.createElement('div');
      label.className = 'poi-label';
      label.style.setProperty('--poi-color', meta.color);
      label.style.left = `${rect.left + (Number(poi.x) * rect.width)}px`;
      label.style.top = `${rect.top + (Number(poi.y) * rect.height)}px`;
      label.title = `${index + 1}. ${poi.label} · ${poi.stays} permanencias · ${activityLabel(poi.topActivity)}`;
      label.innerHTML = `<b>${index + 1}</b><strong>${escapeHtml(shortPoiLabel(poi.label))}</strong><span>${poi.stays} perm.</span>`;
      els.poiLabels.append(label);
    });
  }

  function shortPoiLabel(label) {
    return String(label || '').replace(/^Zona caliente\s*/i, 'Z. ').replace(/^Local\s+/i, '');
  }

  function drawEmptyMapMessage(ctx, frameRect, message) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = 'rgba(24,33,31,0.18)';
    ctx.lineWidth = 1;
    roundRect(ctx, (frameRect.width / 2) - 170, (frameRect.height / 2) - 28, 340, 56, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#66736f';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, frameRect.width / 2, frameRect.height / 2 + 5);
    ctx.restore();
  }

  function renderPoiList(pois) {
    els.poiList.innerHTML = '';
    if (!pois.length) {
      els.poiList.innerHTML = '<li class="empty-state">Sin puntos de interes todavia. Registra permanencias para activar el ranking.</li>';
      return;
    }
    pois.forEach((poi, index) => {
      const meta = getActivityMeta(poi.topActivity || 'OTRO');
      const item = document.createElement('li');
      item.style.setProperty('--poi-color', meta.color);
      item.innerHTML = `
        <strong>${index + 1}. ${escapeHtml(poi.label)}</strong>
        <span>${poi.code ? `${escapeHtml(poi.code)} · ` : ''}<b class="activity-chip" style="--activity-color:${meta.color}">${escapeHtml(activityLabel(poi.topActivity))}</b></span>
        <div class="poi-score">
          <b>${numberLabel(poi.stays)} permanencias</b>
          <b>${numberLabel(poi.visitors)} visitantes</b>
          <b>${durationLabel(poi.totalSeconds)}</b>
        </div>
      `;
      els.poiList.append(item);
    });
  }

  function renderFloorBars(floors) {
    const rows = floors
      .map((floor) => ({
        label: floor.label,
        value: Number(floor.metrics.totalSeconds || 0),
        secondary: floor.metrics.stays || 0,
        color: floorColor(floor.id)
      }));
    renderBars(els.floorBars, rows, (row) => `${durationLabel(row.value)} · ${row.secondary} perm.`);
  }

  function renderActivityBars(activities) {
    renderBars(els.activityBars, activities.map((item) => ({
      label: activityLabel(item.name),
      value: Number(item.count || 0),
      color: getActivityMeta(item.name).color
    })), (row) => `${numberLabel(row.value)}`);
  }

  function renderActivityLegend(floor) {
    const names = new Set();
    (floor.activities || []).forEach((activity) => {
      if (Number(activity.count || 0) > 0) {
        names.add(activity.name);
      }
    });
    (floor.pointsOfInterest || []).forEach((poi) => {
      if (poi.topActivity) {
        names.add(poi.topActivity);
      }
    });
    (floor.heatPoints || []).forEach((point) => {
      if (point.topActivity) {
        names.add(point.topActivity);
      }
    });

    els.activityLegend.innerHTML = '';
    if (!names.size) {
      els.activityLegend.innerHTML = '<span class="legend-note">Sin actividades clasificadas todavia.</span>';
      return;
    }
    Array.from(names).slice(0, 10).forEach((name) => {
      const meta = getActivityMeta(name);
      const item = document.createElement('span');
      item.className = 'activity-legend-item';
      item.style.setProperty('--activity-color', meta.color);
      item.textContent = meta.label;
      els.activityLegend.append(item);
    });
  }

  function renderBars(container, rows, valueLabel) {
    container.innerHTML = '';
    const max = Math.max(1, ...rows.map((row) => row.value));
    if (!rows.some((row) => row.value > 0)) {
      container.innerHTML = '<div class="empty-state">Aun no hay datos para este grafico.</div>';
      return;
    }
    rows.forEach((row) => {
      const item = document.createElement('div');
      item.className = 'bar-row';
      item.style.setProperty('--bar-color', row.color || 'var(--blue)');
      item.innerHTML = `
        <span>${escapeHtml(row.label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, (row.value / max) * 100)}%"></div></div>
        <div class="bar-value">${escapeHtml(valueLabel(row))}</div>
      `;
      container.append(item);
    });
  }

  function renderConclusions(conclusions) {
    els.conclusionList.innerHTML = '';
    conclusions.forEach((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      els.conclusionList.append(item);
    });
  }

  function renderFloorReports(floors) {
    els.floorReports.innerHTML = '';
    floors.forEach((floor) => {
      const top = (floor.pointsOfInterest || [])[0];
      const topActivity = top ? activityLabel(top.topActivity) : '';
      const item = document.createElement('article');
      item.className = 'floor-report';
      item.innerHTML = `
        <header>
          <h3>${escapeHtml(floor.label)}</h3>
          <small>${floor.metrics.stays ? 'Con datos' : 'Sin permanencias'}</small>
        </header>
        <div class="mini-stats">
          <div><span>Visitantes</span><strong>${numberLabel(floor.metrics.visitors)}</strong></div>
          <div><span>Permanencias</span><strong>${numberLabel(floor.metrics.stays)}</strong></div>
          <div><span>Tiempo</span><strong>${durationLabel(floor.metrics.totalSeconds)}</strong></div>
        </div>
        <p>${escapeHtml(floor.conclusion || '')}</p>
        <small>${top ? `Lugar prioritario: ${escapeHtml(top.label)} · ${escapeHtml(topActivity)} · ${durationLabel(top.totalSeconds)}` : 'Sin punto prioritario definido.'}</small>
      `;
      els.floorReports.append(item);
    });
  }

  function selectedFloor() {
    if (!state.data) {
      return null;
    }
    return (state.data.floors || []).find((floor) => floor.id === state.selectedFloorId) || firstFloorWithData(state.data);
  }

  function firstFloorWithData(data) {
    return (data.floors || []).find((floor) => floor.metrics.stays > 0) || (data.floors || [])[0] || { id: '', label: '' };
  }

  function renderedImageRect(frame, image) {
    const frameRect = frame.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const naturalWidth = image.naturalWidth || 1;
    const naturalHeight = image.naturalHeight || 1;
    const imageRatio = naturalWidth / naturalHeight;
    const boxRatio = imageRect.width / imageRect.height;
    let width = imageRect.width;
    let height = imageRect.height;
    let left = imageRect.left - frameRect.left;
    let top = imageRect.top - frameRect.top;
    if (boxRatio > imageRatio) {
      width = imageRect.height * imageRatio;
      left += (imageRect.width - width) / 2;
    } else {
      height = imageRect.width / imageRatio;
      top += (imageRect.height - height) / 2;
    }
    return { left, top, width, height };
  }

  function setStatus(message, isError) {
    els.statusBanner.textContent = message;
    els.statusBanner.classList.toggle('error', Boolean(isError));
  }

  function durationLabel(seconds) {
    const total = Math.max(0, Math.round(Number(seconds || 0)));
    if (total < 60) return `${total} s`;
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    if (minutes < 60) return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const minuteRest = minutes % 60;
    return minuteRest ? `${hours} h ${minuteRest} min` : `${hours} h`;
  }

  function numberLabel(value) {
    return new Intl.NumberFormat('es-EC').format(Number(value || 0));
  }

  function formatDateTime(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('es-EC', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  function floorColor(floorId) {
    const colors = {
      PLANTA_BAJA: '#0f8a5f',
      PISO_1: '#1769aa',
      PISO_2: '#d97706',
      PARQUEADERO_PB: '#7c3aed',
      PARQUEADERO_SUBSUELO: '#dc2626'
    };
    return colors[floorId] || '#475569';
  }

  function activityLabel(activity) {
    if (!activity) {
      return 'Sin actividad';
    }
    return getActivityMeta(activity).label;
  }

  function getActivityMeta(activity) {
    if (window.ZonarActivityMeta) {
      return window.ZonarActivityMeta.get(activity);
    }
    return {
      id: String(activity || 'OTRO'),
      label: String(activity || 'Otro').toLowerCase(),
      color: '#475569'
    };
  }

  function hexToRgb(color) {
    const hex = String(color || '#475569').replace('#', '').trim();
    const full = hex.length === 3
      ? hex.split('').map((part) => part + part).join('')
      : hex;
    const value = parseInt(full, 16);
    if (!Number.isFinite(value)) {
      return { r: 71, g: 85, b: 105 };
    }
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    };
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }
}());
