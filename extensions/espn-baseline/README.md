# Baseline · ESPN Draft Sync

Extensión Manifest V3 para Chrome y Edge. Lee el draft de basketball abierto en ESPN y envía sus picks a Baseline en el mismo navegador. No necesita servidor local, cookies, contraseñas ni publicar en una tienda.

## Instalar

1. Abre `chrome://extensions` (en Edge: `edge://extensions`).
2. Activa **Modo de desarrollador** y pulsa **Cargar descomprimida**.
3. Selecciona esta carpeta, que contiene `manifest.json`. También puedes descargar el ZIP desde Baseline y extraerlo.
4. Recarga la pestaña de ESPN y la de Baseline después de instalar o actualizar la extensión.

## Conectar

1. En la pestaña de la sala de ESPN (`fantasy.espn.com/basketball/draft?...`), abre la extensión y pulsa **Usar esta sala de ESPN**.
2. En Baseline → **Draft Room**, pulsa **Conectar ESPN**.
3. Mantén ambas pestañas abiertas en el mismo navegador y perfil. Los picks anteriores también se recuperan.
4. Elige siempre en ESPN. Para editar manualmente en Baseline, pulsa **Volver a manual**. Para detener la lectura de ESPN, usa **Detener captura** en el popup.

Una nueva sala requiere seleccionarla desde el popup y conectarla explícitamente en Baseline. Baseline pregunta antes de reemplazar un draft con picks guardados.

## Compatibilidad y límites

- Baseline en `http://localhost` o `http://127.0.0.1` (cualquier puerto) y en `fantasy-analyzer-jr-2026.web.app` / `fantasy-analyzer-jr-2026.firebaseapp.com`.
- La versión actual extrae `.pick-message__container`, `.pick-info` y nombres e IDs desde el DOM de ESPN. El extractor se verificó contra una sala real con 156 picks el 1 de octubre de 2026. Si ESPN cambia el HTML, puede requerir ajustes.
- El panel observado conserva todo el historial aun con scroll. Si faltan picks, Baseline conserva la parte continua y espera el historial restante. Una lectura parcial nunca borra picks anteriores.
- Un historial completo reemplaza el anterior, incluyendo correcciones y deshacer de ESPN. No se interpreta una lista vacía transitoria como un reinicio.
- Jugadores ausentes del dataset conservan su pick y nombre. No tienen estadísticas para la simulación o perfil; Baseline muestra un aviso.
- Si ESPN muestra **Connection Failed**, se conserva el historial pero no habrá picks nuevos hasta que ESPN reconecte.
- Solo se guarda la sala elegida y su última lectura en almacenamiento local de la extensión. No se lee el `memberId` de la URL ni se transmiten cookies. Los datos pasan entre pestañas; no se suben a un servidor.

## Verificar y empaquetar

Desde la raíz del proyecto:

```sh
node --test tests/espn-extension.test.mjs
node scripts/package-espn-extension.mjs
npm run build
```

El ZIP se genera en `public/espn-baseline-extension.zip`; el build también lo empaqueta automáticamente.
