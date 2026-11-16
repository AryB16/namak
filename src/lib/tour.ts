const TOURED = 'namak.toured.v1'

export function hasToured(): boolean {
  try {
    return localStorage.getItem(TOURED) === '1'
  } catch {
    return true
  }
}

export function markToured() {
  try {
    localStorage.setItem(TOURED, '1')
  } catch {
    /* ignore */
  }
}
