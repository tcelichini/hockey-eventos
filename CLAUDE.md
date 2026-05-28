# hockey-eventos — Contexto base

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

## Cómo arrancar la sesión

1. Abrir Cowork y seleccionar la carpeta: `C:\Users\guill\projects\Eventos Hockey\hockey-eventos`
2. Para correr la app en local: terminal en VSCode → `cd hockey-eventos` (si hace falta) → `npm run dev`
3. App en local: http://localhost:3000 — Admin: http://localhost:3000/admin

## Cómo hacer un commit y push

Desde la terminal de VSCode (siempre con comillas dobles en los paths en Windows CMD):

```bash
git add "ruta/archivo1" "ruta/archivo2"
git commit -m "descripción del cambio"
git pull --rebase && git push
```

Si el push es rechazado (remote has changes), usar `git pull --rebase` antes de `git push`.

Si hay cambios locales sin commitear y necesitás traer cambios del remoto:

```bash
git stash
git pull --rebase
git stash pop
```

## Gotchas importantes

### Worktrees y `.env.local`

Los git worktrees (usados por Claude Code para trabajar en ramas aisladas) **no copian archivos ignorados por .gitignore**, como `.env.local`. Si se trabaja en un worktree y el admin no acepta la contraseña o la app no conecta a la DB, lo primero que hay que verificar es que exista `.env.local` en el worktree. Solución:

```bash
cp "ruta/repo/.env.local" "ruta/worktree/.env.local"
```

### ESLint en Vercel rompe el build por variables no usadas

Vercel corre `next build` que incluye ESLint con la regla `@typescript-eslint/no-unused-vars` como **error** (no warning). Si se elimina el uso de una variable pero no la declaración, el build falla en Vercel aunque `npx tsc --noEmit` pase localmente. **Siempre correr `npx next build` antes de pushear a `main`** — `next lint` solo no alcanza, porque hay errores de tipos (ej: `'X' is possibly null`, `Map.values()` no iterable) que solo aparecen durante el build completo y rompen el deploy silenciosamente.

### Archivos truncados al editar desde Cowork

Al editar archivos desde Cowork, pueden quedar truncados o con bytes nulos al final (problema de CRLF/LF en Windows). Antes de hacer commit, conviene correr `npx tsc --noEmit` para detectar archivos rotos. Si aparecen errores de "Invalid character" o "no corresponding closing tag", restaurar el archivo desde HEAD con `git show HEAD:ruta/archivo > ruta/archivo` y re-aplicar los cambios.

---

## Documentación adicional

Para mantener este archivo lean, el resto de la documentación vive en `docs/`. Leé el archivo correspondiente solo cuando sea relevante a la tarea:

| Archivo | Cuándo leerlo |
|---|---|
| `docs/ARQUITECTURA.md` | Mapa de archivos clave, tipos de precio, combos, balance neto. **Leer al tocar lógica de negocio.** |
| `docs/MIGRACIONES.md` | SQL para Supabase. **Leer al tocar la DB o agregar columnas.** |
| `docs/CONVENCIONES.md` | Patrones de UI (layout responsive en listados admin, etc.). **Leer al crear o modificar UI.** |
| `docs/HISTORIAL.md` | Historial completo de sesiones (1–17 y siguientes). **Leer si se necesita contexto histórico de un cambio.** |
| `docs/PENDIENTES.md` | Ideas futuras / backlog. **Leer al planificar próximas mejoras.** |

## Convención de sesiones

Cada sesión de trabajo se documenta como una entrada nueva al final de `docs/HISTORIAL.md`, con el formato:

```markdown
### Sesión N (YYYY-MM-DD)
- **Cambio principal:** descripción breve
  - Detalles técnicos
  - Archivos: `ruta/archivo.ts`, ...
```

Cuando un cambio establezca una convención reutilizable (ej: un patrón de layout), promoverlo a `docs/CONVENCIONES.md`. Cuando agregue arquitectura nueva (ej: un módulo, una entidad), documentarla en `docs/ARQUITECTURA.md`.
