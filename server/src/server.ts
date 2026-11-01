import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const app = express()
const port = Number(process.env.PORT || 4000)
type FeedbackRole = 'student' | 'admin' | 'worker'
type FeedbackEntry = { id: string; message: string; createdAt: string; role?: FeedbackRole }
const feedbackFilePath = fileURLToPath(new URL('../data/feedback.json', import.meta.url))
let feedbackEntries = await loadFeedback()
let feedbackSaveQueue: Promise<void> = Promise.resolve()
type NotificationRole = 'Student' | 'Admin' | 'Maintenance'
type CampusNotification = {
  id: string
  recipientRole: NotificationRole
  type: 'report-created' | 'task-assigned'
  title: string
  message: string
  reportId: string
  createdAt: string
  read: boolean
  task?: { title: string; location: string; category: string; priority: string; due: string }
}
const notificationClients = new Map<NotificationRole, Set<express.Response>>()

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '2mb' }))

app.get('/api/feedback', (_request, response) => {
  response.json({ feedback: feedbackEntries })
})

app.post('/api/feedback', async (request, response) => {
  const message = typeof request.body?.message === 'string' ? request.body.message.trim() : ''
  const role = request.body?.role
  if (!message || message.length > 1000 || (role !== undefined && !isFeedbackRole(role))) {
    response.status(400).json({ message: 'Feedback must contain between 1 and 1000 characters and a valid role.' })
    return
  }

  const entry: FeedbackEntry = { id: randomUUID(), message, createdAt: new Date().toISOString(), role: role ?? 'student' }
  feedbackEntries = [entry, ...feedbackEntries]
  try {
    await persistFeedback(feedbackEntries)
    response.status(201).json({ feedback: [entry] })
  } catch (error) {
    console.error('Unable to save student feedback.', error)
    response.status(500).json({ message: 'Feedback could not be saved.' })
  }
})

app.get('/api/events', (request, response) => {
  const role = request.query.role
  if (role !== 'Student' && role !== 'Admin' && role !== 'Maintenance') {
    response.status(400).json({ message: 'A valid notification role is required.' })
    return
  }

  response.status(200)
  response.setHeader('Content-Type', 'text/event-stream')
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('Connection', 'keep-alive')
  response.flushHeaders()
  response.write(': connected\n\n')

  const clients = notificationClients.get(role) ?? new Set<express.Response>()
  clients.add(response)
  notificationClients.set(role, clients)

  const heartbeat = setInterval(() => response.write(': keep-alive\n\n'), 25_000)
  request.on('close', () => {
    clearInterval(heartbeat)
    clients.delete(response)
    if (clients.size === 0) notificationClients.delete(role)
  })
})

app.post('/api/events', (request, response) => {
  const notification: unknown = request.body
  if (!isCampusNotification(notification)) {
    response.status(400).json({ message: 'The notification payload is invalid.' })
    return
  }

  const clients = notificationClients.get(notification.recipientRole)
  clients?.forEach((client) => client.write(`data: ${JSON.stringify(notification)}\n\n`))
  response.status(202).json({ delivered: clients?.size ?? 0 })
})

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'smart-campus-api', timestamp: new Date().toISOString() })
})

app.get('/api/meta', (_request, response) => {
  response.json({
    roles: ['Student', 'Admin', 'Maintenance'],
    complaintStatuses: ['Pending', 'Assigned', 'In progress', 'Resolved'],
    categories: ['Furniture', 'AC / Cooler', 'Electrical', 'Washroom', 'Cleanliness', 'Other'],
    persistence: 'PostgreSQL integration is prepared for the next backend section',
  })
})

app.post('/api/auth/login', (_request, response) => {
  response.status(501).json({ message: 'JWT login will be connected after the database schema is added.' })
})

app.post('/api/complaints', (_request, response) => {
  response.status(501).json({ message: 'Complaint persistence will be connected after the database schema is added.' })
})

app.use((_request, response) => {
  response.status(404).json({ message: 'Route not found' })
})

app.listen(port, () => {
  console.log(`Smart Campus API listening on http://localhost:${port}`)
})

async function loadFeedback(): Promise<FeedbackEntry[]> {
  try {
    const contents = await readFile(feedbackFilePath, 'utf8')
    const parsed: unknown = JSON.parse(contents)
    if (!Array.isArray(parsed) || !parsed.every(isFeedbackEntry)) {
      throw new Error('The stored feedback file has an invalid format.')
    }
    return parsed
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
}

function persistFeedback(entries: FeedbackEntry[]): Promise<void> {
  const save = feedbackSaveQueue.then(async () => {
    await mkdir(dirname(feedbackFilePath), { recursive: true })
    await writeFile(feedbackFilePath, JSON.stringify(entries, null, 2), 'utf8')
  })
  feedbackSaveQueue = save.catch((error: unknown) => {
    console.error('Feedback persistence queue failed.', error)
  })
  return save
}

function isFeedbackEntry(value: unknown): value is FeedbackEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<FeedbackEntry>
  return typeof entry.id === 'string' &&
    typeof entry.message === 'string' &&
    typeof entry.createdAt === 'string' &&
    (entry.role === undefined || isFeedbackRole(entry.role))
}

function isFeedbackRole(value: unknown): value is FeedbackRole {
  return value === 'student' || value === 'admin' || value === 'worker'
}

function isCampusNotification(value: unknown): value is CampusNotification {
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
