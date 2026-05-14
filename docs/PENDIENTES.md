# Pendientes / ideas futuras — hockey-eventos

Backlog de mejoras y features que aún no están implementadas. Ordenar por prioridad o por fecha de propuesta según se prefiera.

## Convención de entradas

Cada idea va con:

- **Título corto** y descripción del valor que aporta
- **Por qué** (problema que resuelve)
- **Notas técnicas** si ya hay una idea de implementación
- **Estado**: idea / en discusión / aprobado / descartado

## Ideas

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
