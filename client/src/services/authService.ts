export type UserRole = 'student' | 'admin' | 'worker'

export type MockUser = {
  id: string
  name: string
  email: string
  role: UserRole
}

const STORAGE_KEY = 'smart-campus-user'
const demoAccounts: Array<MockUser & { password: string }> = [
  { id: 'u1', name: 'Arjun Kumar', email: 'student@campus.edu', role: 'student', password: 'campus123' },
  { id: 'u2', name: 'Priya Shah', email: 'admin@campus.edu', role: 'admin', password: 'campus123' },
  { id: 'u3', name: 'Ravi Mehta', email: 'maintenance@campus.edu', role: 'worker', password: 'campus123' },
]

export async function login(email: string, password: string, role: UserRole): Promise<MockUser> {
  const account = demoAccounts.find(
    (candidate) => candidate.email === email.trim().toLowerCase() && candidate.password === password && candidate.role === role,
  )

  if (!account) throw new Error('Invalid demo credentials')

  const user: MockUser = { id: account.id, name: account.name, email: account.email, role: account.role }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  return user
}

export function switchDemoAccount(role: UserRole): MockUser {
  const account = demoAccounts.find((candidate) => candidate.role === role)
  if (!account) throw new Error(`No demo account is configured for role "${role}"`)

  const user: MockUser = { id: account.id, name: account.name, email: account.email, role: account.role }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  return user
}

export function getCurrentUser(): MockUser | null {
  const storedUser = localStorage.getItem(STORAGE_KEY)
  if (!storedUser) return null

  try {
    return JSON.parse(storedUser) as MockUser
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEY)
}