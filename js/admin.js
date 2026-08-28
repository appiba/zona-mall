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
    authenticated: false
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
      'loginSubmitBtn'
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });

    els.loginForm.addEventListener('submit', handleLogin);
    els.logoutBtn.addEventListener('click', () => showLogin(true));
    els.refreshBtn.addEventListener('click', loadDashboard);
    els.printBtn.addEventListener('click', () => window.print());
    els.adminMapImage.addEventListener('load', renderHeatmap);
    window.addEventListener('resize', renderHeatmap);
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

  function loadDashboard() {
    if (!state.authenticated) {
      return;
    }
    setStatus('Cargando resultados...');
    window.ZonarAPI.call('getDashboardData', {})
      .then((data) => {
        state.data = data;
        state.selectedFloorId = state.selectedFloorId || firstFloorWithData(data).id;
        renderDashboard();
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
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    points.forEach((point) => {
      const x = rect.left + (Number(point.x) * rect.width);
      const y = rect.top + (Number(point.y) * rect.height);
      const normalized = Math.max(0.12, Math.min(1, Number(point.weight || 1) / maxWeight));
      const meta = getActivityMeta(point.topActivity || 'OTRO');
      drawHeatPoint(ctx, x, y, 34 + (normalized * 58), normalized, meta.color);
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
    pois.slice(0, 5).forEach((poi, index) => {
      const meta = getActivityMeta(poi.topActivity || 'OTRO');
      const label = document.createElement('div');
      label.className = 'poi-label';
      label.style.setProperty('--poi-color', meta.color);
      label.style.left = `${rect.left + (Number(poi.x) * rect.width)}px`;
      label.style.top = `${rect.top + (Number(poi.y) * rect.height)}px`;
      label.innerHTML = `${index + 1}. ${escapeHtml(poi.label)}<span>${poi.stays} perm. · ${escapeHtml(activityLabel(poi.topActivity))}</span>`;
      els.poiLabels.append(label);
    });
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
