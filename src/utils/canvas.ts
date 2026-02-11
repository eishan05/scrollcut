export function resizeCanvasToContainer(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
): { width: number; height: number; dpr: number } {
  const rect = container.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1

  const width = Math.max(1, rect.width)
  const height = Math.max(1, rect.height)

  const nextW = Math.max(1, Math.floor(width * dpr))
  const nextH = Math.max(1, Math.floor(height * dpr))

  if (canvas.width !== nextW) canvas.width = nextW
  if (canvas.height !== nextH) canvas.height = nextH
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  return { width, height, dpr }
}

