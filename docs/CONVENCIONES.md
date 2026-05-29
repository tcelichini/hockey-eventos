# Convenciones — hockey-eventos

Patrones reutilizables que conviene seguir al hacer cambios en el código.

## Layout responsive en listados admin

Para listados verticales en panel admin (asistentes de evento, inscriptos de combo, gastos, etc.), usar siempre el mismo patrón para que se vean bien en mobile:

```tsx
<div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
  <div className="min-w-0">
    <p className="font-medium text-gray-900">{name}</p>  {/* sin truncate */}
    <p className="text-xs text-gray-400 mt-0.5">{detalles}</p>
  </div>
  <div className="flex items-center gap-2 shrink-0">
    {/* badges + botones */}
  </div>
</div>
```

**Razón:** en mobile vertical el texto largo se rompe carácter por carácter si los hijos de un `flex` row compiten por espacio. Apilarlos en `flex-col` y volver a `flex-row` desde `sm:` (640px) deja todo legible sin cortar nombres.

**Importante:** evitar la clase `truncate` en nombres de personas. Es mejor que el nombre haga wrap a que se corte con "…".

## Headers de página admin con varios botones

Cuando hay 3+ botones de acción en el header (Actualizar, Exportar, Editar, Eliminar, etc.), usar:

```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
  <h1>...</h1>
  <div className="flex flex-wrap items-center gap-2">
    {/* botones */}
  </div>
</div>
```

El `flex-wrap` permite que en mobile los botones se acomoden en varias filas sin desbordar la pantalla.

## Manejo de zonas horarias

La app opera en `America/Argentina/Buenos_Aires` (UTC−3). Vercel corre en UTC, así que cualquier formateo o parseo de fechas tiene que ser explícito sobre el timezone:

- **Para obtener la fecha de hoy (`YYYY-MM-DD`)**: usar `todayArg()` de `lib/pricing.ts`. **Nunca** usar `new Date().toISOString().slice(0, 10)` — devuelve UTC y a partir de las 21:00 ARG ya es "mañana".
- **Para mostrar fechas**: usar `Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", ... })`. Sin el `timeZone` explícito, el server formatea en UTC.
- **Para parsear `datetime-local`** (formato `"YYYY-MM-DDTHH:mm"`): agregar el offset explícito al construir el `Date` → `new Date(value + ":00-03:00")`. Sin el offset, el server lo interpreta como UTC y la hora se corre 3 horas.
- **Para llenar un `datetime-local` desde un `Date`**: no usar `getHours()`/`getMinutes()` (dependen del timezone del runtime). Usar `Intl.DateTimeFormat` con `timeZone: "America/Argentina/Buenos_Aires"`.

## Validaciones de API que comparan contra `0`

Cuando un campo numérico puede venir legítimamente con valor `0` (ej: `payment_amount` en modo "Por fecha"), no usar `!campo` en la validación porque `!0 === true`. Usar `campo == null` para distinguir `0` de `undefined`/`null`.

## Edición inline en listados: el formulario debe reemplazar la fila

Cuando una fila de un listado tiene un botón de "Editar" que muestra un formulario inline, **el formulario debe renderizarse al nivel de la fila completa**, no dentro del contenedor de botones/acciones.

**Mal** — el formulario queda atrapado en el `shrink-0` de los botones y se superpone en mobile:
```tsx
<div className="flex items-start justify-between">
  <div className="flex-1">{/* info */}</div>
  <div className="shrink-0">
    <EditButton />  {/* ← si el form se renderiza acá adentro, se rompe */}
    <DeleteButton />
  </div>
</div>
```

**Bien** — usar un componente cliente que alterne entre display y form a nivel de fila:
```tsx
// ItemComponent.tsx ("use client")
if (editing) {
  return (
    <div className="py-3">
      <div className="space-y-2">{/* inputs en grillas responsive */}</div>
    </div>
  )
}
return (
  <div className="py-3">
    <div className="flex items-start justify-between">
      <div className="flex-1">{/* info */}</div>
      <div className="shrink-0">{/* botones editar/eliminar */}</div>
    </div>
  </div>
)
```

**Razón:** en mobile, un formulario con inputs de ancho completo no cabe dentro de un contenedor `shrink-0` pensado para iconos. El formulario debe tomar el ancho total de la fila.

## Buckets de Storage por tipo de contenido

Mantener buckets separados para distinguir conceptualmente entre **ingresos** (pagos de asistentes → `event-banners`) y **egresos** (gastos del evento → `expense-receipts`). Esto facilita auditoría y permisos diferenciados a futuro.
