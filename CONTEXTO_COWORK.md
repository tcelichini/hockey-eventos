# Contexto de trabajo — hockey-eventos

## Qué es este proyecto
App web para gestionar eventos del equipo de hockey de San Martín. Creada por Tomás Celichini (GitHub: tcelichini). Guillermo (campanaguille@gmail.com / GitHub: gcampana20) colabora con mejoras desde su fork/clon local.

- **Repo:** https://github.com/tcelichini/hockey-eventos
- **App en prod:** https://hockey-eventos.vercel.app
- **Admin:** https://hockey-eventos.vercel.app/admin
- **Carpeta local:** `C:\Users\guill\projects\Eventos Hockey\hockey-eventos`
- **Deploy:** Vercel conectado a la cuenta de Tomás. Cada `git push` a `main` deploya automáticamente.
- **DB:** Supabase (Guillermo ya tiene acceso al proyecto de Tomás)

## Stack técnico
- Next.js 14 App Router (TypeScript)
- Tailwind CSS + shadcn/ui
- Drizzle ORM + PostgreSQL (Supabase)
- Supabase Storage (imágenes)

## Cómo arrancar la sesión de Cowork
1. Abrir Cowork y seleccionar la carpeta: `C:\Users\guill\projects\Eventos Hockey\hockey-eventos`
2. Pegar este archivo como contexto inicial
3. Para correr la app en local: abrir terminal en VSCode, `cd hockey-eventos` si hace falta, luego `npm run dev`
4. App en local: http://localhost:3000 — Admin: http://localhost:3000/admin

## Cómo hacer un commit y push
Desde la terminal de VSCode (siempre con comillas dobles en los paths en Windows CMD):
```bash
git add "ruta/archivo1" "ruta/archivo2"
git commit -m "descripción del cambio"
git pull --rebase && git push
```
Si el push es rechazado (remote has changes), usar `git pull --rebase` antes de `git push`.
Si hay cambios locales sin commitear y necesitás traer cambios del remoto:
```bash
git stash
git pull --rebase
git stash pop
```

## Nota importante sobre worktrees y .env.local
Los git worktrees (usados por Claude Code para trabajar en ramas aisladas) **no copian archivos ignorados por .gitignore**, como `.env.local`. Si se trabaja en un worktree y el admin no acepta la contraseña o la app no conecta a la DB, lo primero que hay que verificar es que exista `.env.local` en el worktree. Solución: copiar el `.env.local` del repo principal al worktree:
```bash
cp "ruta/repo/.env.local" "ruta/worktree/.env.local"
```

## Nota importante sobre archivos truncados
Al editar archivos desde Cowork, pueden quedar truncados o con bytes nulos al final (problema de CRLF/LF en Windows). Antes de hacer commit, conviene correr `npx tsc --noEmit` para detectar archivos rotos. Si aparecen errores de "Invalid character" o "no corresponding closing tag", restaurar el archivo desde HEAD con `git show HEAD:ruta/archivo > ruta/archivo` y re-aplicar los cambios.

---

## Archivos clave

| Archivo | Qué hace |
|---|---|
| `db/schema.ts` | Tipos `PricingTier`, `DateTier` y tablas `events`, `attendees`, `expenses`, `combos` |
| `lib/pricing.ts` | Helpers: `getTierLabel`, `calculatePrice`, `calculateDatePrice`, `getDateTierLabel`, `validateTiers` |
| `components/pricing-tiers-editor.tsx` | Editor de tramos por cantidad |
| `components/date-tiers-editor.tsx` | Editor de tramos por fecha de pago |
| `components/refresh-button.tsx` | Botón "Actualizar" que llama a `router.refresh()` |
| `components/image-upload.tsx` | Upload con selector de posición (#top/#bottom en URL) |
| `components/whatsapp-invite-button.tsx` | Botón WhatsApp con descripción |
| `components/payment-proof-upload.tsx` | Componente para subir comprobante de pago |
| `app/admin/(protected)/page.tsx` | Dashboard admin general (stats globales, eventos, combos, botón Actualizar) |
| `app/admin/(protected)/events/[id]/page.tsx` | Panel admin del evento (Resumen, Gastos, Asistentes con fecha de comprobante) |
| `app/admin/(protected)/events/new/page.tsx` | Formulario nuevo evento (con selector de tipo de precio) |
| `app/admin/(protected)/events/[id]/edit/page.tsx` | Formulario editar evento (con selector de tipo de precio) |
| `app/admin/(protected)/combos/new/page.tsx` | Formulario nuevo combo |
| `app/admin/(protected)/combos/[id]/page.tsx` | Panel admin del combo |
| `lib/players.ts` | Lista estática del plantel (36 jugadores, formato "Apellido, Nombre") |
| `components/add-attendee-button.tsx` | Botón inline para agregar asistente manualmente desde admin |
| `app/api/attendees/route.ts` | API de registro: calcula precio por tramo, por fecha, o fijo; si es 3T encuentra al asistente ya pre-cargado |
| `app/api/events/route.ts` | API POST eventos: guarda `pricing_tiers`, `date_tiers`, `is_3t`; si es 3T inserta todos los jugadores como asistentes confirmados |
| `app/api/events/[id]/route.ts` | API PATCH eventos: actualiza `pricing_tiers`, `date_tiers`, `is_3t` |
| `app/api/events/by-slug/[slug]/route.ts` | API pública: expone `pricing_tiers`, `date_tiers`, `is_3t` |
| `app/api/combos/route.ts` | API POST combos |
| `app/api/combos/[id]/route.ts` | API PATCH/DELETE combos |
| `app/api/combos/by-slug/[slug]/route.ts` | API pública de combos |
| `app/api/upload-proof/route.ts` | API de subida de comprobante (guarda `proof_uploaded_at`) |
| `app/e/[slug]/page.tsx` | Página pública del evento (muestra precios por fecha, tramo o fijo) |
| `app/e/[slug]/resumen/page.tsx` | Página pública de resumen de gastos |
| `app/combo/[slug]/page.tsx` | Página pública del combo |

---

## Tipos de precio (mutuamente excluyentes)

Al crear/editar un evento se elige uno de tres modos:

| Modo | Campo activo | Lógica |
|---|---|---|
| Precio fijo | `payment_amount` | Todos pagan el mismo monto |
| Por cantidad (`pricing_tiers`) | `pricing_tiers: PricingTier[]` | Precio según cuántos confirmados hay al momento de anotarse |
| Por fecha (`date_tiers`) | `date_tiers: DateTier[]` | Precio según la fecha en que se **paga** (no en que se anota) |

### Tipo DateTier
```typescript
type DateTier = {
  until: string | null  // "YYYY-MM-DD", null = catch-all (después de todas las fechas)
  price: number
}
```

### Recálculo al volver a cargar comprobante
Si un asistente ya confirmado (sin pagar) vuelve a la página de confirmación en un evento con `date_tiers`, el sistema **recalcula el precio según la fecha actual** y actualiza `price_paid` en la DB. Si ya pagó, respeta el precio original.

---

## Combos (agregado por Tomás)

Un combo agrupa varios eventos con un precio conjunto (con descuento). El asistente se inscribe a todos los eventos del combo con un solo pago.

### Tabla `combos`
```typescript
{
  id: uuid
  slug: text (único)
  title: text
  description: text | null
  event_ids: jsonb (string[])     // IDs de los eventos incluidos
  date_tiers: jsonb (DateTier[])  // Precios por fecha (misma lógica que eventos)
  payment_amount: numeric         // Precio base del combo
  payment_account: text
  whatsapp_number: text
  whatsapp_confirmation: boolean
  is_open: boolean
  created_at: timestamp
}
```

### Relación con attendees
La tabla `attendees` tiene un campo `combo_id` (nullable) que referencia al combo. Cuando alguien se inscribe a un combo, se crea un registro de attendee por cada evento del combo, todos con el mismo `combo_id`.

---

## Lógica de balance neto (Resumen admin)
```
net = eventDebt - expPaid

eventDebt = 0             (si ya pagó el evento)
eventDebt = price_paid    (si aún no pagó)
expPaid   = suma de gastos adelantados por esa persona

net > 0 → debe plata (naranja) — aparece en "Deben pagar"
net < 0 → se le debe plata (verde) — aparece en "Se les debe devolver"
net = 0 → al día
```

---

## Migraciones SQL (ejecutar en Supabase SQL Editor)

Verificar que estas migraciones se hayan corrido:

```sql
-- Migración 1: precios por fecha en eventos
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "date_tiers" json;

-- Migración 2: fecha de carga de comprobante
ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "proof_uploaded_at" timestamp with time zone;

-- Migración 3: campo is_3t para eventos de Tercer Tiempo
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "is_3t" boolean NOT NULL DEFAULT false;

-- Migración 4: alias/CBU en gastos (para que el admin sepa a dónde transferir al que adelantó el gasto)
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "payment_alias" text;

-- Migración 5: comprobante (recibo/ticket) del gasto
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "receipt_url" text;
-- + crear bucket público "expense-receipts" en Supabase Storage
```

---

## Historial de cambios realizados

### Sesión 1
- **Pricing tiers por cantidad:** fix bug "Resto" duplicado al limpiar campo "Hasta"
- **Etiquetas de tramo:** "Primeros N" → rangos "Del X al Y / Resto"
- **Página pública:** tramos llenos con tachado
- **Imagen del evento:** selector de posición (Arriba/Centro/Abajo), guardado como `#top`/`#bottom` en la URL
- **WhatsApp invite:** descripción del evento, emoji, indicador
- **Admin Resumen:** balance neto por asistente (Deben pagar / Se les debe devolver) para todos los confirmados
- **Admin Gastos:** resumen `Total / personas = c/u` movido al card de Gastos (fuera del Resumen)
- **Botón Actualizar:** `components/refresh-button.tsx` con `router.refresh()`

### Sesión 2
- **Precios por fecha de pago:** nuevo modo de precio en eventos
  - Nuevo tipo `DateTier` en `db/schema.ts`
  - Columna `date_tiers jsonb` en la tabla `events` (migración: `drizzle/0001_add_date_tiers.sql`)
  - Helpers `calculateDatePrice` y `getDateTierLabel` en `lib/pricing.ts`
  - Componente `DateTiersEditor` para el formulario admin
  - Selector "Precio fijo / Por cantidad / Por fecha" en formularios de creación y edición
  - Página pública muestra tramos por fecha con tachado para fechas vencidas
  - API recalcula precio al momento del pago (no del registro)
  - Fix: al volver a cargar comprobante, recalcula precio según fecha actual

### Cambios de Tomás
- **Combos:** sistema completo de combos (descuento por pago conjunto de múltiples eventos)
  - Nueva tabla `combos` en `db/schema.ts`
  - Campo `combo_id` en tabla `attendees`
  - CRUD completo: admin/combos/new, admin/combos/[id], API combos
  - Página pública `/combo/[slug]`
  - Dashboard admin muestra combos activos
  - Fix: errores de lint en date-tiers-editor que rompían el build

### Sesión 3
- **Fix archivos truncados:** 4 archivos (edit/page, new/page, refresh-button, date-tiers-editor) estaban cortados desde la sesión anterior, causando que el build de Vercel fallara silenciosamente
- **Fecha de carga de comprobante:** nueva columna `proof_uploaded_at` en attendees
  - Migración: `drizzle/0002_add_proof_uploaded_at.sql`
  - API `upload-proof` guarda el timestamp al subir comprobante
  - Lista de Asistentes en admin muestra "Pagó [fecha]" en verde junto a la fecha de confirmación
- **Botón Actualizar en dashboard:** agregado al panel general de admin (junto a "Nuevo combo" y "Nuevo evento")

### Sesión 4
- **Eventos 3T (Tercer Tiempo):** nuevo tipo de evento con asistencia obligatoria para todo el plantel
  - Campo `is_3t boolean` en tabla `events` (migración: `drizzle/0003_add_is_3t.sql`)
  - `lib/players.ts`: lista estática de 37 jugadores en formato "Apellido, Nombre"
  - Al crear un evento 3T, la API inserta automáticamente todos los jugadores como asistentes confirmados con `payment_status: pending`
  - Checkbox "🍖 Tercer Tiempo (3T)" en formularios de creación y edición, posicionado arriba de imagen/fecha
  - Página pública: banner "Asistencia obligatoria para todo el plantel" + botón "🧾 Subir comprobante de pago" (sin botón "No puedo ir")
  - Página `/confirm`: dropdown con los jugadores (Apellido, Nombre) en lugar de campo de texto libre
  - Panel admin: orden alfabético en secciones Asistentes y Resumen (`.orderBy(attendees.full_name)`)
  - Nuevo componente `add-attendee-button.tsx`: permite al admin agregar un asistente manualmente (inline) desde el panel del evento

### Sesión 5
- **Actualización de plantel:** `lib/players.ts` actualizado de 37 a 36 jugadores
  - Salen: Battipede Octavio, Crovetto Jorge, Erriquenz Juan Pablo, Ponce Julian, Salas Pedro, Solari Matias
  - Entran: Aguiar Franco Nicolás, Díaz Santiago, Salerno Picasso Lorenzo, Santoro Franco, Ugarte Joaquín

### Sesión 6
- **Fix desfase horario de 3 horas:** todas las fechas se mostraban con hora UTC en producción (Vercel)
  - Causa: `Intl.DateTimeFormat("es-AR", ...)` sin `timeZone` explícito
  - Fix: se agregó `timeZone: "America/Argentina/Buenos_Aires"` en 10 instancias de `DateTimeFormat` en 8 archivos
  - Archivos afectados: `whatsapp-invite-button.tsx`, `e/[slug]/page.tsx`, `combo/[slug]/page.tsx`, `admin/page.tsx`, `admin/events/[id]/page.tsx`, `admin/combos/[id]/page.tsx`, `api/events/[id]/export/route.ts`, `event-selector.tsx`
- **Fecha de comprobante en combos:** la vista admin del combo ahora muestra "Pagó [fecha]" en verde (usa `proof_uploaded_at`), igual que en eventos individuales

### Sesión 7
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

### Sesión 8
- **Fix asistentes manuales no visibles en link público de eventos individuales:**
  - Problema: en eventos 3T, el dropdown del confirm page solo mostraba nombres de la lista estática `PLAYERS`. Los asistentes agregados manualmente por el admin (ej: Erriquenz, Juan Pablo) no aparecían y no podían subir su comprobante de pago.
  - Fix: la API `events/by-slug/[slug]` ahora devuelve `attendeeNames` (nombres de asistentes confirmados). El dropdown combina `PLAYERS` + asistentes de la DB que no estén en la lista, ordenados alfabéticamente.
  - Archivos: `api/events/by-slug/[slug]/route.ts`, `app/e/[slug]/confirm/page.tsx`
- **Orden alfabético en "¿Quiénes van?" del link público:**
  - La lista de asistentes confirmados en la página pública del evento ahora se muestra ordenada alfabéticamente.
  - Archivos: `app/e/[slug]/page.tsx`

### Sesión 9
- **Dropdown de jugadores en "Cargar gasto" para eventos 3T:**
  - En eventos de tipo 3T, el formulario de carga de gastos ahora muestra un **menú desplegable** con los nombres de todos los asistentes confirmados (orden alfabético) en lugar del campo de texto libre "Tu nombre".
  - El dropdown incluye asistentes agregados manualmente por el admin (no solo la lista estática de PLAYERS).
  - En eventos no-3T, el formulario sigue igual: input de texto libre con el mensaje "Usá el mismo nombre con el que te anotaste".
  - Archivos: `components/expense-form.tsx`, `app/e/[slug]/page.tsx`

### Sesión 10
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

### Sesión 11
- **Layout responsive de asistentes en admin de evento (mobile vertical):**
  - En pantallas angostas (< 640px), cada fila de asistente ahora se apila verticalmente: nombre completo y detalles de pago arriba, badges (Combo, Comprobante, Pagó/Pendiente) y botones abajo.
  - Se eliminó la clase `truncate` del nombre del asistente para que nunca se corte con "...".
  - En pantallas más anchas (>= 640px, incluido mobile horizontal) el layout vuelve al formato horizontal original.
  - Archivos: `app/admin/(protected)/events/[id]/page.tsx`

### Sesión 12
- **Fix desfase horario al crear/editar eventos (drift de -3h por guardado):**
  - Causa: el input `datetime-local` envía `"2026-04-17T23:00"` sin timezone. En Vercel (servidor UTC), `new Date("2026-04-17T23:00")` lo interpreta como 23:00 UTC en vez de 23:00 Argentina (UTC-3). Cada vez que se editaba y guardaba, la hora se corría 3 horas hacia atrás.
  - Fix API (POST y PATCH): se agrega offset explícito `-03:00` al parsear la fecha → `new Date(date + ":00-03:00")`
  - Fix edit page (`toDatetimeLocal`): se reemplazó `d.getHours()`/`d.getMinutes()` (dependiente del timezone del browser) por `Intl.DateTimeFormat` con `timeZone: "America/Argentina/Buenos_Aires"` explícito
  - Archivos: `api/events/route.ts`, `api/events/[id]/route.ts`, `admin/(protected)/events/[id]/edit/page.tsx`

### Sesión 13
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

### Sesión 14
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

### Sesión 15
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

---

## Pendientes / ideas futuras