export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-5xl mb-4">🏑</div>
        <h1 className="text-xl font-bold text-gray-900">Evento no encontrado</h1>
        <p className="text-gray-500 mt-2 text-sm">
          El link que usaste no es válido o el evento fue eliminado.
        </p>
      </div>
    </div>
  )
}
