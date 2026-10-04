// El celular que este teléfono recuerda (eventos que piden celular, ver CONTEXT.md).
// Vive en localStorage: si no está (teléfono nuevo, incógnito), la persona lo escribe de nuevo
// y la app la reconoce igual por el número.

const KEY = "hockey-eventos:celular"

export function getDevicePhone(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setDevicePhone(phone: string): void {
  try {
    window.localStorage.setItem(KEY, phone)
  } catch {
    // Sin localStorage (modo privado estricto): la app sigue funcionando, solo no recuerda
  }
}
