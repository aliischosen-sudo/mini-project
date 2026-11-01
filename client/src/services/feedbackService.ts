export type FeedbackRole = 'student' | 'admin' | 'worker'

export type PublicFeedback = {
  id: string
  message: string
  createdAt: string
  role?: FeedbackRole
}

const apiBaseUrl = import.meta.env.VITE_API_URL ?? '/api'

function isFeedbackEntry(value: unknown): value is PublicFeedback {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<PublicFeedback>
  return typeof entry.id === 'string' &&
    typeof entry.message === 'string' &&
    typeof entry.createdAt === 'string' &&
    (entry.role === undefined || entry.role === 'student' || entry.role === 'admin' || entry.role === 'worker')
}

function isFeedbackList(value: unknown): value is { feedback: PublicFeedback[] } {
  if (typeof value !== 'object' || value === null || !('feedback' in value)) return false
  return Array.isArray(value.feedback) && value.feedback.every(isFeedbackEntry)
}

export async function getPublicFeedback(): Promise<PublicFeedback[]> {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/feedback`)
  if (!response.ok) throw new Error(`Feedback could not be loaded (${response.status}).`)

  const result: unknown = await response.json()
  if (!isFeedbackList(result)) throw new Error('The feedback response has an invalid format.')
  return result.feedback
}

export async function submitFeedback(message: string, role: FeedbackRole): Promise<PublicFeedback> {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, role }),
  })
  if (!response.ok) throw new Error(`Feedback could not be submitted (${response.status}).`)

  const result: unknown = await response.json()
  if (!isFeedbackList(result) || result.feedback.length !== 1) {
    throw new Error('The submitted feedback response has an invalid format.')
  }
  return result.feedback[0]
}
