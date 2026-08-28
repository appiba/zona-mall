(function () {
  const activities = [
    {
      id: 'MIRANDO PRODUCTO',
      label: 'Mirando producto',
      color: '#1769aa',
      description: 'Interes directo sobre producto o gondola.'
    },
    {
      id: 'MIRANDO VITRINA',
      label: 'Mirando vitrina',
      color: '#7c3aed',
      description: 'Atencion visual desde pasillo o frente de local.'
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
      id: 'OTRO',
      label: 'Otro',
      color: '#475569',
      description: 'Otro motivo observado.'
    }
  ];

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

  window.ZonarActivityMeta = {
    activities,
    list: () => activities.map((activity) => activity.id),
    get
  };
}());
