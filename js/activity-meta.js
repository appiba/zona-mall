(function () {
  const activities = [
    {
      id: 'VITRINAS GENERALES',
      label: 'Vitrinas generales',
      color: '#7c3aed',
      description: 'Atencion a varias vitrinas o locales desde el pasillo.'
    },
    {
      id: 'MIRANDO PRODUCTO',
      label: 'Viendo producto',
      color: '#1769aa',
      description: 'Interes directo sobre producto o gondola.'
    },
    {
      id: 'MIRANDO VITRINA',
      label: 'Viendo vitrina',
      color: '#7c3aed',
      description: 'Atencion visual desde pasillo o frente de local.'
    },
    {
      id: 'COTIZANDO',
      label: 'Cotizando',
      color: '#f59e0b',
      description: 'Compara precio, pide valor o evalua comprar luego.'
    },
    {
      id: 'PROBANDO',
      label: 'Probando',
      color: '#2563eb',
      description: 'Prueba ropa, calzado, accesorio o producto.'
    },
    {
      id: 'PREGUNTANDO',
      label: 'Preguntando',
      color: '#d97706',
      description: 'Consulta con personal, informacion o servicio.'
    },
    {
      id: 'COMPRANDO',
      label: 'Comprando',
      color: '#0f8a5f',
      description: 'Compra o decision comercial visible.'
    },
    {
      id: 'CONSUMIENDO',
      label: 'Consumiendo',
      color: '#dc2626',
      description: 'Consumo de alimentos, bebida o servicio.'
    },
    {
      id: 'SENTADO A COMER',
      label: 'Sentado a comer',
      color: '#b45309',
      description: 'Permanencia en mesa o zona de comida.'
    },
    {
      id: 'PIDIENDO COMIDA',
      label: 'Pidiendo comida',
      color: '#ea580c',
      description: 'Hace pedido o revisa opciones de comida.'
    },
    {
      id: 'ESPERANDO PEDIDO',
      label: 'Esperando pedido',
      color: '#64748b',
      description: 'Espera turno, pedido o entrega.'
    },
    {
      id: 'ESPERANDO',
      label: 'Esperando',
      color: '#64748b',
      description: 'Espera, fila o pausa operativa.'
    },
    {
      id: 'SENTADO',
      label: 'Sentado',
      color: '#92400e',
      description: 'Permanencia sentada o descanso.'
    },
    {
      id: 'INTERACTUANDO CON ISLA',
      label: 'Interactuando con isla',
      color: '#0891b2',
      description: 'Interaccion con isla, modulo o activacion.'
    },
    {
      id: 'RECIBIENDO SERVICIO',
      label: 'Recibiendo servicio',
      color: '#0284c7',
      description: 'Atencion, tramite o servicio en proceso.'
    },
    {
      id: 'ACTIVACION DE MARCA',
      label: 'Activacion de marca',
      color: '#c026d3',
      description: 'Contacto con activacion promocional.'
    },
    {
      id: 'MIRANDO PUBLICIDAD',
      label: 'Mirando publicidad',
      color: '#65a30d',
      description: 'Atencion a anuncio, pantalla o material POP.'
    },
    {
      id: 'USANDO ESCALERAS',
      label: 'Usando escaleras',
      color: '#475569',
      description: 'Paso o pausa asociada a escaleras o circulacion vertical.'
    },
    {
      id: 'EN TRANSITO',
      label: 'En transito',
      color: '#334155',
      description: 'Paso rapido sin interes comercial claro.'
    },
    {
      id: 'OTRO',
      label: 'Otro',
      color: '#475569',
      description: 'Otro motivo observado.'
    }
  ];

  const profiles = {
    GENERAL: [
      'VITRINAS GENERALES',
      'MIRANDO PUBLICIDAD',
      'ESPERANDO',
      'SENTADO',
      'USANDO ESCALERAS',
      'EN TRANSITO',
      'OTRO'
    ],
    MODA: [
      'MIRANDO VITRINA',
      'MIRANDO PRODUCTO',
      'COTIZANDO',
      'PROBANDO',
      'COMPRANDO',
      'PREGUNTANDO',
      'OTRO'
    ],
    COMIDA: [
      'SENTADO A COMER',
      'CONSUMIENDO',
      'PIDIENDO COMIDA',
      'ESPERANDO PEDIDO',
      'COMPRANDO',
      'PREGUNTANDO',
      'OTRO'
    ],
    ISLA: [
      'INTERACTUANDO CON ISLA',
      'MIRANDO PRODUCTO',
      'COTIZANDO',
      'PREGUNTANDO',
      'COMPRANDO',
      'ACTIVACION DE MARCA',
      'OTRO'
    ],
    PRODUCTO_SERVICIO: [
      'MIRANDO PRODUCTO',
      'COTIZANDO',
      'PREGUNTANDO',
      'RECIBIENDO SERVICIO',
      'ESPERANDO',
      'COMPRANDO',
      'OTRO'
    ]
  };

  const profileLabels = {
    GENERAL: 'Actividades generales',
    MODA: 'Ropa, calzado y vitrinas',
    COMIDA: 'Comida y descanso',
    ISLA: 'Islas y activaciones',
    PRODUCTO_SERVICIO: 'Productos y servicios'
  };

  const byId = activities.reduce((map, activity) => {
    map[activity.id] = activity;
    return map;
  }, {});

  function normalizeActivity(value) {
    return String(value || 'OTRO').trim().toUpperCase();
  }

  function titleCase(value) {
    return String(value || 'Otro')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function get(activity) {
    const id = normalizeActivity(activity);
    return byId[id] || {
      id,
      label: titleCase(id),
      color: '#475569',
      description: 'Registro complementario.'
    };
  }

  function list(profile) {
    const key = String(profile || 'GENERAL').toUpperCase();
    return [...(profiles[key] || profiles.GENERAL)];
  }

  function forLocation(location) {
    return list(profileForLocation(location));
  }

  function profileForLocation(location) {
    const type = normalizeActivity(location && location.tipo);
    const text = normalizeText([
      location && location.categoria,
      location && location.tipo,
      location && location.nombre,
      location && location.codigo
    ].join(' '));
    if (type === 'ISLA') {
      return 'ISLA';
    }
    if (type === 'PARQUEADERO') {
      return 'GENERAL';
    }
    if (includesAny(text, ['restaurante', 'postre', 'comida', 'cafeteria', 'heladeria', 'patio', 'pizza', 'kfc', 'panaderia', 'burguer', 'deli', 'dulceria'])) {
      return 'COMIDA';
    }
    if (includesAny(text, ['moda', 'calzado', 'ropa', 'deportiva', 'jean', 'sports', 'payless', 'tela', 'totto', 'koaj'])) {
      return 'MODA';
    }
    if (includesAny(text, ['servicio', 'banco', 'tecnologia', 'electrodomestico', 'hogar', 'decoracion', 'salud', 'belleza', 'farmacia', 'optica', 'joya', 'libreria'])) {
      return 'PRODUCTO_SERVICIO';
    }
    return 'GENERAL';
  }

  function profileLabel(profile) {
    return profileLabels[String(profile || 'GENERAL').toUpperCase()] || profileLabels.GENERAL;
  }

  function includesAny(text, terms) {
    return terms.some((term) => text.includes(term));
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  window.ZonarActivityMeta = {
    activities,
    list,
    get,
    forLocation,
    profileForLocation,
    profileLabel
  };
}());
