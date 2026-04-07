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

---

## Archivos clave

| Archivo | Qué hace |
|---|---|
| `db/schema.ts` | Tipos `PricingTier`, `DateTier` y columnas de la tabla `events` |
| `lib/pricing.ts` | Helpers: `getTierLabel`, `calculatePrice`, `calculateDatePrice`, `getDateTierLabel`, `validateTiers` |
| `components/pricing-tiers-editor.tsx` | Editor de tramos por cantidad |
| `components/date-tiers-editor.tsx` | Editor de tramos por fecha de pago |
| `components/refresh-button.tsx` | Botón "Actualizar" que llama a `router.refresh()` |
| `components/image-upload.tsx` | Upload con selector de posición (#top/#bottom en URL) |
| `components/whatsapp-invite-button.tsx` | Botón WhatsApp con descripción, ⚽, 👉 |
| `components/expense-settlement.tsx` | Versión simple: cuota por persona y quién compró |
| `app/admin/(protected)/events/[id]/page.tsx` | Panel admin del evento (Resumen, Gastos, Asistentes) |
| `app/admin/(protected)/events/new/page.tsx` | Formulario nuevo evento (con selector de tipo de precio) |
| `app/admin/(protected)/events/[id]/edit/page.tsx` | Formulario editar evento (con selector de tipo de precio) |
| `app/api/attendees/route.ts` | API de registro: calcula precio por tramo, por fecha, o fijo |
| `app/api/events/route.ts` | API POST eventos: guarda `pricing_tiers` y `date_tiers` |
| `app/api/events/[id]/route.ts` | API PATCH eventos: actualiza `pricing_tiers` y `date_tiers` |
| `app/api/events/by-slug/[slug]/route.ts` | API pública: expone `pricing_tiers` y `date_tiers` |
| `app/e/[slug]/page.tsx` | Página pública del evento (muestra precios por fecha, tramo o fijo) |
| `app/e/[slug]/resumen/page.tsx` | Página pública de resumen de gastos |

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

## Historial de cambios realizados

### Sesión 1
- **Pricing tiers por cantidad:** fix bug "Resto" duplicado al limpiar campo "Hasta"
- **Etiquetas de tramo:** "Primeros N" → rangos "Del X al Y / Resto"
- **Página pública:** tramos llenos con tachado
- **Imagen del evento:** selector de posición (Arriba/Centro/Abajo), guardado como `#top`/`#bottom` en la URL
- **WhatsApp invite:** descripción del evento, emoji ⚽, indicador 👉
- **Admin Resumen:** balance neto por asistente (Deben pagar / Se les debe devolver) para todos los confirmados
- **Admin Gastos:** resumen `Total ÷ personas = c/u` movido al card de Gastos (fuera del Resumen)
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

---

## Pendientes / ideas futuras
- (agregar acá próximas tareas)
