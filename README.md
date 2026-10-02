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
- Draft Room manual que funciona sin conectar ESPN: orden serpiente configurable, nombres y posiciones de todos los equipos, registro de picks para cualquier equipo, historial, deshacer y guardado local.
- Board dinámico con estadísticas 8-CAT por partido de 2025–26 y estimaciones locales para 2026–27, búsqueda y filtros. Las estimaciones usan regresión por posición, partidos jugados y edad; no son proyecciones oficiales de ESPN.
- Predicción de posiciones recalculada tras cada pick mediante 200 simulaciones. El modelo completa las plazas vacantes con jugadores disponibles y compara todos los equipos en H2H 8-CAT.

Las ligas privadas usan `SWID` y `espn_s2` únicamente durante la solicitud al servidor local; esas credenciales no se guardan. `npm run dev` activa el endpoint durante desarrollo y `npm start` sirve el build de producción con la misma integración.

Durante el draft, puedes registrar picks manualmente o sincronizarlos con la extensión [Baseline · ESPN Draft Sync](extensions/espn-baseline/README.md). Descárgala desde el Draft Room o carga `extensions/espn-baseline` como extensión descomprimida en Chrome/Edge, recarga ambas pestañas, activa «Usar esta sala de ESPN» y pulsa «Conectar ESPN» en Baseline. Las selecciones se hacen en ESPN; la extensión solo lee y transmite el historial entre pestañas del mismo navegador.
