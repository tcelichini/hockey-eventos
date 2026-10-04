# Arquitectura — hockey-eventos

Mapa de archivos clave y lógica de negocio del proyecto.

## Archivos clave

| Archivo | Qué hace |
|---|---|
| `db/schema.ts` | Tipos `PricingTier`, `DateTier` y tablas `events`, `attendees`, `expenses`, `combos`, `people`, `person_phones` |
| `lib/settlement.ts` | **Módulo de Liquidación** (puro, con tests): `settleEvent`, `getOwedPrice`, `normalizeName`. Ver CONTEXT.md |
| `lib/settlement.test.ts` | Tests de la liquidación (`npm run test`, Vitest) |
| `lib/combo-payment.ts` | `classifyComboPayment`: detección de "pagó vía combo" (badge, display) |
| `lib/cuenta-corriente.ts` | `consolidateAccounts` (puro, con tests): saldo across eventos, por Persona si el asistente tiene una (`personKey`) y por nombre si no. Ver CONTEXT.md |
| `lib/cuenta-corriente-query.ts` | Fetch + settleEvent por evento + consolidación (compartido por admin y API pública) |
| `app/admin/(protected)/cuentas/page.tsx` | Página admin de cuenta corriente (deudores/acreedores consolidados + recordatorio WhatsApp con link a `/mi-cuenta`) |
| `app/mi-cuenta/page.tsx` | Consulta pública: el jugador elige su nombre (o llega con `?nombre=`) y ve solo su saldo; cada evento que debe es una card que lleva a subir el comprobante de ese evento |
| `app/api/cuenta/route.ts` | API pública de cuenta corriente: lista de cuentas (`key` + nombre) y saldo de una cuenta (`?key=`; `?name=` para links viejos) |
| `lib/people.ts` | **Módulo de Personas** (puro, con tests): `normalizePhone`, `decideRegistration`, `proofOrigin`, `mergeConflicts`, `parseImportList`, `planImport`. Ver CONTEXT.md y la sección "Personas" más abajo |
| `lib/people-db.ts` | Lecturas de Personas: `findPeopleByPhone`, `getPeopleDirectory` (admin) |
| `lib/attendee-registration.ts` | Piezas compartidas al anotar (por nombre, por celular, desde admin): precio de un anotado nuevo y datos de pago |
| `components/phone-registration.tsx` | Flujo público de anotarse con celular (eventos con `requires_phone`) |
| `app/admin/(protected)/personas/page.tsx` | Sección Personas del admin (`components/people-manager.tsx`): listar, editar, fusionar, crear, importar |
| `app/api/people/` | `lookup` (pública: quién se anotó con este celular) y admin: crear, editar/borrar, `merge`, `import` |
| `app/api/events/[id]/attendees/route.ts` | Admin: agregar un asistente (Persona) a un evento que pide celular |
| `lib/pricing.ts` | Helpers: `todayArg`, `getTierLabel`, `calculatePrice`, `calculateDatePrice`, `getDateTierLabel`, `validateTiers` |
| `lib/players.ts` | Lista estática del plantel (36 jugadores, formato "Apellido, Nombre") |
| `components/pricing-tiers-editor.tsx` | Editor de tramos por cantidad |
| `components/date-tiers-editor.tsx` | Editor de tramos por fecha de pago |
| `components/currency-input.tsx` | Input de montos con formato argentino (punto = miles, coma = decimal) y preview verde |
| `components/refresh-button.tsx` | Botón "Actualizar" que llama a `router.refresh()` |
| `components/image-upload.tsx` | Upload con selector de posición (#top/#bottom en URL) |
| `components/whatsapp-invite-button.tsx` | Botón WhatsApp con descripción |
| `components/payment-proof-upload.tsx` | Componente para subir comprobante de pago |
| `components/payment-reminder-button.tsx` | Recordatorio de pago por WhatsApp desde el evento: link directo a subir el comprobante de ese evento |
| `components/whatsapp-cuentas-button.tsx` | Recordatorio de pago por WhatsApp desde cuenta corriente: link a `/mi-cuenta` |
| `components/add-attendee-button.tsx` | Botón inline para agregar asistente manualmente desde admin |
| `app/admin/(protected)/page.tsx` | Dashboard admin general (stats globales, eventos, combos, botón Actualizar) |
| `app/admin/(protected)/events/[id]/page.tsx` | Panel admin del evento (Resumen, Gastos, Asistentes con fecha de comprobante) |
| `app/admin/(protected)/events/new/page.tsx` | Formulario nuevo evento (con selector de tipo de precio) |
| `app/admin/(protected)/events/[id]/edit/page.tsx` | Formulario editar evento (con selector de tipo de precio) |
| `app/admin/(protected)/combos/new/page.tsx` | Formulario nuevo combo |
| `app/admin/(protected)/combos/[id]/page.tsx` | Panel admin del combo |
| `app/api/attendees/route.ts` | API de registro: calcula precio por tramo, por fecha, o fijo; si es 3T encuentra al asistente ya pre-cargado; si el evento pide celular, anota como Persona (`registerWithPhone`) |
| `app/api/events/route.ts` | API POST eventos: guarda `pricing_tiers`, `date_tiers`, `is_3t`; si es 3T inserta todos los jugadores como asistentes confirmados |
| `app/api/events/[id]/route.ts` | API PATCH eventos: actualiza `pricing_tiers`, `date_tiers`, `is_3t` |
| `app/api/events/by-slug/[slug]/route.ts` | API pública: expone `pricing_tiers`, `date_tiers`, `is_3t` |
| `app/api/combos/route.ts` | API POST combos |
| `app/api/combos/[id]/route.ts` | API PATCH/DELETE combos |
| `app/api/combos/by-slug/[slug]/route.ts` | API pública de combos |
| `app/api/upload-proof/route.ts` | API de subida de comprobante (guarda `proof_uploaded_at`) |
| `app/e/[slug]/page.tsx` | Página pública del evento (muestra precios por fecha, tramo o fijo) |
| `app/e/[slug]/confirm/page.tsx` | Confirmar asistencia / subir comprobante (`?upload=1`). Con `?from=mi-cuenta&nombre=` preselecciona el nombre y "Volver" regresa a `/mi-cuenta` |
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

## Personas (eventos que piden celular)

Glosario y reglas en `CONTEXT.md`; el porqué de no verificar el número, en `docs/adr/0001-celular-declarado-sin-verificar.md`. Primera versión detrás de un interruptor por evento (`events.requires_phone`), que se elige al crear el evento y no se cambia después. Los eventos sin el interruptor funcionan exactamente como antes.

### Tablas

- `people`: `real_name` (lo carga un admin; null = sin nombre real), `team` ("A" | "B" = plantel; null = externo).
- `person_phones`: (`person_id`, `phone`). Una Persona puede tener varios celulares (fusiones) y un celular varias Personas. `phone` siempre son 10 dígitos (`normalizePhone`).
- `attendees.person_id`: null en el historial y en eventos sin el interruptor. Índice único parcial (evento, persona) para confirmados.
- `attendees.full_name` sigue siendo el nombre con el que figura en ESE evento, y es único dentro del evento. Por eso los gastos y la liquidación siguen cruzando por nombre sin cambios.
- `attendees.proof_uploaded_from`: celular del teléfono que subió el comprobante (null = sin identificar).

### Anotarse (no 3T)

`POST /api/attendees` con `phone` → `registerWithPhone`. Qué hacer lo decide `decideRegistration` (puro, en `lib/people.ts`):

| Decisión | Cuándo | Respuesta |
|---|---|---|
| `choose` | El celular ya tiene Personas y no se dijo quién es | 200 `{ choose: [{ id, name }] }`, sin crear nada |
| `already` | Esa Persona ya está anotada en el evento | 200 con sus datos de pago (`existing: true`) |
| `name-taken` | Otro anotado del evento ya usa ese nombre | 409 |
| `register` | Se anota (creando la Persona si el celular es nuevo o si `person_id: "new"`) | 201 |

Sin `phone`, la ruta solo sirve para elegir un nombre de la lista y ver sus datos de pago (comprobante de otro, o anotado agregado por admin sin celular); no crea anotaciones.

El teléfono recuerda el celular en `localStorage` (`lib/device-phone.ts`). Al volver, `components/phone-registration.tsx` consulta `POST /api/people/lookup` y muestra "Hola de nuevo", "¿quién sos?" (varias Personas con ese celular) o "Ya estás anotado".

### 3T con el interruptor

El plantel se precarga desde `people` (por `team`), no desde `lib/players.ts`, y cada asistente queda ligado a su Persona. La pantalla pública es la de siempre (elegir el nombre de la lista); si el teléfono es conocido, el nombre viene elegido.

### Comprobantes

`upload-proof` guarda en `proof_uploaded_from` el celular que recuerda el teléfono. El panel del evento muestra un aviso cuando no coincide con los celulares de la Persona (`proofOrigin`: "desde el teléfono de X" / "sin identificar"). No se bloquea: se detecta.

### Reglas para tocar este código

- **Los celulares y `real_name` nunca salen en respuestas públicas.** `publicAttendee()` quita `proof_uploaded_from`; `lookup` solo devuelve el nombre con el que cada Persona figuró.
- **Fusionar no borra anotaciones.** Si las dos Personas están anotadas en un mismo evento, `merge` devuelve 409 y el admin quita una a mano (cada anotación puede tener pago y gastos).
- **Un evento con el interruptor no puede ir en un combo** (`lib/combo-events.ts`): los combos anotan por nombre.
- **La cuenta corriente junta por Persona** (sesión 51): `consolidateAccounts` usa `personKey(person_id)` cuando el asistente tiene Persona, así que quien figura como "Santi" en un evento y "Santi Fernandez" en otro es una sola cuenta. Cada detalle guarda el nombre de ese evento (`name`), que es el que se usa para subir el comprobante. `/mi-cuenta` elige sola la cuenta si el teléfono recuerda el celular, y vuelve con `?cuenta=<key>`.

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

> **Desde la sesión 45 esta lógica vive en `lib/settlement.ts` (`settleEvent`)** — función pura
> con tests en `lib/settlement.test.ts`. El panel del evento, Pendientes y el sync de gastos la
> consumen a través de esa interfaz. **No re-implementar estos cálculos inline en páginas o APIs.**
> El matching gastos↔asistentes usa `normalizeName()` (quita tildes).
> Regla de combos (ver CONTEXT.md): un asistente de combo impago debe el precio del evento,
> NO la cuota-parte del combo — el descuento del combo es solo si pagás.

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

### Invitados (`payment_status = "guest"`)

Tercer estado de pago, además de `pending` y `paid` (migración 8). Se marca desde admin con el botón "Invitado" (`components/mark-guest-button.tsx`) en la lista de asistentes; en eventos 3T no se ofrece (`SortableAttendeeList allowGuest={!event.is_3t}`). Regla de negocio en CONTEXT.md. Dónde impacta:

- `settleEvent`: `eventDebt = 0` (`PersonBalance.guest`), fuera de `toMarkPaid` y de `totalPending`. `isGuest()` es el helper canónico.
- `syncExpensePayment`: no toca a invitados.
- Queries con `payment_status = 'pending'` / `'paid'` (dashboard, Pendientes) los excluyen solas. **Ojo con `!== "paid"`**: no significa "debe" — usar `=== "pending"`.
- Divisor de gastos (admin y `expense-settlement.tsx` público), "X pagaron de N" y "% pagaron": solo los que pagan.
- `POST /api/attendees`: el precio por cantidad cuenta solo a los que pagan (el cupo sí cuenta invitados); en el selector de "subir comprobante" los invitados sí aparecen (`unpaidAttendeeNames` = no pagados) y al elegir su nombre ven "¡Estás invitado! … no debés nada" sin pedido de pago.
- Página pública: chip con check azul. CSV: "Invitado". Panel de combo: un registro invitado cuenta como saldado y no suma plata.

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

El badge amber **"Gastó"** aparece en todos los asistentes que tienen gastos registrados (`expenseByPerson > 0`), independientemente del monto o de si tienen comprobante. Es independiente del badge "Comprobante" — un asistente puede mostrar ambos.

Asistentes marcados como "paid" por el sync de gastos (sin `payment_proof_url`, con gastos ≥ `getOwedPrice`):
- No muestran badge "Combo" aunque tengan `combo_id`
- Se cuentan en la tarjeta **"Cubiertos por gastos"** (tercera tarjeta junto a "Confirmaron" y "Pagaron")
- No cuentan como pendientes en "Falta cobrar"

### Balance neto en Resumen (gastos + comprobante)

> **INVARIANTE CRÍTICO — no modificar sin validar con casos reales (y sin tests en `lib/settlement.test.ts`):**
>
> El pago del evento y los gastos adelantados son conceptos independientes, pero la
> **cronología** entre ambos importa: quien carga un gasto ANTES de pagar el evento
> paga solo la diferencia (precio − gasto), y quien ya pagó el evento y carga un gasto
> DESPUÉS se lleva el gasto entero de vuelta. La app no guarda el monto transferido,
> así que `settleEvent` lo infiere comparando `expenses.created_at` con
> `attendees.proof_uploaded_at`.
>
> **Regla de decisión** (`balances` en `lib/settlement.ts`):
> - `payment_status !== "paid"` → `eventDebt = owed` (debe precio − gastos)
> - `paidViaExpenses` (paid por sync, sin proof) → `eventDebt = owed` (se devuelve gastos − precio)
> - pagó independientemente (`paid && !paidViaExpenses`) → `eventDebt = min(owed, gastosCargadosAntesDelComprobante)`
>   - Sin comprobante (combo / marcado manual), sin fechas, o sin gastos previos al comprobante → `eventDebt = 0`, se devuelven TODOS los gastos (caso Alvarez Sly, sesión 44).
>   - Con gastos cargados antes del comprobante → se asume que transfirió `precio − gastosPrevios` (`amountTransferred`; caso Fausto, sesión 45): net = 0 si gastos < precio; si gastos > precio solo se devuelve el exceso. Los gastos posteriores al comprobante se devuelven enteros.
>
> `net = eventDebt − gastosTotales`. `net > 0` debe pagar, `net < 0` se le debe devolver.
>
> Limitación conocida: si alguien carga un gasto y aun así transfiere el precio completo, la
> inferencia falla (le va a mostrar menos de lo que se le debe). La solución definitiva es
> guardar el monto realmente transferido (`amount_paid`) editable desde admin.

Además, se detectan gastos cuyo `responsible` no matchea ningún asistente confirmado y se muestran como **acreedores externos** en la sección "Pagaron sin ser asistentes", con alias de pago y botón de saldar.

En el componente `expense-settlement.tsx` (resumen de saldos público), la cuota por persona se divide solo entre asistentes confirmados — los pagadores externos no inflan el divisor.

El `totalCollected` sigue usando `price_paid` real (lo que efectivamente se cobró).
