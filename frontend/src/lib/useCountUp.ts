import { useState, useEffect, useRef } from 'react'

export function useCountUp(target: number, duration = 800): number {
  const [current, setCurrent] = useState(0)
  const frameRef = useRef<number>(0)
  const startTimeRef = useRef<number | null>(null)
  const startValueRef = useRef(0)

  useEffect(() => {
    startValueRef.current = current
    startTimeRef.current = null

    function step(timestamp: number) {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(startValueRef.current + (target - startValueRef.current) * eased)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        setCurrent(target)
      }
    }

    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])

  return current
}
