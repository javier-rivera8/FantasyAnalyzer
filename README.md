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
```

## Actualizar datos NBA

El dataset local incluye 582 jugadores con partidos registrados en la temporada 2025–26. Para regenerarlo desde el endpoint público de estadísticas de ESPN:

```bash
npm run data:update
```

Para otra temporada, ejecuta directamente `node scripts/fetch-players.mjs AÑO_ESPN`; por ejemplo, la temporada 2026–27 usa `2027`.

## Módulos

- Dashboard con récord, proyección semanal, matchup y oportunidades de mercado.
- Mi equipo con roster importable desde ligas públicas de ESPN.
- Directorio NBA con búsqueda, filtros, ordenamiento y perfiles detallados.
- Trade Lab con valor, equidad, impacto H2H 8-CAT y escenario de récord.
- Draft Room con board dinámico para cuatro estrategias de construcción.

La importación directa de ESPN usa el proxy de desarrollo de Vite. Una integración desplegada para ligas privadas requiere un pequeño backend con autorización de ESPN.
