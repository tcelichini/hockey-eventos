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
| `components/currency-input.tsx` | Input de montos con formato argentino (punto = miles, coma = decimal) y preview verde |
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

### Flujo de pago del combo

Hay dos formas en que un asistente con `combo_id` puede quedar como "paid":

| Forma de pago | Cómo funciona | Resultado en la DB |
|---|---|---|
| **Vía combo** | Sube comprobante en la página del combo → `upload-proof` guarda la URL en un attendee → `upload-proof-url` copia la **misma URL** a todos los demás attendees del combo | Todos los registros del attendee comparten la **misma** `payment_proof_url` |
| **Individual** | Sube comprobante en la página de cada evento por separado | Cada registro tiene una `payment_proof_url` **distinta** |

### Detección de "pagó vía combo" (`paidViaCombo`)

En el panel admin del evento, se determina si un asistente pagó vía combo comparando las `payment_proof_url` de todos sus registros dentro del combo:

```
paidViaCombo = todos los registros del combo tienen la misma payment_proof_url (no nula)
```

- **Misma URL en todos** → pagó vía combo → badge "Combo" + link al combo
- **URLs distintas** → pagó cada evento individual → solo badge "Comprobante"
- **Sin URL** (marcado manual o cubierto por gastos) → no cuenta como combo

**IMPORTANTE:** Esta lógica depende de que `upload-proof-url` copie exactamente la misma URL. Si se cambia el flujo de pago del combo, esta detección se rompe. No cambiar la lógica de `paidViaCombo` sin entender el flujo completo de pago.

---

## Lógica de balance neto (Resumen admin)

```
net = eventDebt - expPaid

eventDebt = 0                    (si pagó con comprobante o en efectivo — pago independiente)
eventDebt = getOwedPrice(a)      (si no pagó, o si fue cubierto por gastos — para descontar del gasto)
expPaid   = suma de gastos adelantados por esa persona

net > 0 → debe plata (naranja) — aparece en "Deben pagar"
net < 0 → se le debe plata (verde) — aparece en "Se les debe devolver"
net = 0 → al día
```

La distinción clave es `paidViaExpenses` (detectado via `coveredByExpensesIds`): si alguien fue marcado como "paid" por el auto-sync de gastos (sin `payment_proof_url`), `eventDebt` sigue siendo el precio del evento para que el gasto lo cubra y solo se devuelva la diferencia. Si pagó independientemente (con comprobante), `eventDebt = 0` y se le devuelve el total del gasto.

### Precio para no-pagadores (`getOwedPrice`)

Para asistentes que no pagaron se usa el **tramo más caro**, no el precio asignado al anotarse:

| Tipo de evento | Precio usado |
|---|---|
| `date_tiers` | `calculateDatePrice()` con fecha actual (post-evento = catch-all, el más caro) |
| `pricing_tiers` | `Math.max(...)` de todos los tramos |
| Precio fijo | `payment_amount` |
| Inferiores | `inferiores_price` (siempre fijo) |

### Auto-marcado de pago por gastos

Hay dos mecanismos que sincronizan `payment_status` cuando un asistente cubre el costo del evento con gastos:

1. **Al crear/editar/borrar un gasto** (`lib/sync-expense-payment.ts`): se ejecuta desde las APIs de gastos.
2. **Al cargar la página del evento** (`page.tsx`): sincroniza asistentes que quedaron sin marcar (ej: gastos creados antes de que existiera el sync).

Lógica:
- Si total gastos ≥ precio evento → `payment_status = "paid"` (sin necesidad de comprobante)
- Si total gastos < precio evento y no tiene comprobante (`payment_proof_url` es null) → `payment_status = "pending"`
- Si tiene comprobante, nunca se revierte — pagó de verdad

### Badge "Gastó" y tarjeta "Cubiertos por gastos"

Asistentes marcados como "paid" por el sync de gastos (sin `payment_proof_url`, con gastos ≥ `getOwedPrice`):
- En la lista de asistentes muestran badge amber **"Gastó"** en lugar de "Comprobante"
- No muestran badge "Combo" aunque tengan `combo_id`
- Se cuentan en la tarjeta **"Cubiertos por gastos"** (tercera tarjeta junto a "Confirmaron" y "Pagaron")
- No cuentan como pendientes en "Falta cobrar"

Además, se detectan gastos cuyo `responsible` no matchea ningún asistente confirmado y se muestran como **acreedores externos** en la sección "Pagaron sin ser asistentes", con alias de pago y botón de saldar.

En el componente `expense-settlement.tsx` (resumen de saldos público), la cuota por persona se divide solo entre asistentes confirmados — los pagadores externos no inflan el divisor.

El `totalCollected` sigue usando `price_paid` real (lo que efectivamente se cobró).
