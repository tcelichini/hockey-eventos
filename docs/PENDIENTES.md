# Pendientes / ideas futuras — hockey-eventos

Backlog de mejoras y features que aún no están implementadas. Ordenar por prioridad o por fecha de propuesta según se prefiera.

## Convención de entradas

Cada idea va con:

- **Título corto** y descripción del valor que aporta
- **Por qué** (problema que resuelve)
- **Notas técnicas** si ya hay una idea de implementación
- **Estado**: idea / en discusión / aprobado / descartado

## Ideas

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
