# Baseline — NBA Fantasy Analyzer

Dashboard especializado en NBA Fantasy H2H 8-CAT (PTS, FT%, 3PTM, FG%, AST, REB, STL y BLK), con una dirección visual minimalista, datos reales de ESPN y herramientas interactivas para roster, trades y draft.

## Ejecutar

```bash
npm install
npm run dev
```

El build de producción se genera con:

```bash
npm run build
npm start
```

## Actualizar datos NBA

El dataset local incluye 582 jugadores con partidos registrados en la temporada 2025–26. Para regenerarlo desde el endpoint público de estadísticas de ESPN:

```bash
npm run data:update
```

Para otra temporada, ejecuta directamente `node scripts/fetch-players.mjs AÑO_ESPN`; por ejemplo, la temporada 2026–27 usa `2027`.

## Módulos

- Dashboard con récord, proyección semanal, matchup y oportunidades de mercado.
- Mi equipo importable desde ligas públicas o privadas de ESPN.
- Comparación de todos los equipos y rosters de la liga en H2H 8-CAT.
- Directorio NBA con búsqueda, filtros, ordenamiento y perfiles detallados.
- Trade Lab con valor, equidad, impacto H2H 8-CAT y escenario de récord.
- Predicción de liga Monte Carlo desde los rosters del draft, calendario completo, probabilidades de playoffs/título y trades hipotéticos entre equipos.
- Draft Room con board dinámico para cuatro estrategias de construcción.
- Draft Live de sólo lectura con polling cada 2.5 segundos, equipo en turno, feed de picks, cola local y recomendaciones 8-CAT recalculadas automáticamente.

Las ligas privadas usan `SWID` y `espn_s2` únicamente durante la solicitud al servidor local; esas credenciales no se guardan. `npm run dev` activa el endpoint durante desarrollo y `npm start` sirve el build de producción con la misma integración.

Durante un draft live, las selecciones se confirman en ESPN. Baseline funciona como companion: lee el estado, elimina jugadores elegidos y actualiza el board sin realizar picks en nombre del usuario.
