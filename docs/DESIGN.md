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

- Una skin es un paquete completo: piezas, ghost, partículas y pack de sonido (el sonido se puede elegir aparte).
- **Piezas conectadas**: el motor guarda qué celdas pertenecen a la misma pieza (máscara de 8 bits por celda, que se corta al limpiar líneas). Las skins conectadas dibujan cada pieza como una sola forma, con esquinas redondeadas solo en el exterior, cortes limpios en las esquinas cóncavas y luz en los bordes expuestos. El ghost es un contorno continuo.
- Skins (v0.5), se añaden un par por iteración:
  1. **Studio** (por defecto): conectada, colores tipo Apple afinados, luz desde arriba.
  2. **Clay**: conectada, pastel mate soft-touch con grano.
  3. **Gem**: piedras facetadas con destello.
  4. **Crystal**: cristal prismático tallado con borde iridiscente.
  5. **Neon**: conectada, un tubo de luz por pieza (homenaje a Tetris Effect).
  6. **Aurora**: conectada, células bioluminiscentes que respiran.
  7. **Ember**: conectada, filamento incandescente dentro de una carcasa oscura.
  8. **Bevel**: biselado clásico de los stackers online.
  9. **Wire**: cubos isométricos en alambre.
  10. **NES**: pixel art 8×8 con la paleta de la NES, que cambia con el nivel.
  11. **Game Boy**: 4 verdes DMG, un patrón por pieza.
  12. **Mono**: conectada, solo luminancia.
- **Rejilla**: Auto / Lines / Dots / Off. Auto deja elegir a la skin. Líneas de 1 px físico que se desvanecen hacia arriba; las celdas ocupadas tapan la rejilla.
- **Desbloqueo** ganando a bots (pendiente del hito 4); flag de desarrollador que desbloquea todo.

## 7b. Sonido

- Síntesis modal (sin samples): cada sonido son los modos de vibración de un material (madera, cerámica, cristal, marimba) más un transitorio corto.
- Mover = tick de detent; rotar = toque cerámico; hard drop = "thock" grave con peso según la distancia; líneas = toques de cristal (1 a 4 notas según las líneas), con la nota base subiendo por la escala pentatónica con el combo; B2B añade cuerpo grave.
- Packs: Studio, Glass, Wood, Pure.

## 7c. Home (lanzador)

- Pantalla única sin scroll, tipo menú de Tetris Effect con estética offsuit: lista vertical de modos con tipografía enorme (↑↓ / cruceta), descripción, récord y "Play".
- A la derecha, una **partida en directo** (autoplayer con heurística El-Tetris) que cambia según el modo seleccionado y usa la skin elegida.
- Barra inferior con selector de skin (←→ desde la home), atajos y versión.

## 7d. Ambiente

- **Retícula viva**: la rejilla del tablero continúa por toda la pantalla como una matriz de puntos casi invisible, alineada con el tablero. Misma retícula en la home (Canvas 2D) y en la partida (Pixi).
- Cada línea limpiada envía una onda por la retícula en el color de la pieza: un single apenas toca las celdas cercanas, un tetris cruza la pantalla. El hard drop deja una onda mínima donde aterriza; combo/B2B aclaran la zona del tablero; en peligro los puntos cercanos se tiñen de rojo.
- **Ecos de minos** solo en momentos grandes (tetris, T-spin, all clear): contornos finos de tetrominós que nacen junto al tablero, se alejan girando y se desvanecen en profundidad.
- Dentro del tablero, al limpiar: **barrido de luz** que corta la fila de izquierda a derecha (Subtle) más **mini-minos** pintados con la skin (Full). Nada de partículas genéricas.
- Interruptor propio ("Ambient background"), independiente de la intensidad de efectos. Nunca invasivo: es una herramienta de práctica.
- Sonido de movimiento y rotación: el mismo clic suave, con volumen propio ("Movement sounds").

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
5. **Plataformas y pulido**:
   - Móvil e iPad (gestos, layouts táctiles, PWA instalable), app de escritorio con Tauri.
   - Editor custom, desbloqueos, historial y progreso.
6. **Cuentas** (al final, con el juego pulido):
   - Supabase: login con Google, email (enlace mágico) y Discord.
   - Perfiles públicos, rankings por modo verificados re-simulando la partida (replays), página de stats potente a nivel diseño.
   - Se juega sin cuenta; al iniciar sesión, lo local se sube y fusiona.

## 7e. Tournaments

- **Format**: single elimination. Cups have 8 seats: you plus 7 bots. Quarterfinals are FT2, semifinals FT3 and the final FT4.
- **Cups**: each cup unlocks by winning the one before it. Developer mode unlocks everything.

  | Cup | Bot levels | Reward skin |
  | --- | --- | --- |
  | Foundations | 1,1,2,2,3,3,4 | Crystal |
  | Contenders | 3,4,4,5,5,6,7 | Aurora |
  | Summit | 6,7,7,8,9,9,10 | Ember |

- **Clones**: when a level appears twice, the second copy plays exactly like the original but gets its own name, a hue-shifted color and its own emblem.
- **Seeding**: seeding by level makes you the top seed, so you meet the weakest bot first and the strongest last. Random seeding shuffles everyone.
- **Bot vs bot**: these bouts are simulated for real with `simulateMatch` in a Web Worker, using simulated time at each bot's own pace and with its own mistakes. The bracket keeps moving while you play.
  - Any ready bout can be watched live. Watching hands the bout to the live match.
  - Leaving a bout early hands it back to the simulator.
- **Rewards**:
  - XP via `tournamentXp(place, tier)`.
  - A trophy for finishing champion or finalist.
  - The cup's reward skin for winning it.
- **Custom brackets**: they unlock after you win any cup.
  - 4, 8 or 16 seats, with ladder or custom bots; picking the same bot twice adds a clone.
  - Each round has its own first-to setting.
  - Seeding by level or random.
  - "Play in it" can be turned off to only watch.
