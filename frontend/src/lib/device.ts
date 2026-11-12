export function deviceName(ua: string): string {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux|X11/.test(ua) ? 'Linux' : 'Desconhecido'
  return `${browser} · ${os}`.slice(0, 80)
}

export function getDeviceName(): string {
  try {
    const saved = localStorage.getItem('ff_device')
    if (saved) return saved
    const name = deviceName(navigator.userAgent)
    localStorage.setItem('ff_device', name)
    return name
  } catch {
    return deviceName(navigator.userAgent)
  }
}
