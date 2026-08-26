# Apps Script Backend

Este directorio contiene el backend/API de Zonar Mall.

La interfaz ya no depende de `HtmlService`; GitHub Pages llama este backend mediante JSONP porque el frontend esta servido desde otro dominio.

Funciones principales:

- `initApp`
- `createPerson`
- `saveRoutePoints`
- `savePermanencia`
- `saveEvents`
- `recordFloorChange`
- `finalizePerson`
- `ensureDatabase`

La hoja de calculo conectada es:

`1rZH0UIaPJru4E8m5BK_Af3yfbjBi68pL4YklaYsnD98`
