import { useEffect, useState } from 'react'

const MINUTE_MS = 60_000

const clockFormat = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

/** Whole minutes from `from` to `to` (never negative: clocks drift). */
export function minutesBetween(from: string | Date, to: string | Date) {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.max(0, Math.floor(ms / MINUTE_MS))
}

/** "28 min", "1 h 05" */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${String(minutes % 60).padStart(2, '0')}`
}

/** "agora", "há 9 min", "há 1 h 05" */
export function formatAgo(iso: string, now: Date) {
  const minutes = minutesBetween(iso, now)
  return minutes === 0 ? 'agora' : `há ${formatDuration(minutes)}`
}

/** "14:04" */
export const formatTime = (iso: string) => timeFormat.format(new Date(iso))

/** "18/10/2026 · 14:04" */
export const formatDateAndTime = (iso: string) =>
  `${dateFormat.format(new Date(iso))} · ${formatTime(iso)}`

/** "DOM 18/10 · 14:13", the header clock. */
export function formatClock(date: Date) {
  const parts = clockFormat.formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  const weekday = part('weekday').replace('.', '').toUpperCase()
  return `${weekday} ${part('day')}/${part('month')} · ${part('hour')}:${part('minute')}`
}

export function isSameDay(iso: string, day: Date) {
  return new Date(iso).toDateString() === day.toDateString()
}

/** Current time, refreshed every `intervalMs`, so relative times ("há 9 min") keep moving. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
