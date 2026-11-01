export type NotificationRole = 'Student' | 'Admin' | 'Maintenance'
export type NotificationType = 'report-created' | 'task-assigned'

export type CampusNotification = {
  id: string
  recipientRole: NotificationRole
  type: NotificationType
  title: string
  message: string
  reportId: string
  createdAt: string
  read: boolean
  task?: { title: string; location: string; category: string; priority: string; due: string }
}

type NewNotification = Omit<CampusNotification, 'id' | 'createdAt' | 'read'>
type NotificationListener = (notification: CampusNotification) => void

const STORAGE_PREFIX = 'smart-campus-notifications:'
const LIVE_EVENT_KEY = 'smart-campus-live-event'
const listeners = new Map<NotificationRole, Set<NotificationListener>>()
const seenNotificationIds = new Set<string>()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? '/api'
const broadcastChannel = typeof BroadcastChannel === 'undefined'
  ? null
  : new BroadcastChannel('smart-campus-notifications')

function isNotification(value: unknown): value is CampusNotification {
  if (typeof value !== 'object' || value === null) return false
  const notification = value as Partial<CampusNotification>
  return typeof notification.id === 'string' &&
    (notification.recipientRole === 'Student' || notification.recipientRole === 'Admin' || notification.recipientRole === 'Maintenance') &&
    (notification.type === 'report-created' || notification.type === 'task-assigned') &&
    typeof notification.title === 'string' &&
    typeof notification.message === 'string' &&
    typeof notification.reportId === 'string' &&
    typeof notification.createdAt === 'string' &&
    typeof notification.read === 'boolean' &&
    (notification.task === undefined || (
      typeof notification.task.title === 'string' &&
      typeof notification.task.location === 'string' &&
      typeof notification.task.category === 'string' &&
      typeof notification.task.priority === 'string' &&
      typeof notification.task.due === 'string'
    ))
}

function readStoredNotifications(role: NotificationRole): CampusNotification[] {
  const key = `${STORAGE_PREFIX}${role}`
  const stored = localStorage.getItem(key)
  if (!stored) return []

  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every(isNotification)) {
      throw new Error(`Stored ${role} notifications have an invalid format`)
    }
    return parsed
  } catch (error) {
    console.error('Unable to read campus notifications.', error)
    localStorage.removeItem(key)
    return []
  }
}

function saveNotification(notification: CampusNotification): void {
  const current = readStoredNotifications(notification.recipientRole)
  if (current.some((item) => item.id === notification.id)) return

  localStorage.setItem(
    `${STORAGE_PREFIX}${notification.recipientRole}`,
    JSON.stringify([notification, ...current].slice(0, 100)),
  )
}

function deliverNotification(notification: CampusNotification): void {
  if (!isNotification(notification) || seenNotificationIds.has(notification.id)) return
  seenNotificationIds.add(notification.id)
  if (seenNotificationIds.size > 500) seenNotificationIds.clear()
  saveNotification(notification)
  listeners.get(notification.recipientRole)?.forEach((listener) => listener(notification))
}

broadcastChannel?.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (isNotification(event.data)) deliverNotification(event.data)
})

window.addEventListener('storage', (event) => {
  if (event.key !== LIVE_EVENT_KEY || !event.newValue) return
  try {
    const notification: unknown = JSON.parse(event.newValue)
    if (isNotification(notification)) deliverNotification(notification)
  } catch (error) {
    console.error('Unable to process a cross-tab notification.', error)
  }
})

export function getNotifications(role: NotificationRole): CampusNotification[] {
  return readStoredNotifications(role)
}

export function markNotificationsRead(role: NotificationRole): CampusNotification[] {
  const updated = readStoredNotifications(role).map((notification) => ({ ...notification, read: true }))
  localStorage.setItem(`${STORAGE_PREFIX}${role}`, JSON.stringify(updated))
  return updated
}

export function subscribeToNotifications(role: NotificationRole, listener: NotificationListener): () => void {
  const roleListeners = listeners.get(role) ?? new Set<NotificationListener>()
  roleListeners.add(listener)
  listeners.set(role, roleListeners)

  const eventSource = new EventSource(`${apiBaseUrl.replace(/\/$/, '')}/events?role=${role}`)
  eventSource.onmessage = (event) => {
    try {
      const notification: unknown = JSON.parse(event.data)
      if (isNotification(notification)) deliverNotification(notification)
    } catch (error) {
      console.error('Unable to process a live campus notification.', error)
    }
  }

  return () => {
    eventSource.close()
    roleListeners.delete(listener)
    if (roleListeners.size === 0) listeners.delete(role)
  }
}

export function publishNotification(input: NewNotification): void {
  const notification: CampusNotification = {
    ...input,
    id: `${Date.now()}-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    read: false,
  }

  seenNotificationIds.add(notification.id)
  saveNotification(notification)
  listeners.get(notification.recipientRole)?.forEach((listener) => listener(notification))
  broadcastChannel?.postMessage(notification)
  localStorage.setItem(LIVE_EVENT_KEY, JSON.stringify(notification))

  void fetch(`${apiBaseUrl.replace(/\/$/, '')}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notification),
  }).then((response) => {
    if (!response.ok) throw new Error(`Notification delivery failed (${response.status})`)
  }).catch((error: unknown) => {
    console.warn('Live notification server is unavailable; same-browser delivery is still active.', error)
  })
}
