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

---

## Pendientes / ideas futuras