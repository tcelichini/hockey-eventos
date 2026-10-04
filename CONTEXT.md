# CONTEXT — Glosario de dominio de hockey-eventos

Términos del dominio y reglas de negocio que el código debe respetar. Complementa `docs/ARQUITECTURA.md` (que describe *cómo* está implementado); acá va *qué significa* cada concepto.

## Personas y asistentes

**Persona**:
Alguien que participa de los eventos del club, sea jugador o no, con una identidad única que se mantiene entre eventos y se reconoce por su número de celular. En cada evento figura con el nombre que eligió al anotarse (en 3T, con su nombre del plantel); su nombre real lo ven solo los admins.
_Evitar_: usuario, perfil, cuenta (la palabra "cuenta" ya es de la cuenta corriente)

**Plantel**:
Los jugadores activos de un equipo (A o B). Lo mantienen los admins, que también cargan el celular de cada jugador.

**Jugador**:
Persona que integra un Plantel.

**Externo**:
Persona que no integra ningún Plantel: ex jugadores, padres, amigos, novias, chicos de inferiores, entrenadores. Paga como cualquier asistente, salvo que un admin lo marque Invitado.
_Evitar_: invitado, acompañante

**Asistente**:
Una Persona anotada en un evento. La lista final la cierra un admin: agrega a quien fue sin anotarse y quita a quien se anotó y no fue.
_Evitar_: inscripto

**Invitado**:
Asistente que no paga ni debe (entrenadores, algún invitado especial). Lo marca siempre un admin.
_Evitar_: "invitado" para referirse a un Externo que paga

## Liquidación (settlement)

El cálculo de plata de un evento: quién debe, a quién se le debe, y los totales. Vive en `lib/settlement.ts`.

- **Precio adeudado (`getOwedPrice`)** — lo que debe un asistente que NO pagó. Escalera: `inferiores_price` (si es de inferiores) → tramo vigente de `date_tiers` → tramo más caro de `pricing_tiers` → `price_paid` o `payment_amount`.
- **Cubierto por gastos (`paidViaExpenses`)** — asistente marcado `paid` automáticamente porque sus gastos adelantados cubren su precio adeudado, sin comprobante. Su deuda de evento sigue contando en el balance para que el gasto la absorba.
- **Balance neto** — `net = eventDebt − gastos adelantados`. `net > 0` debe plata; `net < 0` se le debe.
- **Acreedor no asistente** — persona que adelantó gastos pero no es asistente confirmada del evento. Puede ser un Jugador o un Externo. (Antes "acreedor externo"; en el código sigue siendo `externalCreditors` hasta que se renombre.)

## Reglas de negocio (decididas, no re-litigar)

- **El descuento del combo es solo si pagás.** (2026-07-03) Un asistente anotado vía combo que no pagó debe el precio del evento (tramo vigente / más caro), NO la cuota-parte del combo. La división `comboPrice / eventCount` solo aplica al asignar `price_paid` cuando efectivamente paga vía combo.
- **Pago de evento y gastos son independientes, pero la cronología manda.** (2026-09-13, refina la regla de 2026-06-30) Quien carga un gasto ANTES de subir el comprobante pagó solo la diferencia (precio − gasto): `eventDebt = min(precio, gastos previos al comprobante)`. Quien pagó primero y cargó gastos DESPUÉS se lleva todos sus gastos de vuelta (`eventDebt = 0`). `paidViaExpenses` sigue siendo la excepción (eventDebt = precio). Se infiere por `expenses.created_at` vs `attendees.proof_uploaded_at` porque la app no guarda el monto transferido. (Ver INVARIANTE CRÍTICO en `docs/ARQUITECTURA.md`.)

- **Invitados no pagan ni deben.** (2026-09-26) Un asistente con `payment_status = "guest"` (ej: entrenadores invitados al evento) cuenta como asistente (confirmados, cupo, lista pública) pero no entra en ningún cálculo de plata: no es deudor, no suma a cobrado ni a pendiente, no divide el costo de los gastos ni cuenta en el precio por cantidad (`pricing_tiers`), y el "% que pagó" se calcula sobre los que tienen que pagar. Si adelanta gastos se le devuelven enteros (`eventDebt = 0`) y nunca se lo auto-marca pagado por gastos. **No aplica a eventos 3T**: ahí el plantel precargado es el que paga, así que admin no ofrece el botón "Invitado".

- **Paga quien fue, salvo en 3T.** (2026-10-01) Fuera de 3T, el admin quita de la lista a quien se anotó y no fue (deja de deber) y agrega a quien fue sin anotarse. En 3T paga todo el plantel, vaya o no.
- **Cada asistente se anota y paga por separado.** (2026-10-01) Nadie anota acompañantes a su nombre: cada uno se anota como su propia Persona. Si alguien paga por otro, elige el nombre del otro y sube el comprobante (el admin ve desde qué teléfono se subió), o se lo pasa a un admin para que lo cargue.
- **El celular ordena, no autentica.** (2026-10-01) El número lo declara cada uno al anotarse y no se verifica. Sirve para reconocer a la misma Persona entre eventos, no para impedir que alguien actúe en nombre de otro.
- **Todo evento que no es 3T está abierto a Externos.** (2026-10-01) Si un evento es solo para el plantel, simplemente no se comparte el link afuera; la app no lo restringe.
- **Un celular puede anotar a más de una Persona.** (2026-10-03) No debería, pero se permite: quien anota a otro desde su teléfono usa su propio número, y así al menos se sabe quién lo anotó.
- **Inferiores se declara en cada evento.** (2026-10-03) Depende de la edad: quien hoy es de inferiores el año que viene puede no serlo, así que no es un dato fijo de la Persona.

## Cuenta corriente

Saldo consolidado de una persona across eventos: suma de sus `net` por evento (deudas de eventos impagos − gastos adelantados). **Solo entra lo que falta mover de plata**: eventos ya pagados y gastos ya devueltos (`settled`) no suman. Vive en `lib/cuenta-corriente.ts` (`consolidateAccounts`, función pura sobre los outputs de `settleEvent`). La consolidación de personas usa `normalizeName` — dos escrituras del mismo nombre con/sin tildes son la misma persona, pero apodos o formatos distintos ("Guillote Campana" vs "Campana, Guillermo") NO se unifican.

## Combos

- **Pagó vía combo (`paidViaCombo`)** — todos los registros de la persona en el combo comparten la misma `payment_proof_url` no nula. Es un concepto de *display* (badge), no participa del cálculo de plata.
