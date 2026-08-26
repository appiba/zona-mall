const APP_NAME = 'Zonar Mall';
const DEFAULT_SPREADSHEET_ID = '1rZH0UIaPJru4E8m5BK_Af3yfbjBi68pL4YklaYsnD98';

const SHEET_DEFINITIONS = {
  CONFIG: ['clave', 'valor', 'descripcion'],
  ENCUESTADORES: ['codigo', 'nombre', 'activo'],
  PERSONAS: [
    'persona_id',
    'encuestador',
    'fecha',
    'hora_inicio',
    'hora_final',
    'edad_rango',
    'genero',
    'procedencia',
    'tipo_visita',
    'punto_inicio',
    'duracion_total',
    'estado'
  ],
  RECORRIDOS: [
    'recorrido_id',
    'persona_id',
    'fecha',
    'hora_inicio',
    'hora_final',
    'duracion_total',
    'piso_inicio',
    'pisos_visitados',
    'numero_permanencias',
    'tiempo_total_permanencia',
    'estado'
  ],
  PUNTOS_RUTA: [
    'persona_id',
    'recorrido_id',
    'piso',
    'x_normalized',
    'y_normalized',
    'timestamp',
    'tipo'
  ],
  PERMANENCIAS: [
    'permanencia_id',
    'persona_id',
    'piso',
    'x',
    'y',
    'local_codigo',
    'local_nombre',
    'hora_inicio',
    'hora_fin',
    'duracion_segundos',
    'clasificacion'
  ],
  EVENTOS: [
    'evento_id',
    'persona_id',
    'permanencia_id',
    'timestamp',
    'actividad',
    'local_codigo',
    'local_nombre',
    'observacion'
  ],
  LOCALES: ['codigo', 'nombre', 'categoria', 'piso', 'tipo', 'activo'],
  ZONAS_MAPA: ['zona_id', 'codigo', 'nombre', 'tipo', 'piso', 'polygon_json', 'activo'],
  SIMBOLOGIA: ['codigo', 'nombre', 'tipo', 'piso', 'x', 'y', 'activo'],
  SESIONES: ['sesion_id', 'persona_id', 'encuestador', 'inicio', 'fin', 'estado']
};

const DEFAULT_CONFIG = [
  ['APP_NAME', APP_NAME, 'Nombre visible de la aplicacion'],
  ['MIN_STAY_SECONDS', '3', 'Segundos minimos para contar una permanencia'],
  ['POINT_CAPTURE_INTERVAL_MS', '180', 'Intervalo minimo entre puntos de ruta'],
  ['MAP_LINE_WIDTH', '4', 'Grosor de la linea sobre el mapa'],
  ['NEARBY_LOCATION_DISTANCE', '0.035', 'Distancia normalizada maxima para asociar una ubicacion cercana'],
  ['AUTO_SAVE_INTERVAL', '5000', 'Intervalo de autoguardado en milisegundos'],
  ['HEAT_WEIGHT_PERSONAS', '45', 'Peso de personas unicas para heatmap'],
  ['HEAT_WEIGHT_SECONDS', '0.8', 'Peso de segundos acumulados para heatmap'],
  ['HEAT_WEIGHT_INTERACTIONS', '12', 'Peso de interacciones para heatmap'],
  ['MAP_PLANTA_BAJA_SRC', 'assets/maps/planta-baja.png', 'Imagen oficial de Planta Baja'],
  ['MAP_PLANTA_BAJA_FILE_ID', '', 'ID de Google Drive para Planta Baja'],
  ['MAP_PLANTA_BAJA_FILE_NAME', 'planta-baja.png', 'Nombre del archivo de Planta Baja en Drive'],
  ['MAP_PISO_1_SRC', 'assets/maps/piso-1.png', 'Imagen oficial de Piso 1'],
  ['MAP_PISO_1_FILE_ID', '', 'ID de Google Drive para Piso 1'],
  ['MAP_PISO_1_FILE_NAME', 'piso-1.png', 'Nombre del archivo de Piso 1 en Drive'],
  ['MAP_PISO_2_SRC', 'assets/maps/piso-2.png', 'Imagen oficial de Piso 2'],
  ['MAP_PISO_2_FILE_ID', '', 'ID de Google Drive para Piso 2'],
  ['MAP_PISO_2_FILE_NAME', 'piso-2.png', 'Nombre del archivo de Piso 2 en Drive'],
  ['MAP_PARQUEADERO_PB_SRC', 'assets/maps/parqueadero-planta-baja.png', 'Imagen oficial de Parqueadero Planta Baja'],
  ['MAP_PARQUEADERO_PB_FILE_ID', '', 'ID de Google Drive para Parqueadero Planta Baja'],
  ['MAP_PARQUEADERO_PB_FILE_NAME', 'parqueadero-planta-baja.png', 'Nombre del archivo de Parqueadero Planta Baja en Drive'],
  ['MAP_PARQUEADERO_SUBSUELO_SRC', 'assets/maps/parqueadero-subsuelo.png', 'Imagen oficial de Parqueadero Subsuelo'],
  ['MAP_PARQUEADERO_SUBSUELO_FILE_ID', '', 'ID de Google Drive para Parqueadero Subsuelo'],
  ['MAP_PARQUEADERO_SUBSUELO_FILE_NAME', 'parqueadero-subsuelo.png', 'Nombre del archivo de Parqueadero Subsuelo en Drive']
];

const DEFAULT_ENCUESTADORES = [
  ['E01', 'Encuestador 01', 'SI'],
  ['E02', 'Encuestador 02', 'SI'],
  ['E03', 'Encuestador 03', 'SI'],
  ['E04', 'Encuestador 04', 'SI'],
  ['E05', 'Encuestador 05', 'SI'],
  ['E06', 'Encuestador 06', 'SI']
];

const PROVIDED_MAP_FILE_NAMES = {
  MAP_PLANTA_BAJA_FILE_NAME: 'ChatGPT Image 26 ago 2026, 12_00_30 p.m. (1).png',
  MAP_PISO_1_FILE_NAME: 'ChatGPT Image 26 ago 2026, 12_00_30 p.m. (2).png',
  MAP_PISO_2_FILE_NAME: 'ChatGPT Image 26 ago 2026, 12_00_32 p.m. (3).png',
  MAP_PARQUEADERO_PB_FILE_NAME: 'ChatGPT Image 26 ago 2026, 12_09_47 p.m. (1).png',
  MAP_PARQUEADERO_SUBSUELO_FILE_NAME: 'ChatGPT Image 26 ago 2026, 12_09_47 p.m. (2).png'
};

function doGet(e) {
  return handleApiRequest_(e);
}

function doPost(e) {
  return handleApiRequest_(e);
}

function handleApiRequest_(e) {
  const params = (e && e.parameter) || {};
  const callback = params.callback || '';
  const action = params.action || params.method || 'health';
  let payload = {};

  try {
    payload = parsePayload_(e);
    const data = dispatchApiAction_(action, payload);
    return buildApiResponse_({ ok: true, data }, callback);
  } catch (error) {
    return buildApiResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error)
    }, callback);
  }
}

function parsePayload_(e) {
  const params = (e && e.parameter) || {};
  if (params.payload) {
    return JSON.parse(params.payload);
  }
  if (e && e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  return {};
}

function dispatchApiAction_(action, payload) {
  const actions = {
    health: () => ({ appName: APP_NAME, status: 'ok' }),
    initApp: () => initApp(),
    createPerson: () => createPerson(payload),
    saveRoutePoints: () => saveRoutePoints(payload),
    savePermanencia: () => savePermanencia(payload),
    saveEvents: () => saveEvents(payload),
    recordFloorChange: () => recordFloorChange(payload),
    finalizePerson: () => finalizePerson(payload),
    getMapData: () => getMapData(payload),
    syncMapFileIdsByName: () => syncMapFileIdsByName(),
    configureProvidedMapFiles: () => configureProvidedMapFiles()
  };

  if (!actions[action]) {
    throw new Error(`Accion API no reconocida: ${action}`);
  }
  return actions[action]();
}

function buildApiResponse_(body, callback) {
  const json = JSON.stringify(body);
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function initApp() {
  ensureDatabase();
  const config = getConfigObject_();
  return {
    appName: config.APP_NAME || APP_NAME,
    config,
    encuestadores: getActiveRows_('ENCUESTADORES').map((row) => ({
      codigo: row.codigo,
      nombre: row.nombre
    })),
    maps: getMapCatalog_(config),
    zonas: getActiveRows_('ZONAS_MAPA'),
    locales: getActiveRows_('LOCALES'),
    simbologia: getActiveRows_('SIMBOLOGIA'),
    nextPersonaId: peekNextPersonaId_()
  };
}

function ensureDatabase() {
  const ss = getSpreadsheet_();
  Object.keys(SHEET_DEFINITIONS).forEach((name) => {
    const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    ensureHeaders_(sheet, SHEET_DEFINITIONS[name]);
  });
  seedConfig_();
  seedEncuestadores_();
}

function createPerson(payload) {
  ensureDatabase();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = getSpreadsheet_();
    const now = new Date();
    const personaId = nextPersonaId_();
    const recorridoId = 'R' + personaId.slice(1);
    const personas = ss.getSheetByName('PERSONAS');
    const recorridos = ss.getSheetByName('RECORRIDOS');
    const sesiones = ss.getSheetByName('SESIONES');
    const row = [
      personaId,
      payload.encuestador,
      formatDate_(now),
      formatTime_(now),
      '',
      payload.edad_rango || '',
      payload.genero || '',
      payload.procedencia || '',
      payload.tipo_visita || '',
      payload.piso_inicio || '',
      '',
      'ACTIVA'
    ];
    personas.appendRow(row);
    recorridos.appendRow([
      recorridoId,
      personaId,
      formatDate_(now),
      formatTime_(now),
      '',
      '',
      payload.piso_inicio || '',
      payload.piso_inicio || '',
      0,
      0,
      'ACTIVO'
    ]);
    sesiones.appendRow([
      Utilities.getUuid(),
      personaId,
      payload.encuestador,
      now.toISOString(),
      '',
      'ACTIVA'
    ]);
    return {
      persona_id: personaId,
      recorrido_id: recorridoId,
      hora_inicio: now.toISOString()
    };
  } finally {
    lock.releaseLock();
  }
}

function saveRoutePoints(points) {
  ensureDatabase();
  if (!Array.isArray(points) || points.length === 0) {
    return { saved: 0 };
  }
  const values = points
    .filter((point) => point && isFinite(point.x_normalized) && isFinite(point.y_normalized))
    .map((point) => [
      point.persona_id,
      point.recorrido_id,
      point.piso,
      Number(point.x_normalized),
      Number(point.y_normalized),
      point.timestamp,
      point.tipo || 'RUTA'
    ]);
  appendValues_('PUNTOS_RUTA', values);
  return { saved: values.length };
}

function savePermanencia(permanencia) {
  ensureDatabase();
  const permanenciaId = permanencia.permanencia_id || Utilities.getUuid();
  appendValues_('PERMANENCIAS', [[
    permanenciaId,
    permanencia.persona_id,
    permanencia.piso,
    Number(permanencia.x),
    Number(permanencia.y),
    permanencia.local_codigo || '',
    permanencia.local_nombre || '',
    permanencia.hora_inicio || '',
    permanencia.hora_fin || '',
    Number(permanencia.duracion_segundos || 0),
    permanencia.clasificacion || classifyStay_(Number(permanencia.duracion_segundos || 0))
  ]]);
  return { permanencia_id: permanenciaId };
}

function saveEvents(events) {
  ensureDatabase();
  if (!Array.isArray(events) || events.length === 0) {
    return { saved: 0 };
  }
  const values = events.map((event) => [
    event.evento_id || Utilities.getUuid(),
    event.persona_id,
    event.permanencia_id || '',
    event.timestamp || new Date().toISOString(),
    event.actividad,
    event.local_codigo || '',
    event.local_nombre || '',
    event.observacion || ''
  ]);
  appendValues_('EVENTOS', values);
  return { saved: values.length };
}

function recordFloorChange(payload) {
  ensureDatabase();
  return saveEvents([{
    persona_id: payload.persona_id,
    timestamp: payload.timestamp || new Date().toISOString(),
    actividad: 'CAMBIO_PISO',
    observacion: `${payload.from || ''} -> ${payload.to || ''}`
  }]);
}

function getMapData(floorId) {
  ensureDatabase();
  const config = getConfigObject_();
  const catalog = getMapCatalog_(config);
  const map = catalog.find((item) => item.id === floorId);
  if (!map) {
    throw new Error(`Mapa no reconocido: ${floorId}`);
  }
  const fileId = map.fileId || findDriveFileIdByName_(map.fileName);
  if (!fileId) {
    throw new Error(`No se encontro la imagen ${map.fileName || map.label} en Google Drive`);
  }
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  return {
    floorId,
    mimeType: blob.getContentType() || 'image/png',
    dataUrl: `data:${blob.getContentType() || 'image/png'};base64,${Utilities.base64Encode(blob.getBytes())}`
  };
}

function syncMapFileIdsByName() {
  ensureDatabase();
  const config = getConfigObject_();
  const maps = getMapCatalog_(config);
  maps.forEach((map) => {
    if (!map.fileName) return;
    const fileId = findDriveFileIdByName_(map.fileName);
    if (fileId) {
      updateConfigValue_(map.fileIdKey, fileId);
    }
  });
  return getMapCatalog_(getConfigObject_()).map((map) => ({
    id: map.id,
    label: map.label,
    fileName: map.fileName,
    hasFileId: Boolean(map.fileId)
  }));
}

function configureProvidedMapFiles() {
  ensureDatabase();
  Object.keys(PROVIDED_MAP_FILE_NAMES).forEach((key) => {
    updateConfigValue_(key, PROVIDED_MAP_FILE_NAMES[key]);
  });
  const result = syncMapFileIdsByName();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function finalizePerson(payload) {
  ensureDatabase();
  const now = new Date();
  updateRowByKey_('PERSONAS', 'persona_id', payload.persona_id, {
    hora_final: formatTime_(now),
    duracion_total: Number(payload.duracion_total || 0),
    estado: 'FINALIZADA'
  });
  updateRowByKey_('RECORRIDOS', 'persona_id', payload.persona_id, {
    hora_final: formatTime_(now),
    duracion_total: Number(payload.duracion_total || 0),
    pisos_visitados: (payload.pisos_visitados || []).join(', '),
    numero_permanencias: Number(payload.numero_permanencias || 0),
    tiempo_total_permanencia: Number(payload.tiempo_total_permanencia || 0),
    estado: 'FINALIZADO'
  });
  updateRowByKey_('SESIONES', 'persona_id', payload.persona_id, {
    fin: now.toISOString(),
    estado: 'FINALIZADA'
  });
  saveEvents([{
    persona_id: payload.persona_id,
    timestamp: now.toISOString(),
    actividad: 'FINALIZAR_RECORRIDO',
    observacion: `Duracion total: ${payload.duracion_total || 0} segundos`
  }]);
  return { finalized: true };
}

function getConfigObject_() {
  const sheet = getSpreadsheet_().getSheetByName('CONFIG');
  const values = sheet.getDataRange().getValues();
  const config = {};
  values.slice(1).forEach((row) => {
    if (row[0]) {
      config[String(row[0])] = String(row[1]);
    }
  });
  return config;
}

function getMapCatalog_(config) {
  return [
    {
      id: 'PLANTA_BAJA',
      label: 'Planta Baja',
      src: config.MAP_PLANTA_BAJA_SRC || 'assets/maps/planta-baja.png',
      fileId: config.MAP_PLANTA_BAJA_FILE_ID || '',
      fileIdKey: 'MAP_PLANTA_BAJA_FILE_ID',
      fileName: config.MAP_PLANTA_BAJA_FILE_NAME || 'planta-baja.png'
    },
    {
      id: 'PISO_1',
      label: 'Piso 1',
      src: config.MAP_PISO_1_SRC || 'assets/maps/piso-1.png',
      fileId: config.MAP_PISO_1_FILE_ID || '',
      fileIdKey: 'MAP_PISO_1_FILE_ID',
      fileName: config.MAP_PISO_1_FILE_NAME || 'piso-1.png'
    },
    {
      id: 'PISO_2',
      label: 'Piso 2',
      src: config.MAP_PISO_2_SRC || 'assets/maps/piso-2.png',
      fileId: config.MAP_PISO_2_FILE_ID || '',
      fileIdKey: 'MAP_PISO_2_FILE_ID',
      fileName: config.MAP_PISO_2_FILE_NAME || 'piso-2.png'
    },
    {
      id: 'PARQUEADERO_PB',
      label: 'Parqueadero PB',
      src: config.MAP_PARQUEADERO_PB_SRC || 'assets/maps/parqueadero-planta-baja.png',
      fileId: config.MAP_PARQUEADERO_PB_FILE_ID || '',
      fileIdKey: 'MAP_PARQUEADERO_PB_FILE_ID',
      fileName: config.MAP_PARQUEADERO_PB_FILE_NAME || 'parqueadero-planta-baja.png'
    },
    {
      id: 'PARQUEADERO_SUBSUELO',
      label: 'Subsuelo',
      src: config.MAP_PARQUEADERO_SUBSUELO_SRC || 'assets/maps/parqueadero-subsuelo.png',
      fileId: config.MAP_PARQUEADERO_SUBSUELO_FILE_ID || '',
      fileIdKey: 'MAP_PARQUEADERO_SUBSUELO_FILE_ID',
      fileName: config.MAP_PARQUEADERO_SUBSUELO_FILE_NAME || 'parqueadero-subsuelo.png'
    }
  ];
}

function ensureHeaders_(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsHeaders = current.some((value, index) => value !== headers[index]);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function seedConfig_() {
  const sheet = getSpreadsheet_().getSheetByName('CONFIG');
  const existing = new Set(
    sheet.getDataRange().getValues().slice(1).map((row) => String(row[0]))
  );
  const values = DEFAULT_CONFIG.filter((row) => !existing.has(row[0]));
  appendValues_('CONFIG', values);
}

function seedEncuestadores_() {
  const sheet = getSpreadsheet_().getSheetByName('ENCUESTADORES');
  if (sheet.getLastRow() <= 1) {
    appendValues_('ENCUESTADORES', DEFAULT_ENCUESTADORES);
  }
}

function getActiveRows_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) {
    return [];
  }
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1)
    .map((row) => rowToObject_(headers, row))
    .filter((row) => String(row.activo || 'SI').toUpperCase() !== 'NO');
}

function rowToObject_(headers, row) {
  return headers.reduce((object, header, index) => {
    object[header] = row[index];
    return object;
  }, {});
}

function appendValues_(sheetName, values) {
  if (!values || values.length === 0) {
    return;
  }
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, values.length, values[0].length).setValues(values);
}

function updateRowByKey_(sheetName, keyHeader, keyValue, updates) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const keyIndex = headers.indexOf(keyHeader);
  if (keyIndex === -1) {
    throw new Error(`No existe la columna ${keyHeader} en ${sheetName}`);
  }
  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    if (values[rowIndex][keyIndex] === keyValue) {
      Object.keys(updates).forEach((header) => {
        const columnIndex = headers.indexOf(header);
        if (columnIndex !== -1) {
          sheet.getRange(rowIndex + 1, columnIndex + 1).setValue(updates[header]);
        }
      });
      return true;
    }
  }
  return false;
}

function updateConfigValue_(key, value) {
  const sheet = getSpreadsheet_().getSheetByName('CONFIG');
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row += 1) {
    if (values[row][0] === key) {
      sheet.getRange(row + 1, 2).setValue(value);
      return true;
    }
  }
  sheet.appendRow([key, value, '']);
  return true;
}

function findDriveFileIdByName_(fileName) {
  if (!fileName) {
    return '';
  }
  const files = DriveApp.getFilesByName(fileName);
  let newest = null;
  while (files.hasNext()) {
    const file = files.next();
    if (!newest || file.getLastUpdated().getTime() > newest.getLastUpdated().getTime()) {
      newest = file;
    }
  }
  return newest ? newest.getId() : '';
}

function nextPersonaId_() {
  const next = peekNextPersonaId_();
  PropertiesService.getScriptProperties().setProperty('LAST_PERSONA_NUMBER', String(parseInt(next.slice(1), 10)));
  return next;
}

function peekNextPersonaId_() {
  const props = PropertiesService.getScriptProperties();
  const stored = Number(props.getProperty('LAST_PERSONA_NUMBER') || 0);
  const sheet = getSpreadsheet_().getSheetByName('PERSONAS');
  let maxNumber = stored;
  if (sheet && sheet.getLastRow() > 1) {
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
    ids.forEach((id) => {
      const match = String(id).match(/^P(\d+)$/);
      if (match) {
        maxNumber = Math.max(maxNumber, Number(match[1]));
      }
    });
  }
  return 'P' + String(maxNumber + 1).padStart(4, '0');
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty('SPREADSHEET_ID');
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }
  if (DEFAULT_SPREADSHEET_ID) {
    props.setProperty('SPREADSHEET_ID', DEFAULT_SPREADSHEET_ID);
    return SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty('SPREADSHEET_ID', active.getId());
    return active;
  }
  const created = SpreadsheetApp.create(`${APP_NAME} Base de Datos`);
  props.setProperty('SPREADSHEET_ID', created.getId());
  return created;
}

function classifyStay_(seconds) {
  if (seconds < 3) return 'NO_CUENTA';
  if (seconds <= 5) return 'ATENCION_BREVE';
  if (seconds <= 15) return 'INTERES';
  if (seconds <= 30) return 'INTERES_ALTO';
  if (seconds <= 60) return 'PERMANENCIA_FUERTE';
  return 'PERMANENCIA_MUY_ALTA';
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm:ss');
}
