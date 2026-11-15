import { useEffect, useRef } from 'react'

type Ember = { x: number; y: number; radius: number; rise: number; sway: number; swaySpeed: number; life: number; span: number; hue: number }

/**
 * Decorative embers drifting up behind the page, with a faint firelight along the bottom edge.
 * Nothing is drawn under prefers-reduced-motion, and drawing pauses while the tab is hidden.
 */
export function Embers() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!element || !context || still) return

    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let frame = 0
    let last = performance.now()

    const resize = () => {
      width = element.width = Math.floor(window.innerWidth * ratio)
      height = element.height = Math.floor(window.innerHeight * ratio)
    }
    const spawn = (anywhere: boolean): Ember => ({
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : height + 12,
      radius: (0.6 + Math.random() * 1.7) * ratio,
      rise: (16 + Math.random() * 44) * ratio,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.6 + Math.random() * 1.4,
      life: 0,
      span: 5 + Math.random() * 7,
      hue: 12 + Math.random() * 32,
    })

    resize()
    const embers = Array.from({ length: Math.round(Math.min(64, Math.max(26, window.innerWidth / 24))) }, () => spawn(true))

    const draw = (now: number) => {
      const elapsed = Math.min(0.05, (now - last) / 1000)
      last = now
      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'lighter'

      const firelight = 0.09 + 0.035 * Math.sin(now / 260) + 0.025 * Math.sin(now / 97)
      const base = context.createLinearGradient(0, height, 0, height * 0.74)
      base.addColorStop(0, `rgba(255, 90, 26, ${firelight})`)
      base.addColorStop(1, 'rgba(255, 90, 26, 0)')
      context.fillStyle = base
      context.fillRect(0, height * 0.74, width, height * 0.26)

      for (let index = 0; index < embers.length; index++) {
        const ember = embers[index]
        ember.life += elapsed
        ember.y -= ember.rise * elapsed
        ember.sway += ember.swaySpeed * elapsed
        ember.x += Math.sin(ember.sway) * 12 * ratio * elapsed
        const fade = Math.min(1, ember.life / 0.8) * Math.max(0, 1 - ember.life / ember.span)
        if (ember.y < -12 || fade <= 0) {
          embers[index] = spawn(false)
          continue
        }
        const reach = ember.radius * 4
        const glow = context.createRadialGradient(ember.x, ember.y, 0, ember.x, ember.y, reach)
        glow.addColorStop(0, `hsla(${ember.hue}, 100%, 64%, ${0.85 * fade})`)
        glow.addColorStop(0.35, `hsla(${ember.hue}, 100%, 50%, ${0.32 * fade})`)
        glow.addColorStop(1, 'hsla(14, 100%, 50%, 0)')
        context.fillStyle = glow
        context.beginPath()
        context.arc(ember.x, ember.y, reach, 0, Math.PI * 2)
        context.fill()
      }
      frame = requestAnimationFrame(draw)
    }
    const onVisibility = () => {
      cancelAnimationFrame(frame)
      if (!document.hidden) {
        last = performance.now()
        frame = requestAnimationFrame(draw)
      }
    }

    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={canvas} className="embers" aria-hidden="true" />
}
