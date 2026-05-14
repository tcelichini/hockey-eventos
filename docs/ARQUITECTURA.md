# Arquitectura — hockey-eventos

Mapa de archivos clave y lógica de negocio del proyecto.

## Archivos clave

| Archivo | Qué hace |
|---|---|
| `db/schema.ts` | Tipos `PricingTier`, `DateTier` y tablas `events`, `attendees`, `expenses`, `combos` |
| `lib/pricing.ts` | Helpers: `todayArg`, `getTierLabel`, `calculatePrice`, `calculateDatePrice`, `getDateTierLabel`, `validateTiers` |
| `lib/players.ts` | Lista estática del plantel (36 jugadores, formato "Apellido, Nombre") |
| `components/pricing-tiers-editor.tsx` | Editor de tramos por cantidad |
| `components/date-tiers-editor.tsx` | Editor de tramos por fecha de pago |
| `components/refresh-button.tsx` | Botón "Actualizar" que llama a `router.refresh()` |
| `components/image-upload.tsx` | Upload con selector de posición (#top/#bottom en URL) |
| `components/whatsapp-invite-button.tsx` | Botón WhatsApp con descripción |
| `components/payment-proof-upload.tsx` | Componente para subir comprobante de pago |
| `components/add-attendee-button.tsx` | Botón inline para agregar asistente manualmente desde admin |
| `app/admin/(protected)/page.tsx` | Dashboard admin general (stats globales, eventos, combos, botón Actualizar) |
| `app/admin/(protected)/events/[id]/page.tsx` | Panel admin del evento (Resumen, Gastos, Asistentes con fecha de comprobante) |
| `app/admin/(protected)/events/new/page.tsx` | Formulario nuevo evento (con selector de tipo de precio) |
| `app/admin/(protected)/events/[id]/edit/page.tsx` | Formulario editar evento (con selector de tipo de precio) |
| `app/admin/(protected)/combos/new/page.tsx` | Formulario nuevo combo |
| `app/admin/(protected)/combos/[id]/page.tsx` | Panel admin del combo |
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

## Combos

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

Para eventos en modo "Por fecha", el `eventDebt` de asistentes pendientes se recalcula con `calculateDatePrice(event.date_tiers, payment_amount)` para reflejar el tramo vigente al día de hoy (no el original al momento de anotarse). El `totalCollected` sigue usando `price_paid` real (lo que efectivamente se cobró).
