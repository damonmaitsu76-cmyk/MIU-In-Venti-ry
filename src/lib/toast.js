const EVENT = 'miu:toast'

function show(message, tone = 'success') {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id: crypto.randomUUID(), message, tone } }))
}

export const toast = {
  success: (message) => show(message, 'success'),
  error: (message) => show(message, 'error'),
  warning: (message) => show(message, 'warning'),
  info: (message) => show(message, 'info'),
}

export const toastEvent = EVENT
