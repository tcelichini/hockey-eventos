# CONTEXTO_COWORK.md (archivo migrado)

> **Este archivo fue reemplazado por una estructura modular el 2026-05-04.**
> Se mantiene como tombstone para no romper referencias y costumbres existentes.

## Nueva estructura

| Archivo | Contenido |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) (raíz) | Contexto base — **se carga automáticamente** al iniciar una sesión de Claude Code. |
| [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md) | Mapa de archivos clave, tipos de precio, combos, balance neto. |
| [`docs/MIGRACIONES.md`](./docs/MIGRACIONES.md) | SQL para Supabase. |
| [`docs/CONVENCIONES.md`](./docs/CONVENCIONES.md) | Patrones de UI/código reutilizables. |
| [`docs/HISTORIAL.md`](./docs/HISTORIAL.md) | Historial completo de sesiones (1–17 y siguientes). |
| [`docs/PENDIENTES.md`](./docs/PENDIENTES.md) | Ideas futuras / backlog. |

## Por qué se hizo el cambio

`CLAUDE.md` lo lee Claude Code automáticamente al inicio de cada sesión, así que ya no hace falta pegar manualmente el contexto. Para que ese archivo se mantenga lean, el resto de la documentación (historial, migraciones, convenciones) vive en `docs/` y se lee solo cuando es relevante a la tarea.

Detalles del cambio en `docs/HISTORIAL.md` (sesión 18).
