# CONTEXT — Glosario de dominio de hockey-eventos

Términos del dominio y reglas de negocio que el código debe respetar. Complementa `docs/ARQUITECTURA.md` (que describe *cómo* está implementado); acá va *qué significa* cada concepto.

## Liquidación (settlement)

El cálculo de plata de un evento: quién debe, a quién se le debe, y los totales. Vive en `lib/settlement.ts`.

- **Precio adeudado (`getOwedPrice`)** — lo que debe un asistente que NO pagó. Escalera: `inferiores_price` (si es de inferiores) → tramo vigente de `date_tiers` → tramo más caro de `pricing_tiers` → `price_paid` o `payment_amount`.
- **Cubierto por gastos (`paidViaExpenses`)** — asistente marcado `paid` automáticamente porque sus gastos adelantados cubren su precio adeudado, sin comprobante. Su deuda de evento sigue contando en el balance para que el gasto la absorba.
- **Balance neto** — `net = eventDebt − gastos adelantados`. `net > 0` debe plata; `net < 0` se le debe.
- **Acreedor externo** — persona que adelantó gastos pero no es asistente confirmada del evento.

## Reglas de negocio (decididas, no re-litigar)

- **El descuento del combo es solo si pagás.** (2026-07-03) Un asistente anotado vía combo que no pagó debe el precio del evento (tramo vigente / más caro), NO la cuota-parte del combo. La división `comboPrice / eventCount` solo aplica al asignar `price_paid` cuando efectivamente paga vía combo.
- **Pago de evento y gastos son independientes.** Si alguien pagó con comprobante, se le devuelven TODOS sus gastos (no se descuenta el evento). Única excepción: `paidViaExpenses`. (Ver INVARIANTE CRÍTICO en `docs/ARQUITECTURA.md`.)

## Cuenta corriente

Saldo consolidado de una persona across eventos: suma de sus `net` por evento (deudas de eventos impagos − gastos adelantados). **Solo entra lo que falta mover de plata**: eventos ya pagados y gastos ya devueltos (`settled`) no suman. Vive en `lib/cuenta-corriente.ts` (`consolidateAccounts`, función pura sobre los outputs de `settleEvent`). La consolidación de personas usa `normalizeName` — dos escrituras del mismo nombre con/sin tildes son la misma persona, pero apodos o formatos distintos ("Guillote Campana" vs "Campana, Guillermo") NO se unifican.

## Combos

- **Pagó vía combo (`paidViaCombo`)** — todos los registros de la persona en el combo comparten la misma `payment_proof_url` no nula. Es un concepto de *display* (badge), no participa del cálculo de plata.
