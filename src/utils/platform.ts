export type Platform = 'ios' | 'android' | 'desktop'
export type AppMode = 'pwa' | 'browser'

export function getPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export function getAppMode(): AppMode {
  if (window.matchMedia('(display-mode: standalone)').matches) return 'pwa'
  // iOS Safari standalone check
  if ('standalone' in navigator && (navigator as Record<string, unknown>).standalone) return 'pwa'
  return 'browser'
}

export function isIOS(): boolean {
  return getPlatform() === 'ios'
}

export function isPWA(): boolean {
  return getAppMode() === 'pwa'
}
