import { normalizeName } from "@/lib/settlement"

/**
 * Clasificación de pago vía combo (ver CONTEXT.md). Concepto de *display*
 * (badge "Combo"), no participa del cálculo de plata.
 *
 * Regla: una persona pagó vía combo cuando TODOS sus registros del mismo
 * combo comparten la misma payment_proof_url no nula (upload-proof-url copia
 * la misma URL a todos los eventos del combo). URLs distintas = pagó cada
 * evento individualmente. Sin URL = no cuenta como combo.
 */

export type ComboAttendeeRecord = {
  id: string
  combo_id: string | null
  full_name: string
  payment_proof_url: string | null
}

/**
 * Recibe los registros de asistentes de los combos involucrados (todos los
 * eventos de cada combo) y devuelve los IDs que pagaron vía combo.
 */
export function classifyComboPayment(records: ComboAttendeeRecord[]): Set<string> {
  const groups = new Map<string, { ids: string[]; proofUrls: (string | null)[] }>()
  for (const r of records) {
    if (!r.combo_id) continue
    const key = `${r.combo_id}::${normalizeName(r.full_name)}`
    const group = groups.get(key) || { ids: [], proofUrls: [] }
    group.ids.push(r.id)
    group.proofUrls.push(r.payment_proof_url)
    groups.set(key, group)
  }

  const paidViaCombo = new Set<string>()
  groups.forEach((group) => {
    const firstProof = group.proofUrls[0]
    if (firstProof && group.proofUrls.every((url) => url === firstProof)) {
      group.ids.forEach((id) => paidViaCombo.add(id))
    }
  })
  return paidViaCombo
}
