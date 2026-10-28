# TETRA — Documento de diseño

Plataforma de práctica de Tetris minimalista: se juega y se siente como TETR.IO, se ve como un producto de diseño profesional (estilo offsuit.app + Apple, toque brutalista) y añade lo que TETR.IO no tiene: **1v1 contra bots**.

Decisiones tomadas en la sesión de grilling (Q1–Q34).

---

## 1. Plataforma y stack

| Tema | Decisión |
|---|---|
| Plataformas | Web (navegador de escritorio) + móvil desde el principio. **PWA** instalable ya; **Tauri 2** (escritorio + iOS/Android) cuando toque publicar en tiendas. |
| Lenguaje / build | TypeScript + Vite, monorepo pnpm. |
| Paquetes | `engine` (TS puro, sin DOM), `bot` (Rust → WASM, en Web Worker), `app` (Vite + React + Tailwind + PixiJS). |
| Render | PixiJS (WebGL) para el tablero y FX; render a la frecuencia de la pantalla (60/120/144/240 Hz) con interpolación. |
| Menús | React + Tailwind. |
| Persistencia | Todo local (IndexedDB/localStorage), export/import JSON. Sin backend ni cuentas. |
| Idioma | UI en inglés. Nombre: **TETRA** (nunca "Tetris" en nombre/UI). |
| Deploy | Vercel o Netlify, más adelante (lo decide el usuario). |

## 2. Motor

- **Determinista**: RNG con semilla, partida reconstruible a partir de inputs → replays y multijugador futuro (no prioritario, pero la arquitectura lo permite desde el día 1).
- **Bucle**: la lógica corre en **tiempo continuo (ms)**: cada input se aplica en su timestamp exacto, que es aún más preciso que los ticks de 60 Hz con subframes de TETR.IO. La gravedad se sigue expresando en G (filas por frame a 60 Hz). Render desacoplado, a la frecuencia de la pantalla. Teclado por eventos, no por polling.
- **Mecánicas = TETR.IO**:
  - Rotación **SRS+** con **giro 180°**.
  - 7-bag, hold, 5 piezas de next.
  - Lock delay 500 ms, máx. 15 resets por movimiento.
  - IRS/IHS.
  - Spins: T-spin, T-spin mini; **all-spin** opcional (off por defecto).
- **Manejo**: DAS, ARR, SDF, DAS cut, prevención de hard drop accidental. Por defecto DAS 167 ms, ARR 33 ms, SDF ×6.
- **Ataque/basura**: tabla de TETR.IO (combos, B2B, **surge**), cancelación, reglas de huecos, retraso de llegada de basura, **margin time**. Las reglas viven en un objeto configurable (permite otros sistemas en el futuro).

## 3. Controles

**Teclado** (todo reasignable):

| Acción | Tecla |
|---|---|
| Mover | ← → |
| Soft drop | ↓ |
| Hard drop | Espacio |
| Rotar horario | X / ↑ |
| Rotar antihorario | Z |
| Rotar 180° | A |
| Hold | C / Shift |
| Retry | R |
| Pausa / salir | Esc |

**Mando** (Gamepad API: Xbox, PlayStation, Switch Pro, genéricos):

| Acción | Botón |
|---|---|
| Mover / soft drop | Cruceta |
| Hard drop | Cruceta ↑ |
| Rotar horario | A / ✕ |
| Rotar antihorario | B / ○ |
| Rotar 180° | Y / △ |
| Hold | LB/RB (L1/R1) |
| Pausa | Start |
| Retry | Select |

- El mando tiene su propio DAS/ARR (mismo motor subframe).
- Stick analógico opcional, con deadzone ajustable.
- Los menús se navegan con el mando y los glifos se adaptan al mando detectado.

**Móvil, gestos** (como la app oficial):
- Arrastrar horizontal → mover celda a celda siguiendo el dedo.
- Tap → rotar (mitad derecha: horario; mitad izquierda: antihorario).
- Swipe rápido abajo → hard drop; arrastre lento abajo → soft drop.
- Swipe arriba → hold.
- Sensibilidad ajustable.
- En 1v1, el tablero del bot se ve en miniatura.

## 4. Modos

| Modo | Reglas |
|---|---|
| **40 Lines** | 40 líneas lo más rápido posible (idéntico a TETR.IO). |
| **Blitz** | 2 min, puntuación, gravedad sube por niveles. Tabla de TETR.IO: 3 líneas para el nivel 2 y +2 por nivel (24 a partir del nivel 11), gravedad de 1 s/fila hasta 20G en el nivel 14, puntos × nivel. |
| **Marathon** | Guideline: 150 líneas, 15 niveles, curva oficial de gravedad. |
| **Endless** | Variante de Marathon hasta 20G, termina al morir. |
| **1v1 vs Bot** | First to N (FT3 por defecto; FT1/5/7/10). Marcador estilo TETR.IO League. Misma semilla de piezas para ambos. |

**Fin de partida 1v1**: stats comparativas (PPS, APM, VS) + gráfica de la partida.

**Funciones de práctica (v1)**:
- Retry instantáneo (R).
- Historial de partidas con gráficas de progreso.
- Récords personales.
- Win-rate por bot.

**v2**: undo, práctica de openers, empezar desde una posición, replays, Zen, cheese race.

## 5. Bots

- **Arquitectura**: interfaz común de bot.
  - Núcleo propio en **Rust → WASM** dentro de un Web Worker: búsqueda de colocaciones (incl. T-spins) + heurística con pesos.
  - La interfaz admite enchufar otros motores (p. ej. Cold Clear) en el futuro.
- **Escala**: nivel 1 ≈ 0,5 PPS / 10 APM → nivel 10 ≈ 3,5 PPS / 160 APM (top humano). El custom no tiene techo.
- **Los 10 bots** (escalera, cada victoria desbloquea el siguiente):

| Nv | Nombre | Estilo |
|---|---|---|
| 1 | Pebble | Lento, coloca casi al azar |
| 2 | Drift | Lento, sin hold |
| 3 | Stack | Busca tetris, lento |
| 4 | Tempo | Ritmo constante, combos básicos |
| 5 | Pivot | Empieza con T-spins simples |
| 6 | Rift | Agresivo, envía basura pronto |
| 7 | Vector | Rápido y limpio, B2B |
| 8 | Prism | T-spins y openers (TKI, PCO) |
| 9 | Apex | Casi perfecto, downstack fuerte |
| 10 | Zenith | Nivel top humano |

- **Sensación humana** (todo ajustable en Advanced):
  - Ritmo irregular: ráfagas y pausas para "pensar".
  - Tiempo de reacción a la basura.
  - Movimiento visible con teclas virtuales (DAS, rotaciones, soft drop), sin teletransporte.
  - Errores que bajan con el nivel: misdrops, finesse imperfecto, T-spins vistos tarde, pánico con el stack alto.
  - Variedad con semilla: el mismo bot no juega dos veces igual.
- **Editor custom**:
  - Sección simple: base a clonar, PPS, agresividad, tasa de error.
  - Sección Advanced (plegada): profundidad, hold, preferencia T-spin/tetris/combo, umbral de downstack, reacción, pesos de la heurística.
  - Guardar con nombre y exportar.

## 6. Dirección visual

- **Base**: lenguaje de offsuit.app.
  - Solo modo oscuro: fondo #000, texto #FFF/#FBFBFC, bordes #3F3F45, tiles #1B1B1D→#161618.
  - Tarjetas muy redondeadas con relleno blanco 9% y hairline inset blanco 6%.
  - Botones píldora.
  - Easing springy `cubic-bezier(0.34,1.56,0.64,1)`.
  - Wordmark "TETRA" gigante en la home.
  - Chips "New"/"Soon".
  - Colores definidos como tokens (permite modo claro futuro).
- **Tipografía**: Plus Jakarta Sans para la UI; **Geist Mono** para todos los números y stats.
- **Toque Apple/brutalista**:
  - Rejilla estricta de 8px.
  - Labels en small caps con tracking.
  - Cifras grandes.
  - Separadores de 1px.
  - Un único acento.
- **Prohibido** (que no parezca hecho con IA): degradados morados, emojis, sombras difusas genéricas, iconos Lucide por todas partes, rejillas de tarjetas idénticas.
- **Tablero**:
  - Ghost relleno al ~20%.
  - Rejilla casi invisible (blanco 3%).
  - Marco hairline.
  - Stats en vivo configurables (por defecto PPS, APM, tiempo, líneas) en gris pequeño.
- **FX estilo Tetris Effect**, con intensidad Off / Subtle (defecto) / Full:
  - Partículas que escalan con el tipo de clear.
  - "Respiración" y shake en hard drop y al recibir basura.
  - Glow que crece con combo/B2B.
  - Textos de acción ("T-SPIN DOUBLE", "B2B ×3").
  - Sin fondo reactivo.
- **Audio**: efectos de sonido minimalistas tipo Apple (clics suaves); tonos de combo que suben de nota. Música propia: más adelante.

## 7. Skins

- Una skin es un paquete completo: piezas, ghost, partículas y sonidos. Se pueden mezclar partes de skins distintas.
- El sistema es ampliable: se añadirán más skins.
- Skins de lanzamiento:
  1. **Default**: plana, colores de sistema de Apple (I cian, O amarillo, T morado, S verde, Z rojo, J azul, L naranja), esquinas suaves.
  2. **Liquid Glass**: translúcida, refracción, brillo especular.
  3. **Mono**: blanco/gris por luminosidad, brutalista.
  4. **Outline**: solo contorno de 1,5px, estilo plano técnico.
  5. **Neon**: bloques de luz con glow (homenaje a Tetris Effect).
  6. **Paper**: pastel mate con textura sutil.
- **Desbloqueo** ganando a bots (p. ej. Liquid Glass al ganar a Tempo, Neon al ganar a Zenith). **Flag de desarrollador** (`?dev=1` / por defecto en local) que desbloquea todo.

## 8. Hitos

Cada hito es jugable y se revisa antes de pasar al siguiente.

1. **Base**:
   - Monorepo y engine (SRS+ con tests de tablas de kicks).
   - Bucle subframe y manejo por teclado.
   - **40 Lines jugable** con la skin Default.
2. **Modos solo y controles**:
   - Blitz, Marathon + Endless.
   - Retry instantáneo, ajustes y teclas, récords locales.
   - **Soporte de mando**.
3. **Visual y sonido**: menús estilo offsuit, sonido, FX, las 6 skins.
4. **1v1**:
   - Sistema de basura/ataque TETR.IO.
   - Bots nivel 1–10 (Rust/WASM).
   - 1v1 FT-N con stats y gráficas al terminar.
5. **Práctica y móvil**:
   - Editor custom, desbloqueos, historial y progreso.
   - Gestos en móvil y PWA.
