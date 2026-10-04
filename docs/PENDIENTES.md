# Pendientes / ideas futuras — hockey-eventos

Backlog de mejoras y features que aún no están implementadas. Ordenar por prioridad o por fecha de propuesta según se prefiera.

## Convención de entradas

Cada idea va con:

- **Título corto** y descripción del valor que aporta
- **Por qué** (problema que resuelve)
- **Notas técnicas** si ya hay una idea de implementación
- **Estado**: idea / en discusión / aprobado / descartado

## Ideas

### Personas: identidad por celular

- **Descripción**: cada asistente pasa a ser una **Persona** reconocida por su número de celular, con una sección "Personas" en el admin. Glosario y reglas en `CONTEXT.md`; el porqué de no verificar el número, en `docs/adr/0001-celular-declarado-sin-verificar.md`.
- **Por qué**: hoy la única identidad es el nombre escrito en cada evento. En los asados, 265 de 607 anotaciones son un apodo suelto y nadie usa el formato del plantel, así que "Guillote" (asado) y "Campana, Guillermo" (3T) son dos cuentas corrientes. Los duplicados dentro de un evento los limpian los admins a mano.
- **Diseño acordado (2026-10-03)**:
  - **Anotarse (evento que no es 3T)**: nombre libre + celular la primera vez. Después el teléfono recuerda el número y solo se confirma el nombre, que se puede cambiar en cada evento. Si el teléfono no lo recuerda, se escribe el celular y la app pregunta "¿sos fulano?" antes de crear nada. Una Persona no puede quedar dos veces en un evento. Si el nombre ya lo usa otro anotado del evento, se pide distinguirlo. Desde un número se puede anotar a otra persona (queda como Persona aparte). "Soy de inferiores" sigue siendo una casilla por evento. Se quita "No voy".
  - **3T**: igual que hoy (se elige el nombre del plantel); si el teléfono es conocido, el nombre viene elegido.
  - **Comprobantes**: si la app no reconoce el teléfono, se elige el nombre de la lista como hoy. Se puede subir el comprobante de otro. El admin ve desde qué teléfono se subió cada uno ("otro teléfono" / "sin identificar").
  - **Admin**: sección Personas con filtros (Plantel A, Plantel B, Externos, sin nombre real); editar nombre real, plantel y celular; fusionar dos Personas; importar una lista (nombre, plantel, celular). El plantel inicial sale de `lib/players.ts`. Al agregar un asistente a mano se elige una Persona o se crea una sin celular.
  - **Plata**: la liquidación y los gastos de cada evento no cambian (el nombre sigue siendo único dentro del evento). La cuenta corriente junta por Persona los eventos nuevos y sigue por nombre para los anteriores; `/mi-cuenta` reconoce por teléfono/celular lo nuevo y mantiene la lista de nombres para lo viejo.
  - **Arranque**: interruptor por evento ("pide celular"), que se prende al crearlo; cuando esté validado se quita y queda fijo. Sin combos en la primera versión (un evento con el interruptor no entra en combos). El historial no se convierte.
- **Queda afuera por ahora**: verificación del número por WhatsApp, combos con celular, fusionar el historial.
- **Notas técnicas**:
  - Migración 9 en `docs/MIGRACIONES.md` (solo agrega): tablas `people` (`real_name`, `team`) y `person_phones` (una Persona puede tener varios números y un número varias Personas), `attendees.person_id`, `attendees.proof_uploaded_from`, `events.requires_phone`, e índice único parcial (evento, persona).
  - `attendees.full_name` sigue siendo el nombre con el que figura en ese evento.
  - Los celulares son datos personales: no van al repo ni a ninguna API pública; se cargan por el panel de admin.
  - La lógica validada está en el módulo `Modelo` de la maqueta (`docs/prototipos/personas-PROTOTIPO.html`, en la rama `prototipo/personas`): `normalizarCelular`, `anotar`, `fusionar`, `subirComprobante`.
- **Estado**: primera parte implementada (sesión 50, detrás del interruptor por evento; detalle en `docs/ARQUITECTURA.md`). Falta:
  1. Cuenta corriente por Persona para los eventos nuevos, y `/mi-cuenta` por teléfono/celular (hoy siguen consolidando por nombre).
  2. Validar con eventos reales y quitar el interruptor para que quede fijo.
  3. Lo que quedó afuera: combos con celular, verificación por WhatsApp, fusionar el historial.

### Monto adeudado en eventos "por cantidad": cuenta corriente vs página de pago

- **Descripción**: en eventos con precio por cantidad (`pricing_tiers`), el que no pagó figura con montos distintos según dónde se mire. Ejemplo: tramos 1–10 $30.000 / resto $40.000; Juan se anota 5.º (se le guarda `price_paid` = $30.000) y no paga:
  - Cuenta corriente, `/mi-cuenta`, Resumen, Pendientes y recordatorios de WhatsApp → **$40.000** (`getOwedPrice`: tramo más caro para no-pagadores, regla de la sesión 36).
  - Página de subir comprobante (`POST /api/attendees`, rama de inscripto existente) → **$30.000** (`price_paid`, fórmula propia).
  - Si transfiere $30.000 y sube el comprobante queda pagado y "Recaudado" suma $30.000: la regla del tramo más caro solo se ve en pantalla, nunca se cobra.
- **Por qué**: desde la sesión 49 las cards de `/mi-cuenta` llevan directo a la página de pago, así que la diferencia se vería. Con precio fijo, por fecha e inferiores las dos fórmulas coinciden.
- **Impacto al 2026-09-27**: ninguno. 0 de 27 eventos usan precio por cantidad (13 por fecha, 14 fijos) y los 39 montos adeudados de ese momento coincidían entre `/mi-cuenta` y la página de pago.
- **Propuesta**:
  1. Que la página de pago use `getOwedPrice` (una sola fórmula; para fijo/fecha/inferiores no cambia nada).
  2. Decidir la regla para "por cantidad":
     - **A** (recomendada): el precio con el que se anotó. Los primeros N conservan su precio aunque paguen después; coincide con la definición ("según cuántos confirmados hay al momento de anotarse") y con lo que se cobra hoy.
     - **B**: el tramo más caro también al pagar. Sin fecha límite visible, el precio barato solo lo conserva quien paga en el mismo momento en que se anota.
     - **C**: mixta. Precio con el que se anotó hasta el día del evento, después el más caro (parecido a "por fecha").
  - En A y C, los de combo impagos siguen debiendo el precio del evento (regla de combos en CONTEXT.md).
- **Archivos**: `lib/settlement.ts` (`getOwedPrice`), `app/api/attendees/route.ts`, `lib/settlement.test.ts`, `CONTEXT.md`, `docs/ARQUITECTURA.md`.
- **Estado**: en discusión (Guillermo lo revisa con tiempo)

### Combo impago en evento de precio fijo figura debiendo la cuota del combo

- **Descripción**: al anotarse a un combo, cada registro recibe `price_paid` = precio del combo ÷ cantidad de eventos (cuota-parte). En eventos de precio fijo `getOwedPrice` devuelve `price_paid`, así que quien no pagó figura debiendo la cuota-parte y no el precio del evento. Contradice la regla de CONTEXT.md ("el descuento del combo es solo si pagás"); el test de esa regla solo cubre eventos por fecha. La página de pago del evento también pide la cuota-parte.
- **Relacionado**: al guardar un evento de precio fijo se pisa `price_paid` de todos los no-inferiores con el precio del evento (commit `fb3cecd`, intencional), incluidos los que pagaron vía combo → en "Recaudado" cuentan el precio del evento y no la cuota que pagaron. Revisar si debería excluirlos.
- **Impacto al 2026-09-27**: ninguno (0 inscriptos de combo impagos en eventos fijos con `price_paid` distinto al precio del evento).
- **Notas técnicas**: `getOwedPrice` necesitaría saber si el asistente es de combo (`combo_id`, hoy no está en `SettlementAttendee`) para usar el precio del evento. Conviene resolverlo junto con el pendiente anterior.
- **Estado**: en discusión

### Convertir la app en SaaS multi-tenant

- **Descripción**: Permitir que otros equipos de hockey (u otros deportes) usen la misma app con su propia base de datos, jugadores, admins y branding. Monetizar con suscripción mensual.
- **Por qué**: Si funciona para uno, puede escalar a muchos equipos.
- **Origen**: Pedido de un conocido de Guillote (mayo 2026).
- **Notas técnicas (plan de alto nivel)**:
  1. **Modelo de datos** — Nuevas tablas: `organizations`, `users`, `players`. Agregar `organization_id` a events, attendees, expenses, combos para aislar datos por equipo.
  2. **Autenticación real** — Reemplazar admin password único por Supabase Auth con roles (owner, admin, player).
  3. **Jugadores dinámicos** — Mover rosters de `lib/players.ts` a la BD. Cada organización carga sus propios jugadores.
  4. **Routing por organización** — Cada equipo accede por slug propio (ej: `app.com/san-martin/...`).
  5. **Onboarding** — Flujo de registro: crear cuenta → crear organización → cargar jugadores.
  6. **Billing** — Integración con Stripe para suscripciones mensuales.
  7. **Branding configurable** — Nombre, logo y colores por equipo.
- **Fases sugeridas**: Arrancar por modelo de datos + auth, después routing y onboarding, y por último billing y branding.
- **Estado**: idea
