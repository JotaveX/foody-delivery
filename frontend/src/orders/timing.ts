import { minutesBetween } from '../lib/time'
import { isTerminal } from './status'
import type { OrderSummary } from './types'

/** Minutes in the same status after which a ticket is flagged as stalled. */
export const STALLED_AFTER_MINUTES = 10

type Timed = Pick<OrderSummary, 'status' | 'createdAt' | 'updatedAt'>

/** Minutes the order has been in its current status (updatedAt is the last status change). */
export const minutesInStatus = (order: Timed, now: Date) => minutesBetween(order.updatedAt, now)

/** Open and sitting in the same status for too long. */
export const isStalled = (order: Timed, now: Date) =>
  !isTerminal(order.status) && minutesInStatus(order, now) > STALLED_AFTER_MINUTES

/** From creation to the final status (delivered or cancelled). */
export const totalMinutes = (order: Timed) => minutesBetween(order.createdAt, order.updatedAt)
