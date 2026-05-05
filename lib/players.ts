// Listas de jugadores por equipo — formato "Apellido, Nombre", orden alfabético.
// Se usan para pre-cargar asistentes en eventos 3T y para el dropdown público
// de "¿quién sos?" en la página de confirmación.

export const PLAYERS_A: string[] = [
  "Accinelli, Gianluca",
  "Aguiar, Franco Nicolás",
  "Alvarez Sly, Fernando",
  "Barberis, Joaquín",
  "Barzola, Ignacio",
  "Barzola, Juan Martin",
  "Blanco, Lucas",
  "Camiño, Bautista",
  "Campana, Fernando",
  "Campana, Guillermo",
  "Campana, Juan Pablo",
  "Carregal, Agustín",
  "Carreño, Joaquín",
  "Casanova, Agustín",
  "Cavalieri, Santino",
  "Celichini, Tomás",
  "Cocina, Fausto",
  "Díaz, Santiago",
  "Druetta, Felipe",
  "Encina, Tobias",
  "Fernández, Santiago",
  "Iarusso, Mateo",
  "Lajmanovich, Lautaro",
  "Lascano, Manuel",
  "Lascano, Martín",
  "López Lado, Rodrigo",
  "Matías, Bautista",
  "Moauro, Gianluca",
  "Montero, Juan",
  "Nacach, Agustín",
  "Rossi, Enzo",
  "Salerno Picasso, Lorenzo",
  "Santoro, Franco",
  "Sotero Sávori, Tomás",
  "Suarez, Felipe",
  "Ugarte, Joaquín",
]

export const PLAYERS_B: string[] = [
  "Alonso, Agustín",
  "Arguimbau, Ignacio",
  "Ballester, Thomas",
  "Barzola, Juan Cruz",
  "Borello Puebla, Bruno",
  "Borgia, Bernardo",
  "Carreño, Facundo",
  "Crovetto, Andrés",
  "De Nastchokine, Alejandro",
  "Diaz Diaz, Arturo Javier",
  "Domínguez Martel, Rodrigo Nahuel",
  "Dos Santos, Agustín",
  "Gagliardi, Héctor",
  "Giambenedetti, Alessandro",
  "Laricchiuta, Diego",
  "Ledesma, Tom",
  "Maddaleno, Gastón",
  "Matías, Santiago",
  "Montero, Pedro",
  "Mures Blanco, Mariano",
  "Nacach, Matías",
  "Peragallo, Andrés",
  "Seri, Franco",
  "Signorello, Luciano",
  "Tapia, Lucas",
  "Ticinese, Tobias",
  "Trigo, Francisco",
]

/**
 * Devuelve la unión de jugadores de los equipos especificados, sin duplicados, ordenada alfabéticamente.
 *
 * @param teams - array con valores "A" y/o "B". Si es null/undefined/vacío, devuelve [].
 * @returns lista de jugadores (puede estar vacía si teams no incluye equipos reconocidos)
 */
export function getPlayersForTeams(teams: string[] | null | undefined): string[] {
  if (!teams || teams.length === 0) return []
  const sets: string[][] = []
  if (teams.includes("A")) sets.push(PLAYERS_A)
  if (teams.includes("B")) sets.push(PLAYERS_B)
  return Array.from(new Set(sets.flat())).sort((a, b) => a.localeCompare(b, "es"))
}
