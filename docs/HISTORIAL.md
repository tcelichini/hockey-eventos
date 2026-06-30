# Historial de cambios — hockey-eventos

Registro de todas las sesiones de trabajo. Cada entrada documenta cambios concretos hechos en el código. Las convenciones reutilizables y la arquitectura estable se promueven a `CONVENCIONES.md` y `ARQUITECTURA.md`.

---

## Sesión 1

- **Pricing tiers por cantidad:** fix bug "Resto" duplicado al limpiar campo "Hasta"
- **Etiquetas de tramo:** "Primeros N" → rangos "Del X al Y / Resto"
- **Página pública:** tramos llenos con tachado
- **Imagen del evento:** selector de posición (Arriba/Centro/Abajo), guardado como `#top`/`#bottom` en la URL
- **WhatsApp invite:** descripción del evento, emoji, indicador
- **Admin Resumen:** balance neto por asistente (Deben pagar / Se les debe devolver) para todos los confirmados
- **Admin Gastos:** resumen `Total / personas = c/u` movido al card de Gastos (fuera del Resumen)
- **Botón Actualizar:** `components/refresh-button.tsx` con `router.refresh()`

## Sesión 2

- **Precios por fecha de pago:** nuevo modo de precio en eventos
  - Nuevo tipo `DateTier` en `db/schema.ts`
  - Columna `date_tiers jsonb` en la tabla `events` (migración: `drizzle/0001_add_date_tiers.sql`)
  - Helpers `calculateDatePrice` y `getDateTierLabel` en `lib/pricing.ts`
  - Componente `DateTiersEditor` para el formulario admin
  - Selector "Precio fijo / Por cantidad / Por fecha" en formularios de creación y edición
  - Página pública muestra tramos por fecha con tachado para fechas vencidas
  - API recalcula precio al momento del pago (no del registro)
  - Fix: al volver a cargar comprobante, recalcula precio según fecha actual

## Cambios de Tomás

- **Combos:** sistema completo de combos (descuento por pago conjunto de múltiples eventos)
  - Nueva tabla `combos` en `db/schema.ts`
  - Campo `combo_id` en tabla `attendees`
  - CRUD completo: admin/combos/new, admin/combos/[id], API combos
  - Página pública `/combo/[slug]`
  - Dashboard admin muestra combos activos
  - Fix: errores de lint en date-tiers-editor que rompían el build

## Sesión 3

- **Fix archivos truncados:** 4 archivos (edit/page, new/page, refresh-button, date-tiers-editor) estaban cortados desde la sesión anterior, causando que el build de Vercel fallara silenciosamente
- **Fecha de carga de comprobante:** nueva columna `proof_uploaded_at` en attendees
  - Migración: `drizzle/0002_add_proof_uploaded_at.sql`
  - API `upload-proof` guarda el timestamp al subir comprobante
  - Lista de Asistentes en admin muestra "Pagó [fecha]" en verde junto a la fecha de confirmación
- **Botón Actualizar en dashboard:** agregado al panel general de admin (junto a "Nuevo combo" y "Nuevo evento")

## Sesión 4

- **Eventos 3T (Tercer Tiempo):** nuevo tipo de evento con asistencia obligatoria para todo el plantel
  - Campo `is_3t boolean` en tabla `events` (migración: `drizzle/0003_add_is_3t.sql`)
  - `lib/players.ts`: lista estática de 37 jugadores en formato "Apellido, Nombre"
  - Al crear un evento 3T, la API inserta automáticamente todos los jugadores como asistentes confirmados con `payment_status: pending`
  - Checkbox "🍖 Tercer Tiempo (3T)" en formularios de creación y edición, posicionado arriba de imagen/fecha
  - Página pública: banner "Asistencia obligatoria para todo el plantel" + botón "🧾 Subir comprobante de pago" (sin botón "No puedo ir")
  - Página `/confirm`: dropdown con los jugadores (Apellido, Nombre) en lugar de campo de texto libre
  - Panel admin: orden alfabético en secciones Asistentes y Resumen (`.orderBy(attendees.full_name)`)
  - Nuevo componente `add-attendee-button.tsx`: permite al admin agregar un asistente manualmente (inline) desde el panel del evento

## Sesión 5

- **Actualización de plantel:** `lib/players.ts` actualizado de 37 a 36 jugadores
  - Salen: Battipede Octavio, Crovetto Jorge, Erriquenz Juan Pablo, Ponce Julian, Salas Pedro, Solari Matias
  - Entran: Aguiar Franco Nicolás, Díaz Santiago, Salerno Picasso Lorenzo, Santoro Franco, Ugarte Joaquín

## Sesión 6

- **Fix desfase horario de 3 horas:** todas las fechas se mostraban con hora UTC en producción (Vercel)
  - Causa: `Intl.DateTimeFormat("es-AR", ...)` sin `timeZone` explícito
  - Fix: se agregó `timeZone: "America/Argentina/Buenos_Aires"` en 10 instancias de `DateTimeFormat` en 8 archivos
  - Archivos afectados: `whatsapp-invite-button.tsx`, `e/[slug]/page.tsx`, `combo/[slug]/page.tsx`, `admin/page.tsx`, `admin/events/[id]/page.tsx`, `admin/combos/[id]/page.tsx`, `api/events/[id]/export/route.ts`, `event-selector.tsx`
- **Fecha de comprobante en combos:** la vista admin del combo ahora muestra "Pagó [fecha]" en verde (usa `proof_uploaded_at`), igual que en eventos individuales

## Sesión 7

- **Indicadores visuales combo vs individual en eventos:**
  - En la vista admin de un evento, si un asistente pagó **vía combo** (todos los eventos del combo pagados), se muestra `(vía combo)` en violeta junto al monto + badge **Combo** violeta clickeable que lleva al combo
  - Si pagó individualmente, no se muestra ningún indicador extra (evita confusión con montos menores)
  - Archivos: `admin/events/[id]/page.tsx`
- **Indicadores de pago parcial en combos:**
  - En la vista admin del combo, si un inscripto pagó solo algunos eventos individualmente, se muestra en ámbar: `⚠ Pagó [evento] individual ($X)` + `Resta: [eventos pendientes]`
  - Inscriptos del combo ahora ordenados alfabéticamente
  - Archivos: `admin/combos/[id]/page.tsx`
- **Auto-vinculación al combo al agregar asistente manualmente:**
  - Cuando un admin agrega un asistente a un evento que pertenece a un combo, y esa persona ya está inscripta en todos los demás eventos del combo, se le asigna automáticamente `combo_id` a todos sus registros → aparece en el listado de inscriptos del combo
  - Archivos: `api/attendees/route.ts`
- **Documentación worktrees:** se agregó nota en CONTEXTO_COWORK sobre el problema de `.env.local` faltante en worktrees de git (causa que la contraseña admin no funcione)

## Sesión 8

- **Fix asistentes manuales no visibles en link público de eventos individuales:**
  - Problema: en eventos 3T, el dropdown del confirm page solo mostraba nombres de la lista estática `PLAYERS`. Los asistentes agregados manualmente por el admin (ej: Erriquenz, Juan Pablo) no aparecían y no podían subir su comprobante de pago.
  - Fix: la API `events/by-slug/[slug]` ahora devuelve `attendeeNames` (nombres de asistentes confirmados). El dropdown combina `PLAYERS` + asistentes de la DB que no estén en la lista, ordenados alfabéticamente.
  - Archivos: `api/events/by-slug/[slug]/route.ts`, `app/e/[slug]/confirm/page.tsx`
- **Orden alfabético en "¿Quiénes van?" del link público:**
  - La lista de asistentes confirmados en la página pública del evento ahora se muestra ordenada alfabéticamente.
  - Archivos: `app/e/[slug]/page.tsx`

## Sesión 9

- **Dropdown de jugadores en "Cargar gasto" para eventos 3T:**
  - En eventos de tipo 3T, el formulario de carga de gastos ahora muestra un **menú desplegable** con los nombres de todos los asistentes confirmados (orden alfabético) en lugar del campo de texto libre "Tu nombre".
  - El dropdown incluye asistentes agregados manualmente por el admin (no solo la lista estática de PLAYERS).
  - En eventos no-3T, el formulario sigue igual: input de texto libre con el mensaje "Usá el mismo nombre con el que te anotaste".
  - Archivos: `components/expense-form.tsx`, `app/e/[slug]/page.tsx`

## Sesión 10

- **Dropdown de asistentes sin pagar en "Ya me anoté, quiero subir el comprobante":**
  - En eventos no-3T, al hacer click en "Ya me anoté, quiero subir el comprobante", la página de confirmación ahora muestra un **menú desplegable** con los asistentes que aún no pagaron (en vez del campo de texto libre).
  - Se agrega `?upload=1` al link para distinguir el flujo de carga de comprobante del de nueva inscripción.
  - La API `events/by-slug/[slug]` ahora devuelve `unpaidAttendeeNames` (asistentes confirmados sin pagar, orden alfabético).
  - Si no hay asistentes sin pagar, se muestra el input de texto como fallback.
  - Archivos: `app/api/events/by-slug/[slug]/route.ts`, `app/e/[slug]/page.tsx`, `app/e/[slug]/confirm/page.tsx`
- **Opción de pegar imagen en carga de comprobante:**
  - El componente de subida de comprobante ahora muestra dos botones: **"Adjuntar"** (foto o PDF) y **"Pegar imagen"** (del portapapeles).
  - En desktop también se puede pegar con Ctrl+V / Cmd+V en la zona de upload.
  - En mobile el usuario puede copiar la captura y tocar "Pegar imagen".
  - Archivos: `components/payment-proof-upload.tsx`

## Sesión 11

- **Layout responsive de asistentes en admin de evento (mobile vertical):**
  - En pantallas angostas (< 640px), cada fila de asistente ahora se apila verticalmente: nombre completo y detalles de pago arriba, badges (Combo, Comprobante, Pagó/Pendiente) y botones abajo.
  - Se eliminó la clase `truncate` del nombre del asistente para que nunca se corte con "...".
  - En pantallas más anchas (>= 640px, incluido mobile horizontal) el layout vuelve al formato horizontal original.
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`

## Sesión 12

- **Fix desfase horario al crear/editar eventos (drift de -3h por guardado):**
  - Causa: el input `datetime-local` envía `"2026-04-17T23:00"` sin timezone. En Vercel (servidor UTC), `new Date("2026-04-17T23:00")` lo interpreta como 23:00 UTC en vez de 23:00 Argentina (UTC-3). Cada vez que se editaba y guardaba, la hora se corría 3 horas hacia atrás.
  - Fix API (POST y PATCH): se agrega offset explícito `-03:00` al parsear la fecha → `new Date(date + ":00-03:00")`
  - Fix edit page (`toDatetimeLocal`): se reemplazó `d.getHours()`/`d.getMinutes()` (dependiente del timezone del browser) por `Intl.DateTimeFormat` con `timeZone: "America/Argentina/Buenos_Aires"` explícito
  - Archivos: `api/events/route.ts`, `api/events/[id]/route.ts`, `admin/(protected)/events/[id]/edit/page.tsx`

## Sesión 13

- **Layout responsive del dashboard admin para mobile:**
  - Botones del header ("Actualizar", "Nuevo combo", "Nuevo evento") ahora se apilan debajo del título en mobile. Texto abreviado ("combo" / "evento") en pantallas angostas.
  - Tarjetas de eventos y combos: removido `truncate` de los títulos para que se muestren completos. Layout vertical en mobile (título arriba, stats abajo), horizontal en desktop.
  - Archivos: `app/admin/(protected)/page.tsx`
- **Layout responsive del editor de tramos por fecha:**
  - Los campos "Paga hasta el" y "Precio (ARS)" se apilan con `flex-wrap` en pantallas angostas en vez de superponerse.
  - Archivos: `components/date-tiers-editor.tsx`
- **Ocultar "Monto base / fallback" en modo "Por fecha":**
  - El campo era redundante: el tramo "Resto (después de todas las fechas)" ya cumple la misma función de catch-all.
  - En modo "Por fecha", el campo se reemplaza por un `<input type="hidden" value="0">`. En modo "Precio fijo" y "Por cantidad" sigue visible.
  - Archivos: `app/admin/(protected)/events/new/page.tsx`, `app/admin/(protected)/events/[id]/edit/page.tsx`

## Sesión 14

- **Gestión de gastos desde el admin:** el admin ahora puede agregar/editar gastos directamente desde el panel del evento (antes solo se podían cargar desde la página pública).
  - Se reutiliza `ExpenseForm` con nueva prop `compact` que renderiza el botón outline chico (mismo estilo que "Agregar asistente") en lugar del bloque dashed grande. En la página pública sigue con el estilo grande original.
  - En admin, el `responsible` se muestra como dropdown con los asistentes confirmados (orden alfabético) para garantizar que el nombre matchee con los usados en el cálculo de balance.
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`, `components/expense-form.tsx`
- **Alias/CBU opcional en gastos:** quien carga un gasto puede incluir su alias o CBU para que el admin sepa a dónde transferirle, sin tener que pedírselo por WhatsApp.
  - Nueva columna `payment_alias text` en `expenses` (migración: `drizzle/0004_add_payment_alias.sql`)
  - Input disponible tanto al crear como al editar el gasto (sin sufijo "(opcional)" para incentivar la carga).
  - En la lista del admin se muestra debajo del responsable como `Transferir a: <alias>` en azul con font monospace.
  - Archivos: `db/schema.ts`, `app/api/expenses/route.ts`, `app/api/expenses/[id]/route.ts`, `components/expense-form.tsx`, `components/edit-expense-button.tsx`, `app/admin/(protected)/events/[id]/page.tsx`
- **Comprobante (recibo/ticket) del gasto:** el que adelanta un gasto puede subir la foto/PDF del comprobante al cargarlo.
  - Nueva columna `receipt_url text` en `expenses` (migración: `drizzle/0005_add_expense_receipt_url.sql`)
  - Nuevo bucket de Storage `expense-receipts` (público) — **separado** del bucket `event-banners` donde viven los comprobantes de pago, para distinguir conceptualmente entre ingresos (pagos de asistentes) y egresos (gastos del evento).
  - Nuevo endpoint `app/api/upload-expense-receipt/route.ts` (sin auth, análogo a `upload-proof`: validación de tipo/tamaño, sube al bucket, devuelve URL pública).
  - Nuevo componente `components/expense-receipt-upload.tsx`: dos botones dashed "Adjuntar comprobante" y "Pegar imagen" (también soporta paste con Ctrl+V en la zona). Al subir, se reemplaza por un chip verde "Comprobante cargado (ver)" con X para quitarlo.
  - El comprobante se ve solo en la vista admin como badge azul **Comprobante** clickeable (mismo estilo que el badge de comprobantes de pago de asistentes). NO se muestra en la página pública.
  - Archivos: `db/schema.ts`, `lib/supabase-storage.ts` (constante `EXPENSE_RECEIPTS_BUCKET`), `app/api/upload-expense-receipt/route.ts`, `app/api/expenses/route.ts`, `app/api/expenses/[id]/route.ts`, `components/expense-receipt-upload.tsx`, `components/expense-form.tsx`, `components/edit-expense-button.tsx`, `app/admin/(protected)/events/[id]/page.tsx`

## Sesión 15

- **Fix overflow de botones en mobile (panel admin de evento):**
  - El header con botones ("Actualizar", "Exportar CSV", "Cerrar inscripciones", "Editar", "Eliminar") desbordaba la pantalla en mobile vertical.
  - Fix: div exterior `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`, div interior `flex flex-wrap items-center gap-2`.
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`
- **Quitar card "No van" del panel de evento:**
  - Se eliminó la tercera card de stats (era poco útil porque nadie se anota para no ir).
  - Grid cambiado de `grid-cols-3` a `grid-cols-2` (solo "Confirmaron" y "Pagaron").
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`
- **Dashboard: reemplazar "Total inscriptos" por "Sin pagar":**
  - Nueva card "Sin pagar" muestra el conteo global de confirmados con pago pendiente (en naranja). Más accionable que el total de inscriptos.
  - Nueva query `globalPendingCount`. Se eliminó la query `globalConfirmed` que quedó sin uso.
  - Archivos: `app/admin/(protected)/page.tsx`
- **Dashboard: mostrar balance (recaudado − gastos) por evento:**
  - Cada tarjeta de evento en el dashboard ahora muestra el balance neto en lugar del monto recaudado bruto.
  - Se agrega query de gastos por evento en el `stats` per-event. Balance en verde (positivo) o rojo (negativo).
  - Archivos: `app/admin/(protected)/page.tsx`
- **"Se les debe devolver": alias/CBU + botón saldado + sección ya saldados:**
  - En la sección "Se les debe devolver" del Resumen, cada acreedor muestra su alias/CBU (`Transferir a: …` en azul monospace) si lo cargó al crear el gasto.
  - Botón ✓✓ (ícono solo, tooltip "Marcar como saldado") en la misma línea que el monto. Al hacer click, marca todos sus gastos del evento como `settled = true` y pasa a la sección "Ya saldados" (tachado + botón ↩ para deshacer).
  - Nueva columna `settled boolean NOT NULL DEFAULT false` en tabla `expenses` (migración: `drizzle/0006_add_expense_settled.sql`).
  - Nuevo componente `components/settle-creditor-button.tsx`: togglea `settled` vía PATCH `/api/expenses/[id]`; variante normal (✓✓ verde) y variante saldado (↩ gris).
  - Archivos: `db/schema.ts`, `drizzle/0006_add_expense_settled.sql`, `app/api/expenses/[id]/route.ts`, `components/settle-creditor-button.tsx`, `app/admin/(protected)/events/[id]/page.tsx`

## Sesión 16

- **Fix "Faltan campos requeridos" al editar evento en modo "Por fecha":**
  - Problema: al editar un evento con `date_tiers` (modo "Por fecha") y cambiar la fecha del evento o un tramo, el PATCH devolvía `"Faltan campos requeridos"` aunque todos los campos obligatorios tuvieran datos.
  - Causa: la validación de la API usaba `!payment_amount`, y en modo "Por fecha" el formulario envía `payment_amount: 0` (desde el `<input type="hidden" value="0">` agregado en la sesión 13). `!0 === true` → rechazaba el request.
  - Fix: cambiar la condición a `payment_amount == null` para aceptar `0` como valor válido y solo rechazar `undefined`/`null`.
  - Archivos: `app/api/events/[id]/route.ts`

## Sesión 17

- **Combos cerrados visibles en el dashboard admin:**
  - Antes el dashboard solo mostraba combos con `is_open: true` (en `activeCombos`). Los combos cerrados desaparecían y no había forma de revisarlos sin recordar la URL directa.
  - Fix: nueva sección "Combos cerrados" con opacidad reducida (mismo patrón que "Eventos pasados"), basada en `closedCombos = comboList.filter(c => !c.is_open)`.
  - Archivos: `app/admin/(protected)/page.tsx`
- **Cards "Recaudado/Falta cobrar" y "Balance" visibles en eventos modo "Por fecha":**
  - Problema: en el panel de un evento con `date_tiers` no se mostraban las cards de Recaudado/Falta cobrar ni el Balance del card de Gastos. Sí se mostraban en eventos con precio fijo.
  - Causa: las dos condiciones eran `amount > 0`, y en modo "Por fecha" `payment_amount` es 0 (campo oculto seteado en sesión 13).
  - Fix: cambiar la condición a `(totalCollected + totalPending) > 0` — refleja si hay datos reales sin importar el modo de precio.
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`
- **"Deben pagar" y "Falta cobrar" recalculan según el tramo vigente:**
  - Antes los montos pendientes mostraban el `price_paid` original (capturado al momento de inscribirse). Si el evento ya pasó la última fecha del tramo, el monto adeudado se quedaba desactualizado.
  - Fix: nuevo helper `getOwedPrice()` que para asistentes con pago pendiente usa `calculateDatePrice(event.date_tiers, payment_amount)` (precio del tramo de hoy). Aplica a `totalPending` (card "Falta cobrar") y al cálculo de `eventDebt` en el Resumen ("Deben pagar"). El `totalCollected` sigue usando `price_paid` real (lo que efectivamente se cobró).
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`
- **Layout responsive de inscriptos al combo (mobile vertical):**
  - En el panel admin del combo, en pantallas angostas (< 640px) cada inscripto quedaba con el detalle de pago (`Combo: $X · Pagó ...` y avisos de pago parcial) apretado a la derecha y se rompía verticalmente carácter por carácter.
  - Fix: contenedor de fila pasa de `flex items-center justify-between gap-3` a `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3`. Removido `truncate` del nombre. Mismo patrón usado en `events/[id]/page.tsx` en sesión 11.
  - Archivos: `app/admin/(protected)/combos/[id]/page.tsx`

## Sesión 18 (2026-05-04)

- **Reestructuración de la documentación:** el archivo único `CONTEXTO_COWORK.md` se reemplazó por una estructura modular para que `CLAUDE.md` se cargue automáticamente y solo lo crítico se incluya en cada sesión.
  - Nuevo `CLAUDE.md` lean en la raíz (auto-cargado por Claude Code): proyecto, stack, operativa, gotchas e índice.
  - Nueva carpeta `docs/` con archivos especializados: `ARQUITECTURA.md`, `MIGRACIONES.md`, `CONVENCIONES.md`, `HISTORIAL.md`, `PENDIENTES.md`.
  - `CONTEXTO_COWORK.md` queda como tombstone con punteros a la nueva estructura.
  - Convención: documentar cada sesión nueva al final de `docs/HISTORIAL.md`. Promover patrones reusables a `CONVENCIONES.md` y arquitectura nueva a `ARQUITECTURA.md`.

## Sesión 19 (2026-05-04)

- **Fix "Faltan campos requeridos" al CREAR evento en modo "Por fecha":**
  - Problema: al crear un nuevo evento con `date_tiers` (modo "Por fecha"), el POST devolvía `"Faltan campos requeridos"` aunque todos los campos visibles estuvieran completos.
  - Causa: misma raíz que el bug de la sesión 16, pero en el endpoint de creación. La validación usaba `!payment_amount` y en modo "Por fecha" el formulario envía `payment_amount: 0` (por el `<input type="hidden" value="0">` agregado en sesión 13). `!0 === true` → rechazaba el request.
  - Fix: cambiar la condición a `payment_amount == null` para aceptar `0` como valor válido y solo rechazar `undefined`/`null`. Mismo patrón ya aplicado al PATCH en sesión 16.
  - Nota: el fix de la sesión 16 quedó **incompleto** — solo cubrió el PATCH (`app/api/events/[id]/route.ts`). El POST (`app/api/events/route.ts`) siguió con el bug original hasta esta sesión. Lección: cuando una validación se repita en POST y PATCH, revisar ambas a la vez.
  - Archivos: `app/api/events/route.ts`

## Sesión 20 (2026-05-05)

- **Eventos 3T para dos equipos (A y B):** los eventos 3T pueden asignarse a un equipo (`["A"]`), al otro (`["B"]`), o a ambos (`["A","B"]`). El plantel correspondiente se pre-carga automáticamente como asistentes confirmados al crear el evento.
  - Nueva columna `teams jsonb` en `events` (migración `drizzle/0007_add_event_teams.sql`).
  - Backfill: todos los eventos 3T existentes pasaron a `["A"]`. **Dos excepciones** explícitas se dejaron con `teams = NULL`:
    - `05bd5a32-753b-469d-8117-963f3c1c9d2d` ("3T MASTER + 3T FERRO"): lo creó el Equipo B antes de tener su lista de jugadores; el admin decidirá más adelante qué teams asignarle.
    - `5dd8e676-f2df-446e-877d-4977ba55ff7c` (evento de gasto compartido entre ambos equipos): incluye jugadores de A y B más invitados no-jugadores, todos cargados manualmente. Si se le asignara `["A","B"]` el dropdown público mostraría duplicados (los nombres manuales no coinciden 1:1 con `PLAYERS_A`/`PLAYERS_B`). Sin teams, el dropdown solo muestra los `attendeeNames` ya en DB.
  - `lib/players.ts` reestructurado: ahora exporta `PLAYERS_A` (los 36 originales), `PLAYERS_B` (27 nuevos del Equipo B), y un helper `getPlayersForTeams(teams: string[] | null | undefined): string[]` que devuelve la unión sin duplicados, ordenada alfabéticamente. **Se eliminó el export `PLAYERS`** — todos los consumidores deben usar el helper.
  - `lista-jugadores-beta.xlsx` corregido: la fila de "Diaz Diaz, Arturo Javier" tenía las columnas Apellido y Nombre invertidas; se arreglaron in-place.
  - **API POST de eventos** (`app/api/events/route.ts`): acepta `teams` en el body, lo guarda en la DB, y al pre-cargar attendees usa `getPlayersForTeams(event.teams)` en lugar de la lista global. Si `is_3t` pero `teams` no se manda, default a `["A"]`.
  - **API PATCH de eventos** (`app/api/events/[id]/route.ts`): valida que los `teams` nuevos sean **superset** de los originales — cualquier reducción o swap (ej: A → B, A+B → A) devuelve 400 con mensaje `"Solo podés agregar equipos, no reemplazarlos. Para cambiar de equipo creá un evento nuevo."`. Si se agregan equipos nuevos al evento (ej: A → A+B), se insertan los attendees faltantes con dedup por nombre (no duplica jugadores ya presentes manualmente). Lectura previa del estado para detectar transiciones de teams.
  - **API pública by-slug** (`app/api/events/by-slug/[slug]/route.ts`): expone el campo `teams` para que la página pública sepa qué dropdown de jugadores mostrar.
  - **Formulario nuevo evento** (`app/admin/(protected)/events/new/page.tsx`): selector con tres botones excluyentes "Equipo A | Equipo B | A + B", visible solo cuando el checkbox 3T está marcado. Default: `["A"]`.
  - **Formulario editar evento** (`app/admin/(protected)/events/[id]/edit/page.tsx`): mismo selector con **botones disabled según las reglas de superset** — si el evento ya estaba en `["A"]`, el botón "Equipo B" queda deshabilitado (con tooltip "Para cambiar de equipo creá un evento nuevo"); si ya estaba en `["A","B"]`, solo "A + B" queda habilitado. Si el evento tiene `teams = null` (caso del 3T MASTER + 3T FERRO), todas las opciones están habilitadas porque no hay nada que preservar.
  - **Página de confirmación pública** (`app/e/[slug]/confirm/page.tsx`): el dropdown "¿quién sos?" usa `getPlayersForTeams(event.teams)` en vez de la lista global. Para eventos con `teams = null`, el helper devuelve `[]` y el dropdown muestra solo los `attendeeNames` (asistentes ya cargados manualmente) — útil para el caso del 3T MASTER + 3T FERRO.
  - Archivos: `lib/players.ts`, `db/schema.ts`, `drizzle/0007_add_event_teams.sql`, `app/api/events/route.ts`, `app/api/events/[id]/route.ts`, `app/api/events/by-slug/[slug]/route.ts`, `app/admin/(protected)/events/new/page.tsx`, `app/admin/(protected)/events/[id]/edit/page.tsx`, `app/e/[slug]/confirm/page.tsx`, `lista-jugadores-beta.xlsx`.

## Sesión 21 (2026-05-14)

- **Fix tramos de precio por fecha usaban UTC en vez de hora Argentina:** `new Date().toISOString().slice(0, 10)` devuelve la fecha en UTC, lo que hacía que a partir de las 21:00 hora argentina el sistema considerara que ya era el día siguiente. Los tramos se vencían 3 horas antes de lo esperado.
  - Nueva función `todayArg()` en `lib/pricing.ts`: usa `toLocaleString` con `timeZone: "America/Argentina/Buenos_Aires"` para devolver `YYYY-MM-DD` en hora local argentina. Funciona tanto en Vercel (UTC) como en desarrollo local.
  - Se reemplazaron los 6 usos de `new Date().toISOString().slice(0, 10)` por `todayArg()` en: `lib/pricing.ts` (`calculateDatePrice` y `getDateTierLabel`), `app/e/[slug]/page.tsx`, `app/combo/[slug]/page.tsx`, `app/admin/(protected)/events/[id]/page.tsx`, `app/admin/(protected)/combos/[id]/page.tsx`.
  - Decisión: los tramos siempre vencen a medianoche hora Argentina, sin importar la ubicación del usuario.

## Sesión 22 (2026-05-14)

- **Nueva vista de pendientes de pago (`/admin/pendientes`):** página que muestra todos los confirmados con pago pendiente, agrupados por evento, con tarjetas resumen de monto pendiente y total cobrado (solo de los eventos con pendientes).
  - Eventos ordenados por fecha descendente (más lejano primero).
  - Eventos pasados con pendientes se muestran con opacidad reducida.
  - Archivos: `app/admin/(protected)/pendientes/page.tsx`
- **Tarjeta "Sin pagar" del dashboard ahora es clickeable:** linkea a `/admin/pendientes`. Usa `<Link>` de Next.js envolviendo un `<div>` con estilos manuales (no el componente `<Card>` de shadcn, que bloqueaba el click).
  - Archivos: `app/admin/(protected)/page.tsx`
- **Tarjeta "Eventos" del dashboard mejorada:** ahora muestra el total de eventos creados con desglose "X próximos · Y pasados" en vez de solo los activos.
  - Archivos: `app/admin/(protected)/page.tsx`

## Sesión 23 (2026-05-15)

- **Fix layout formulario de gastos en mobile:** los campos "Descripción" y "Quién pagó" estaban en `grid-cols-2` fijo, causando overflow horizontal en pantallas angostas. Ahora usan `grid-cols-1 sm:grid-cols-2` (apilados en mobile, side-by-side en desktop). Aplica tanto al formulario de agregar gasto como al de editar.
  - Archivos: `components/expense-form.tsx`, `components/edit-expense-button.tsx`
- **Fix dropdown "quién pagó" en edición de gastos:** al editar un gasto desde admin, el campo "Responsable" era siempre un input de texto libre, permitiendo ingresar nombres que no se linkeaban con asistentes. Ahora `EditExpenseButton` recibe `attendeeNames` y muestra un `<select>` con la lista de asistentes confirmados, igual que el formulario de nuevo gasto.
  - Archivos: `components/edit-expense-button.tsx`, `app/admin/(protected)/events/[id]/page.tsx`
- **Dropdown "quién pagó" en vista pública:** antes solo se mostraba para eventos 3T. Ahora todos los eventos con asistentes confirmados muestran el `<select>` en vez de texto libre, evitando que se carguen gastos con nombres que no coinciden con los asistentes.
  - Archivos: `app/e/[slug]/page.tsx`
- **Mejor distribución de gastos en admin:** el monto ahora va junto al nombre del gasto en la misma línea, y los botones de acción (Comprobante, editar, borrar) quedan a la derecha. Aprovecha mejor el espacio en mobile.
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`

## Sesión 24 (2026-05-18)

- **Fix: permitir subir comprobante de combo cuando un evento individual ya pasó:** cuando un evento del combo estaba cerrado/completo, la página pública bloqueaba completamente el acceso al formulario de pago — incluso para usuarios ya registrados que solo necesitaban subir el comprobante. Se reordenó la validación en el backend para que usuarios existentes puedan acceder a sus datos de pago sin ser bloqueados por la validación de evento abierto/capacidad (que solo aplica a registros nuevos). En el frontend se agregó un botón secundario "Ya me anoté, quiero subir el comprobante" visible cuando algún evento está completo pero el combo sigue abierto.
  - Archivos: `app/api/combo-attendees/route.ts`, `app/combo/[slug]/page.tsx`

## Sesión 25 (2026-05-18)

- **Ordenamiento de asistentes en admin:** la lista de asistentes en la vista de detalle del evento ahora se puede ordenar por nombre (A-Z, default), fecha de confirmación o fecha de pago, con toggle ascendente/descendente. Se implementó como componente client `SortableAttendeeList` con pills de selección. Los que no subieron comprobante van al final cuando se ordena por pago. Las fechas se pre-formatean en el server para evitar hydration mismatch por diferencias de Intl entre Node y browser.
  - Archivos: `components/sortable-attendee-list.tsx` (nuevo), `app/admin/(protected)/events/[id]/page.tsx`

## Sesión 26 (2026-05-19)

- **Fix: permitir subir comprobante en evento cerrado si ya estás inscripto:** el endpoint `POST /api/attendees` chequeaba `is_open` antes de buscar si el asistente ya existía, bloqueando a asistentes confirmados que solo querían subir su comprobante de pago. Se reordenó la validación: primero busca asistente existente (y devuelve sus datos de pago), y solo después bloquea inscripciones nuevas si el evento está cerrado.
  - Archivos: `app/api/attendees/route.ts`

## Sesión 27 (2026-05-19)

- **Fix: pendientes de pago muestra precio actualizado según tramo vigente:** la página de pendientes mostraba el `price_paid` guardado al momento de inscripción, que podía corresponder a un tramo anterior ya vencido. Ahora recalcula el monto usando `calculateDatePrice()` con la fecha actual, tanto para eventos con `date_tiers` propios como para asistentes registrados vía combo (usando los `date_tiers` del combo y dividiendo por la cantidad de eventos).
  - Archivos: `app/admin/(protected)/pendientes/page.tsx`

## Sesión 28 (2026-05-21)

- **Fix: tarjeta "Falta cobrar" descuenta gastos de asistentes pendientes:** el total de "Falta cobrar" en el detalle de evento sumaba el precio bruto de cada asistente impago, sin descontar los gastos que adelantaron. Ahora resta los gastos de cada persona (usando `expenseByPerson`) antes de sumar, consistente con el neto que ya mostraba el Resumen.
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`

## Sesión 29 (2026-05-22)

- **Feat: precio reducido para jugadores de inferiores:** en eventos no-3T (asados), el admin puede habilitar un precio inferiores desde el formulario de crear/editar evento. Cuando está habilitado, los jugadores de categorías menores pueden marcarse como "inferiores" al inscribirse y pagan un monto fijo menor, independiente del modo de pricing del evento. El admin puede ver y editar el flag de inferiores desde la lista de asistentes, y el cálculo de "Falta cobrar" contempla el monto reducido.
  - DB: nuevas columnas `events.inferiores_price` (numeric, nullable) y `attendees.is_inferiores` (boolean, default false). Migración 7.
  - Archivos: `db/schema.ts`, `app/api/events/route.ts`, `app/api/events/[id]/route.ts`, `app/api/events/by-slug/[slug]/route.ts`, `app/api/attendees/route.ts`, `app/api/attendees/[id]/route.ts`, `app/api/events/[id]/export/route.ts`, `app/admin/(protected)/events/new/page.tsx`, `app/admin/(protected)/events/[id]/edit/page.tsx`, `app/admin/(protected)/events/[id]/page.tsx`, `app/e/[slug]/page.tsx`, `app/e/[slug]/confirm/page.tsx`, `components/toggle-inferiores-button.tsx` (nuevo), `components/sortable-attendee-list.tsx`, `docs/MIGRACIONES.md`

## Sesión 30 (2026-05-22)

- **Fix: eventos pasados se muestran con el más reciente arriba:** la API devuelve eventos ordenados por fecha ASC, y los próximos se revertían para mostrar el más cercano primero, pero los pasados quedaban sin revertir (el más antiguo arriba). Se agregó `.reverse()` a la lista de pasados.
  - Archivos: `app/admin/(protected)/page.tsx`
- **Limpieza formulario de eventos:** se removieron los campos "WhatsApp para comprobantes" y "Habilitar envío de comprobante por WhatsApp" de los formularios de crear y editar evento (ya no se usan). Se reubicó la opción de precio inferiores debajo de los tramos de precio y antes de CBU/Alias.
  - Archivos: `app/admin/(protected)/events/new/page.tsx`, `app/admin/(protected)/events/[id]/edit/page.tsx`

## Sesión 31 (2026-05-26)

- **Fix: año visible en fechas del dashboard y pendientes:** el formato de fecha no mostraba el año, lo que generaba confusión cuando había eventos de distintos años (ej: un evento de 2025 parecía reciente). Se agregó `year: "numeric"` al `Intl.DateTimeFormat` de ambas páginas.
  - Archivos: `app/admin/(protected)/page.tsx`, `app/admin/(protected)/pendientes/page.tsx`
- **Fix: pendientes de pago descuenta gastos adelantados por persona:** la página de pendientes mostraba el precio bruto del evento sin descontar los gastos que el asistente adelantó. Ahora consulta los `expenses` de cada evento, cruza por nombre del responsable, y muestra el saldo neto (precio − gastos). Si el neto es 0 o negativo, la persona no aparece en pendientes. Incluye desglose visible ("$35.000 − $18.000 gastos").
  - Archivos: `app/admin/(protected)/pendientes/page.tsx`

## Sesión 32 (2026-05-28)

- **Fix: build de Vercel roto desde sesión 30 (6 días sin deploy):** los cambios de las sesiones 30 y 31 nunca llegaron a producción porque el build fallaba con dos errores de TypeScript que `next lint` no detecta (solo aparecen con `next build`).
  - Error 1: `edit/page.tsx:104` — `event.whatsapp_number` con `event` posiblemente `null`. Al remover los campos de WhatsApp del form en sesión 30, quedó la referencia en `handleSubmit`. Fix: reemplazar por `"0"` (valor fijo, igual que el form de crear).
  - Error 2: `pendientes/page.tsx:152` — `Map.values()` no es iterable con el target de TypeScript del proyecto. Fix: envolver en `Array.from()`.
  - Lección: **siempre correr `npx next build` antes de pushear**, no solo `npx next lint`. El lint no cubre errores de tipos que sí rompen el build en Vercel.
  - Archivos: `app/admin/(protected)/events/[id]/edit/page.tsx`, `app/admin/(protected)/pendientes/page.tsx`

## Sesión 33 (2026-05-28)

- **Botón "Enviar lista por WhatsApp" en página de confirmación:** al anotarse a un evento, el asistente ve un botón para compartir la lista numerada de confirmados por WhatsApp. Genera un mensaje formateado con título, fecha, lista numerada en orden de inscripción, y un llamado a anotarse desde el link (no por WhatsApp).
  - Nuevo componente `components/whatsapp-list-button.tsx`: botón verde que abre `wa.me` con el mensaje pre-armado listo para enviar al grupo que el usuario elija.
  - El botón aparece solo después de confirmar asistencia (en la pantalla de pago), no en la página pública del evento, para evitar que se comparta antes de anotarse.
  - La API `events/by-slug/[slug]` ahora devuelve `date`, `slug`, y ordena `attendeeNames` por `created_at` ASC (orden de inscripción).
  - La página de confirmación re-fetchea los datos del evento después de confirmar, para que la lista incluya al recién anotado.
  - La sección "¿Quiénes van?" en la página pública ahora muestra los nombres numerados por orden de inscripción (antes era alfabético).
  - Archivos: `components/whatsapp-list-button.tsx` (nuevo), `app/e/[slug]/confirm/page.tsx`, `app/e/[slug]/page.tsx`, `app/api/events/by-slug/[slug]/route.ts`

## Sesión 34 (2026-05-29)

- **Fix: quitar números de la sección "¿Quiénes van?" en link público:** la sesión 33 agregó números (1. Salcha, 2. Agusto…) a los chips de asistentes en la página pública. Se removieron para dejar solo los nombres, ya que los números son para la lista de WhatsApp, no para la UI.
  - Archivos: `app/e/[slug]/page.tsx`

- **Mejora: convocatoria WhatsApp del admin incluye lista de confirmados:** el botón "Enviar convocatoria por WhatsApp" del panel admin ahora genera un mensaje con la misma estructura que el botón del link público: emojis de hockey/asado (🏑🍖🥗), lista numerada de confirmados, y precios/cupo. Antes solo mostraba el conteo de confirmados sin nombres.
  - Archivos: `components/whatsapp-invite-button.tsx`, `app/admin/(protected)/events/[id]/page.tsx`

## Sesión 35 (2026-05-29)

- **Feat: soporte para gastos pagados por personas que no son asistentes:** antes solo se podía asignar un gasto a un asistente confirmado del evento. Ahora el select del formulario de gastos (crear y editar) incluye la opción "Otra persona (no asistente)" que muestra un input de texto libre para el nombre.
  - En el balance del admin, los pagadores externos aparecen en una sección separada "Pagaron sin ser asistentes" con alias de pago y botón de saldar.
  - En el resumen de saldos (cuota por persona), los externos no se cuentan como participantes para la división — la cuota se reparte solo entre asistentes reales. Los compradores externos se muestran con el tag "(no asistente)".
  - No requiere migración de DB: el campo `responsible` ya era texto libre.
  - Archivos: `components/expense-form.tsx`, `components/expense-item.tsx`, `app/admin/(protected)/events/[id]/page.tsx`, `components/expense-settlement.tsx`

## Sesión 36 (2026-06-09)

- **Fix: precio del tramo más caro para no-pagadores + auto-marcado de pago por gastos**
  - Para asistentes que no pagaron el evento, el balance ahora usa el precio del tramo más caro (post-evento) en vez del precio asignado al momento de anotarse. Aplica tanto a `date_tiers` (ya usaba `currentTierPrice`) como a `pricing_tiers` (nuevo: `maxPricingTierPrice`).
  - Nueva tarjeta "No pagaron, cubiertos por gastos" en la fila de stats (Confirmaron | Pagaron | No pagaron), visible solo cuando hay casos. "Falta cobrar" ahora excluye estos asistentes del conteo de pendientes.
  - Detalle de acreedores no-pagadores muestra `getOwedPrice` (tramo más caro) en vez de `getPrice` (precio original).
  - Nuevo helper `lib/sync-expense-payment.ts`: sincroniza `payment_status` automáticamente cuando se crea, edita o borra un gasto. Si los gastos de un asistente cubren el precio del evento → marca como `paid`. Si se borran/reducen y no tiene comprobante → revierte a `pending`.
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`, `app/api/expenses/route.ts`, `app/api/expenses/[id]/route.ts`, `lib/sync-expense-payment.ts`

## Sesión 37 (2026-06-09)

- **Fix: sync de pago por gastos al cargar página + badge "Gastó" + lógica de combo corregida**
  - El sync de `payment_status` por gastos (sesión 36) solo corría al crear/editar/borrar gastos. Los gastos pre-existentes no disparaban el sync. Ahora también se ejecuta al cargar la página admin del evento, marcando como "paid" a asistentes cuyos gastos cubren el costo.
  - Nuevo badge amber **"Gastó"** en la lista de asistentes para los cubiertos por gastos (sin comprobante). Reemplaza al badge "Comprobante" que no aplica.
  - Tarjeta de stats "Cubiertos por gastos" ahora usa `coveredByExpensesIds` (asistentes ya marcados como paid por sync) en vez de filtrar desde `unpaid`.
  - **Fix crítico en lógica `paidViaCombo`:** la lógica anterior (`allPaid = todos los registros del combo pagados`) se rompía cuando el sync marcaba como "paid" a asistentes que no pagaron vía combo. Ahora se verifica que todos los registros del combo compartan la **misma `payment_proof_url`** (no nula), lo cual distingue correctamente pago vía combo (misma URL copiada por `upload-proof-url`) vs pago individual (URLs distintas por evento).
  - Documentada la lógica de detección de pago combo en `docs/ARQUITECTURA.md`.
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`, `components/sortable-attendee-list.tsx`

## Sesión 38 (2026-06-09)

- **Distinguir pagos individuales vs combo en panel admin del combo**
  - Cuando un inscripto al combo paga todos los eventos por separado (con comprobantes distintos), ahora se muestra un badge naranja **"Individual"** junto a badges clickeables por cada evento (con link al comprobante respectivo), en vez de mostrar un único "Comprobante" idéntico a quienes pagaron vía combo.
  - Lógica: se comparan las `payment_proof_url` de todos los registros del combo. Si todas difieren y todos están pagados → `paidIndividually = true`.
  - Badges de eventos truncados a 120px con `truncate` para evitar desborde en mobile.
  - Archivos: `app/admin/(protected)/combos/[id]/page.tsx`

## Sesión 39 (2026-06-10)

- **Fix: balance neto descontaba mal gastos de asistentes cubiertos por gastos**
  - Antes: si un asistente sin comprobante tenía gastos ≥ precio del evento, se auto-marcaba como "paid" y el balance mostraba "Le deben $totalGasto" (el total del gasto), en vez de la diferencia gasto − evento.
  - Causa: `eventDebt = 0` para todos los "paid", sin distinguir si pagaron con comprobante o fueron cubiertos por gastos.
  - Fix: se detecta `paidViaExpenses` via `coveredByExpensesIds`. Si fue cubierto por gastos, `eventDebt = getOwedPrice(a)` para que el balance sea `precioEvento - gastos` (diferencia correcta). Si pagó con comprobante, `eventDebt = 0` y se le devuelve el total del gasto.
  - Texto descriptivo actualizado: "gastos $X − evento $Y" para cubiertos por gastos, "pagó evento + $X en gastos" para pagadores con comprobante.
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`, `docs/ARQUITECTURA.md`

## Sesión 40 (2026-06-10)

- **Fix: precio mostrado en lista de asistentes no pagados y cubiertos por gastos**
  - Antes: la lista de asistentes siempre mostraba `price_paid` (precio al anotarse), aunque el balance neto usaba `getOwedPrice` (tramo vigente/más caro). Ej: alguien anotado en el primer tramo ($24.000) seguía mostrando ese precio incluso después de vencido el tramo ($30.000).
  - Fix: se muestra `getOwedPrice(a)` para todo asistente que no haya pagado (`payment_status !== "paid"`) y para los cubiertos por gastos. Solo quienes pagaron con comprobante o combo conservan su `price_paid` original.
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`

## Sesión 41 (2026-06-11)

- **Fix: botones con estado loading que nunca se reseteaba tras `router.refresh()`**
  - `router.refresh()` en Next.js App Router re-fetcha Server Components pero no desmonta Client Components, así que el estado `loading = true` persistía y el botón/badge quedaba trabado mostrando "..." o "Eliminando...".
  - Fix: agregar `setLoading(false)` después de `router.refresh()` en todos los componentes afectados.
  - Archivos: `components/toggle-inferiores-button.tsx`, `components/delete-attendee-button.tsx`, `components/delete-expense-button.tsx`, `components/delete-combo-button.tsx`, `components/delete-event-button.tsx`

## Sesión 42 (2026-06-13)

- **Fix: input de montos interpretaba el punto como separador decimal en vez de miles**
  - Causa: `<input type="number">` en HTML siempre interpreta el punto como decimal. Al escribir "140.000" (formato argentino para 140 mil), el browser lo parseaba como 140.000 = 140. Esto provocó que el evento del PRODE se guardara con `payment_amount = 140` en vez de 140.000.
  - Fix: nuevo componente `CurrencyInput` (`type="text"` con `inputMode="numeric"`) que interpreta el formato argentino (punto = miles, coma = decimal). Muestra un preview verde debajo del input con el valor formateado ("= $140.000") para que el usuario confirme visualmente.
  - Se reemplazó en todos los formularios: evento nuevo/editar (`payment_amount`, `inferiores_price`) y combo nuevo/editar (`payment_amount`).
  - Archivos: `components/currency-input.tsx` (nuevo), `app/admin/(protected)/events/new/page.tsx`, `app/admin/(protected)/events/[id]/edit/page.tsx`, `app/admin/(protected)/combos/new/page.tsx`, `app/admin/(protected)/combos/[id]/edit/page.tsx`

- **Mejora: al editar precio fijo de un evento, actualiza `price_paid` de asistentes no pagados**
  - Antes: cambiar `payment_amount` en el admin solo actualizaba el evento, no los asistentes ya registrados. Si se corregía un precio mal cargado, los asistentes seguían con el precio viejo.
  - Fix: el endpoint PATCH de eventos ahora detecta si el precio cambió en un evento de precio fijo y actualiza `price_paid` de todos los asistentes con `payment_status = "pending"` y sin comprobante.
  - Archivos: `app/api/events/[id]/route.ts`

## Sesión 43 (2026-06-22)

- **Fix: balance incorrecto en Resumen para asistentes con gastos + comprobante de pago**
  - Bug: cuando un asistente tenía gastos < precio del evento y subía comprobante por la diferencia, el sistema asumía que el comprobante cubría el total del evento ($30.000) y mostraba los gastos como crédito extra ("Le deben $X"). En realidad, el gasto era parte del pago del evento.
  - Fix: nueva rama en el cálculo de balance del Resumen: si tiene comprobante + gastos, net = -max(gastos - precioEvento, 0). Si gastos < evento, net = 0 (saldado). Si gastos > evento, solo el exceso es crédito.
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`

- **Mejora: badge "Gastó" visible para todos los asistentes con gastos**
  - Antes: el badge amber "Gastó" solo aparecía en asistentes cubiertos por gastos (sin comprobante, gastos ≥ evento). Ahora aparece en todos los que tienen gastos, independientemente del monto o si tienen comprobante.
  - El badge "Gastó" y "Comprobante" ahora son independientes — un asistente puede mostrar ambos si tiene gastos + comprobante.
  - Nueva prop `hasExpenses` en `AttendeeItem` type.
  - Archivos: `components/sortable-attendee-list.tsx`, `app/admin/(protected)/events/[id]/page.tsx`

## Sesión 44 (2026-06-30)

- **Fix crítico: balance incorrecto para asistentes que pagaron evento + tienen gastos**
  - Bug: la sesión 43 introdujo un caso especial `paidWithProofAndExpenses` que descontaba el precio del evento de los gastos de TODOS los asistentes con comprobante + gastos. Esto era incorrecto para quienes pagaron el evento de forma independiente (vía combo o individual): se les descontaba el evento de sus gastos cuando en realidad ya lo habían pagado aparte.
  - Ejemplo: Alvarez Sly pagó $24k (combo) y gastó $72k → mostraba "Le deben $42k" ($72k - $30k) en vez de "Le deben $72k".
  - Fix: se eliminó el caso especial. La fórmula vuelve a ser la original y correcta: `eventDebt = (paid && !paidViaExpenses) ? 0 : getOwedPrice(a)`. Si pagó (con proof), `eventDebt = 0` y se devuelven todos los gastos. Si fue cubierto por gastos (`paidViaExpenses`), el evento se descuenta.
  - Invariante documentado en ARQUITECTURA.md: pago del evento y gastos son conceptos independientes. No mezclar.
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`, `docs/ARQUITECTURA.md`
