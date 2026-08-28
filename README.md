# Zonar Mall

Aplicacion web para registrar recorridos, permanencias e interacciones de visitantes dentro del mall usando mapas reales.

## Arquitectura

```text
GitHub Pages
  -> Frontend JavaScript
  -> Apps Script API
  -> Google Sheets
```

El frontend vive en este repositorio y esta preparado para publicarse desde:

`https://appiba.github.io/zona-mall/`

El panel administrativo se abre en:

`https://appiba.github.io/zona-mall/admin.html`

Apps Script queda como backend/API y Google Sheets conserva la base de datos.

## Estructura

- `index.html`: aplicacion principal para encuestadores.
- `admin.html`: panel administrativo con mapa de calor, puntos de interes, graficos y conclusiones.
- `css/`: estilos responsive para tablet, celular y escritorio.
- `js/config.js`: configuracion central, incluyendo `apiUrl` y mapas.
- `js/api.js`: cliente JSONP para llamar Apps Script desde GitHub Pages.
- `js/activity-meta.js`: catalogo visual de actividades y colores.
- `js/app.js`: trazado, permanencias, actividades, cambio de piso y guardado.
- `js/admin.js`: analisis por planta y parqueadero desde `PERMANENCIAS`.
- `assets/maps/`: mapas reales usados como capas base.
- `apps-script/Code.gs`: backend/API para Google Sheets.
- `data/`: archivos base para directorios y simbologia sin inventar datos.

## Mapas

Los mapas reales estan en:

- `assets/maps/planta-baja.png`
- `assets/maps/piso-1.png`
- `assets/maps/piso-2.png`
- `assets/maps/parqueadero-planta-baja.png`
- `assets/maps/parqueadero-subsuelo.png`

No se redibujan ni se sustituyen por planos genericos. Rutas, permanencias y futuras capas de analisis se dibujan encima de estas imagenes.

## Backend

El API configurado en `js/config.js` apunta a la implementacion actual de Apps Script:

`https://script.google.com/macros/s/AKfycbw8vu2lMM5WRrU7vK-p78rIlx5OKpgdm5_rnOyNVxiEFE_YhzPt2k2rnBq8p36AIpnx/exec`

Para actualizar el backend:

1. Copiar `apps-script/Code.gs` al proyecto Apps Script.
2. Ejecutar `ensureDatabase`.
3. Ejecutar `configureProvidedMapFiles` si se siguen usando las imagenes de Drive.
4. Crear una nueva implementacion web o actualizar la existente.
5. Confirmar que `js/config.js` contiene la URL vigente.

## Estado funcional migrado

La primera version mantiene:

- seleccion de encuestador;
- creacion automatica de persona;
- seleccion de piso;
- mapas reales;
- trazado con dedo o lapiz mediante Pointer Events;
- coordenadas normalizadas;
- levantamiento de lapiz sin finalizar recorrido;
- Persona Detenida y Pausa de Seguimiento;
- cronometro de permanencia;
- actividades por permanencia con color por motivo;
- local o lugar cercano editable con sugerencias de codigos visibles del mapa;
- continuacion del mismo recorrido;
- cambio de piso;
- finalizacion;
- guardado progresivo con cola local temporal.

El panel administrativo usa `PERMANENCIAS` para mapas de calor, rankings y conclusiones. Las rutas no se usan para generar zonas calientes. Los puntos calientes se colorean por actividad principal para distinguir compras, preguntas, vitrina, consumo, espera y otros motivos.
