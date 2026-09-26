const TIMEOUT_MESSAGE = 'Request timed out. Check your connection and try again.'

export function withTimeout(promise, { ms = 15000, message = TIMEOUT_MESSAGE } = {}) {
  let timer
  return Promise.race([
    promise,
    new Promise((resolve) => { timer = setTimeout(() => resolve({ data: null, error: { message } }), ms) }),
  ]).finally(() => clearTimeout(timer))
}

export function withTimeoutRejecting(promise, { ms = 15000, message = TIMEOUT_MESSAGE } = {}) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) }),
  ]).finally(() => clearTimeout(timer))
}
