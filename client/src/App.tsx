import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { getCurrentUser, login as mockLogin, logout as mockLogout, switchDemoAccount } from './services/authService'
import { getNotifications, markNotificationsRead, publishNotification, subscribeToNotifications } from './services/notificationService'
import type { CampusNotification, NotificationRole } from './services/notificationService'
import { getPublicFeedback, submitFeedback } from './services/feedbackService'
import type { FeedbackRole, PublicFeedback } from './services/feedbackService'
import './App.css'

type Role = 'Student' | 'Admin' | 'Maintenance'

const roleDetails: Record<Role, { id: string; email: string; name: string; initials: string; description: string }> = {
  Student: { id: 'u1', email: 'student@campus.edu', name: 'Arjun Kumar', initials: 'AK', description: 'Report campus issues and follow their progress.' },
  Admin: { id: 'u2', email: 'admin@campus.edu', name: 'Priya Shah', initials: 'PS', description: 'Manage reports, staff assignments, and campus insights.' },
  Maintenance: { id: 'u3', email: 'maintenance@campus.edu', name: 'Ravi Mehta', initials: 'RM', description: 'View assigned work and keep students updated.' },
}

type ReportDraft = { title: string; location: string; category: string }
type ReportStatus = 'Pending' | 'In progress' | 'Resolved'
type SubmittedReport = ReportDraft & { id: string; status: ReportStatus; date: string; createdAt: string; assignee?: string; responseDays?: number }

function StatusIcon({ status }: { status: string }) {
  const variant = status === 'Resolved' ? 'resolved' : status === 'In progress' ? 'in-progress' : 'pending'
  return <span className={`issue-dot status-icon status-icon-${variant}`} aria-hidden="true" />
}

function AccountMenu({ role, onSwitchUser }: { role: Role; onSwitchUser: (nextRole: Role) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="account-menu">
      <button className="admin-profile" aria-label="Switch account" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {roleDetails[role].initials} <span>⌄</span>
      </button>
      {open && <div className="account-menu-popover" role="menu" aria-label="Switch demo account">
        <p className="eyebrow">SWITCH ACCOUNT</p>
        {(Object.keys(roleDetails) as Role[]).map((nextRole) => {
          const account = roleDetails[nextRole]
          const selected = role === nextRole
          return <button className="account-option" key={account.id} role="menuitem" disabled={selected} onClick={() => onSwitchUser(nextRole)}>
            <span className="avatar">{account.initials}</span>
            <span className="account-option-details"><strong>{account.name}</strong><small>{account.id} · {account.email}</small></span>
            {selected && <span className="account-current" aria-label="Current account">✓</span>}
          </button>
        })}
      </div>}
    </div>
  )
}

const SUBMITTED_REPORTS_KEY = 'smart-campus-reports'
const REPORT_ASSIGNMENTS_KEY = 'smart-campus-report-assignments'

function loadReportAssignments(): Record<string, string> {
  try {
    const storedAssignments = localStorage.getItem(REPORT_ASSIGNMENTS_KEY)
    return storedAssignments ? JSON.parse(storedAssignments) as Record<string, string> : {}
  } catch (error) {
    console.error('Unable to read complaint assignments.', error)
    localStorage.removeItem(REPORT_ASSIGNMENTS_KEY)
    return {}
  }
}

function loadSubmittedReports(): SubmittedReport[] {
  try {
    const storedReports = localStorage.getItem(SUBMITTED_REPORTS_KEY)
    return storedReports
      ? (JSON.parse(storedReports) as SubmittedReport[]).map((report) => ({
          ...report,
          createdAt: report.createdAt ?? new Date().toISOString(),
        }))
      : []
  } catch {
    localStorage.removeItem(SUBMITTED_REPORTS_KEY)
    return []
  }
}

function App() {
  const [role, setRole] = useState<Role | null>(() => {
    const user = getCurrentUser()
    if (!user) return null
    return user.role === 'student' ? 'Student' : user.role === 'admin' ? 'Admin' : 'Maintenance'
  })
  const [actionMessage, setActionMessage] = useState('')
  const [submittedReports, setSubmittedReports] = useState(loadSubmittedReports)
  const [notificationStore, setNotificationStore] = useState<Record<NotificationRole, CampusNotification[]>>(() => ({
    Student: getNotifications('Student'),
    Admin: getNotifications('Admin'),
    Maintenance: getNotifications('Maintenance'),
  }))
  const notifications = role ? notificationStore[role] : []
  const [popupNotification, setPopupNotification] = useState<CampusNotification | null>(null)

  function activateRole(nextRole: Role) {
    const storedNotifications = getNotifications(nextRole)
    setNotificationStore((current) => ({ ...current, [nextRole]: storedNotifications }))
    setRole(nextRole)
    const newestUnread = storedNotifications.find((notification) => !notification.read && Date.now() - Date.parse(notification.createdAt) < 60_000)
    if (newestUnread) setPopupNotification(newestUnread)
  }

  function handleReportSubmit(draft: ReportDraft): SubmittedReport {
    const now = new Date()
    const report: SubmittedReport = {
      ...draft,
      id: `SC-${now.getTime()}`,
      status: 'Pending',
      date: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(now),
      createdAt: now.toISOString(),
    }
    const updatedReports = [report, ...submittedReports]
    localStorage.setItem(SUBMITTED_REPORTS_KEY, JSON.stringify(updatedReports))
    setSubmittedReports(updatedReports)
    publishNotification({
      recipientRole: 'Admin',
      type: 'report-created',
      title: 'New campus report',
      message: `${report.title} · ${report.location}`,
      reportId: report.id,
    })
    return report
  }

  function handleReportAssigned(reportId: string, staff: string, task: Omit<MaintenanceJob, 'id' | 'status' | 'assignee'>) {
    const report = submittedReports.find((item) => item.id === reportId)
    if (report) {
      const updatedReports = submittedReports.map((item) => item.id === reportId
        ? staff === 'Unassigned'
          ? { ...item, assignee: undefined, status: 'Pending' as const }
          : { ...item, assignee: staff, status: 'In progress' as const, responseDays: item.responseDays ?? Math.max(0, (Date.now() - Date.parse(item.createdAt)) / 86_400_000) }
        : item)
      localStorage.setItem(SUBMITTED_REPORTS_KEY, JSON.stringify(updatedReports))
      setSubmittedReports(updatedReports)
    }

    const updatedJobs = loadMaintenanceJobs().filter((job) => job.id !== reportId)
    if (staff === 'Unassigned') {
      localStorage.setItem(MAINTENANCE_JOBS_KEY, JSON.stringify(updatedJobs))
      return
    }

    localStorage.setItem(MAINTENANCE_JOBS_KEY, JSON.stringify([
      { ...task, status: 'Assigned', assignee: staff },
      ...updatedJobs,
    ]))
    publishNotification({
      recipientRole: 'Maintenance',
      type: 'task-assigned',
      title: 'New maintenance task assigned',
      message: `${reportId} · ${task.title} was assigned to ${staff}.`,
      reportId,
      task,
    })
  }

  async function handleLogin(selectedRole: Role, email: string, password: string) {
    const userRole = selectedRole === 'Student' ? 'student' : selectedRole === 'Admin' ? 'admin' : 'worker'
    try {
      await mockLogin(email, password, userRole)
      activateRole(selectedRole)
    } catch {
      setActionMessage('Sign-in failed. Check the email, password, and selected role.')
      window.setTimeout(() => setActionMessage(''), 2400)
    }
  }

  function handleSignOut() {
    mockLogout()
    setRole(null)
  }

  function handleSwitchUser(nextRole: Role) {
    try {
      switchDemoAccount(nextRole === 'Student' ? 'student' : nextRole === 'Admin' ? 'admin' : 'worker')
      activateRole(nextRole)
      setActionMessage('')
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Unable to switch demo account.')
      window.setTimeout(() => setActionMessage(''), 2400)
    }
  }

  useEffect(() => {
    if (!role) return
    const unsubscribe = subscribeToNotifications(role, (notification) => {
      setNotificationStore((current) => ({ ...current, [role]: getNotifications(role) }))
      setPopupNotification(notification)
    })
    return unsubscribe
  }, [role])

  useEffect(() => {
    if (!popupNotification) return
    const timeout = window.setTimeout(() => setPopupNotification(null), 6000)
    return () => window.clearTimeout(timeout)
  }, [popupNotification])

  useEffect(() => {
    function syncSubmittedReports(event: StorageEvent) {
      if (event.key === SUBMITTED_REPORTS_KEY) setSubmittedReports(loadSubmittedReports())
    }
    window.addEventListener('storage', syncSubmittedReports)
    return () => window.removeEventListener('storage', syncSubmittedReports)
  }, [])

  function handleMarkNotificationsRead() {
    if (!role) return
    setNotificationStore((current) => ({ ...current, [role]: markNotificationsRead(role) }))
  }

  useEffect(() => {
    function handleUnwiredAction(event: MouseEvent) {
      const target = (event.target as HTMLElement).closest('button, a')
      if (!target || target.closest('.modal-backdrop') || target.closest('.notification-popover')) return
      if (target.closest('.account-menu')) return
      if (target.closest('.admin-shell nav, .maintenance-shell nav') || (target.closest('.admin-shell, .maintenance-shell') && target.getAttribute('aria-label') === 'Notifications')) return
      const label = target.textContent?.replace(/\s+/g, ' ').trim()
      if (!label) return
      if (target.tagName === 'A') {
        const href = target.getAttribute('href')
        if (target.closest('.sidebar') && ['#overview', '#reports', '#notifications'].includes(href ?? '')) return
        event.preventDefault()
      }
      if (target.classList.contains('admin-profile')) return
      else if (target.classList.contains('details-button')) return
      else if (target.classList.contains('icon-button') && !target.closest('.main-content:not(.admin-content):not(.maintenance-content)')) setActionMessage('You have 3 new updates')
      else if (target.tagName === 'A' && label.includes('Maintenance staff')) setActionMessage('Maintenance staff directory opened')
      else if (target.tagName === 'A' && label.includes('Analytics')) setActionMessage('Analytics dashboard is ready for the next section')
      else if (target.tagName === 'A' && label.includes('Notifications')) setActionMessage('Notifications opened')
      else return
      window.setTimeout(() => setActionMessage(''), 2400)
    }
    document.addEventListener('click', handleUnwiredAction)
    return () => document.removeEventListener('click', handleUnwiredAction)
  }, [])

  return <>{!role ? <Login onLogin={handleLogin} /> : <Dashboard role={role} submittedReports={submittedReports} notifications={notifications} onMarkNotificationsRead={handleMarkNotificationsRead} onReportSubmit={handleReportSubmit} onReportAssigned={handleReportAssigned} onSignOut={handleSignOut} onSwitchUser={handleSwitchUser} />}<WhisperBox role={role === 'Admin' ? 'admin' : role === 'Maintenance' ? 'worker' : 'student'} />{actionMessage && <div className="global-toast">✓ {actionMessage}</div>}{popupNotification && <div className="notification-toast" role="status" aria-live="polite"><span className="notification-toast-icon">♢</span><div><strong>{popupNotification.title}</strong><p>{popupNotification.message}</p></div><button onClick={() => setPopupNotification(null)} aria-label="Dismiss notification">×</button></div>}</>
}

function WhisperBox({ role }: { role: FeedbackRole }) {
  const [isOpen, setIsOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function openFeedback() {
      setSubmitted(false)
      setError('')
      setIsOpen(true)
    }

    window.addEventListener('smart-campus-open-feedback', openFeedback)
    return () => window.removeEventListener('smart-campus-open-feedback', openFeedback)
  }, [])

  function close() {
    setIsOpen(false)
    setFeedback('')
    setSubmitted(false)
    setSaving(false)
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = feedback.trim()
    if (!message) {
      setError('Please enter your feedback before submitting.')
      return
    }

    setSaving(true)
    try {
      await submitFeedback(message, role)
      setSubmitted(true)
      setError('')
      window.dispatchEvent(new Event('smart-campus-feedback-updated'))
    } catch (saveError) {
      console.error('Unable to submit website feedback.', saveError)
      setError('Feedback could not be sent. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button className="whisper-trigger" type="button" onClick={() => setIsOpen(true)} aria-label="Open Whisper box feedback form">
        <span className="whisper-icon" aria-hidden="true">✦</span>
        <strong>Whisper box</strong>
        <small>Share feedback</small>
      </button>
      {isOpen && <div className="modal-backdrop whisper-backdrop"><section className="report-modal whisper-modal" role="dialog" aria-modal="true" aria-labelledby="whisper-title">
        <div className="modal-heading"><div><p className="eyebrow">YOUR VOICE MATTERS</p><h2 id="whisper-title">Whisper box</h2><p>Share feedback about your Smart Campus experience.</p></div><button className="modal-close" type="button" onClick={close} aria-label="Close feedback form">×</button></div>
        {submitted
          ? <div className="whisper-success" role="status"><span aria-hidden="true">✓</span><p>Thank you for helping us make campus better.</p><button className="login-button" type="button" onClick={close}>Done</button></div>
          : <form className="whisper-form" onSubmit={submit}><label htmlFor="whisper-feedback">Your feedback<textarea id="whisper-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="What can we improve?" rows={5} maxLength={1000} required /></label>{error && <p className="whisper-error" role="alert">{error}</p>}<button className="login-button" type="submit" disabled={saving}>{saving ? 'Sending…' : 'Send feedback'} {!saving && <span>→</span>}</button></form>}
      </section></div>}
    </>
  )
}

const helpGuides: Record<Role, { intro: string; steps: string[] }> = {
  Student: {
    intro: 'Report a campus issue and keep track of the team’s progress.',
    steps: [
      'Choose “Report an issue” from your dashboard to describe the problem.',
      'Add the building, floor, and room so the campus team can find it.',
      'Include a photo when it helps explain the issue, then check your dashboard for status updates.',
    ],
  },
  Admin: {
    intro: 'Keep the campus queue moving and make sure every report reaches the right team.',
    steps: [
      'Review pending complaints in the queue and use the status or building filters.',
      'Assign unassigned reports to the maintenance team member best suited to the issue.',
      'Check the dashboard and notifications for new reports and assignment updates.',
    ],
  },
  Maintenance: {
    intro: 'Use your work queue to review assigned issues and keep their status up to date.',
    steps: [
      'Open a job’s details to review the reported location and category.',
      'Update the status as work progresses so students and admins can follow along.',
      'Add a resolution note when complete to explain what was fixed.',
    ],
  },
}

function HelpCenter({ role, onClose }: { role: Role; onClose: () => void }) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const guide = helpGuides[role]
  return <div className="modal-backdrop help-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="report-modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div className="modal-heading">
        <div><p className="eyebrow">{role.toUpperCase()} SUPPORT</p><h2 id="help-title">Help center</h2><p>{guide.intro}</p></div>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close help center">×</button>
      </div>
      <section className="help-guide" aria-labelledby="help-guide-title">
        <h3 id="help-guide-title">Quick guide</h3>
        <ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </section>
      <section className="help-faq" aria-labelledby="help-faq-title">
        <h3 id="help-faq-title">Frequently asked questions</h3>
        <details><summary>What do the complaint statuses mean?</summary><p><strong>Pending</strong> means the report is awaiting action. <strong>In progress</strong> means the team is working on it. <strong>Resolved</strong> means the issue has been marked complete.</p></details>
        <details><summary>Can I change a report after submitting it?</summary><p>Reports can’t currently be edited from the dashboard. Share feedback with the campus team if you need to clarify a report.</p></details>
        <details><summary>What if I can’t find a maintenance task?</summary><p>Tasks appear in the maintenance account they’re assigned to. Contact an admin to check or update the assignment.</p></details>
      </section>
      <div className="help-support">
        <div><strong>Still need help?</strong><p>Share feedback through the Whisper box. Submissions may appear in Campus whispers.</p></div>
        <button className="help-feedback-button" type="button" onClick={() => {
          onClose()
          window.dispatchEvent(new Event('smart-campus-open-feedback'))
        }}>Share feedback <span aria-hidden="true">→</span></button>
      </div>
    </section>
  </div>
}

function PublicFeedbackPanel({ title = 'Campus whispers' }: { title?: string }) {
  const [feedback, setFeedback] = useState<PublicFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadFeedback() {
      setLoading(true)
      setError('')
      try {
        const entries = await getPublicFeedback()
        if (active) setFeedback(entries)
      } catch (loadError) {
        console.error('Unable to load public feedback.', loadError)
        if (active) setError('Feedback is temporarily unavailable.')
      } finally {
        if (active) setLoading(false)
      }
    }

    const refresh = () => { void loadFeedback() }
    void loadFeedback()
    window.addEventListener('smart-campus-feedback-updated', refresh)
    return () => {
      active = false
      window.removeEventListener('smart-campus-feedback-updated', refresh)
    }
  }, [])

  return (
    <section className="public-feedback" aria-labelledby="public-feedback-title">
      <div className="public-feedback-heading"><div><h3 id="public-feedback-title">{title}</h3></div><span aria-hidden="true">✦</span></div>
      {loading
        ? <p className="public-feedback-message">Loading student feedback…</p>
        : error
          ? <p className="public-feedback-message" role="status">{error}</p>
          : feedback.length
            ? <div className="public-feedback-list">{feedback.slice(0, 3).map((entry) => (
              <blockquote className="public-feedback-entry" key={entry.id}>
                <p>“{entry.message}”</p>
                <footer><span>{entry.role === 'admin' ? 'Campus admin' : entry.role === 'worker' ? 'Campus worker' : 'Campus student'}</span><time dateTime={entry.createdAt}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(entry.createdAt))}</time></footer>
              </blockquote>
            ))}</div>
            : <p className="public-feedback-message">No feedback yet. Be the first to share what you think.</p>}
    </section>
  )
}

type BuildingReport = { location: string; date: string; createdAt?: string }
type BuildingReportCount = { building: string; count: number }

function getReportMonth(report: BuildingReport): { key: string; label: string } {
  const date = report.createdAt ? new Date(report.createdAt) : new Date(`${report.date} ${new Date().getFullYear()}`)
  if (Number.isNaN(date.getTime())) return { key: 'unknown', label: 'Unknown month' }
  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date),
  }
}

function BuildingReportsChart({ reports }: { reports: BuildingReport[] }) {
  const monthOptions = [...new Map(reports.map((report) => {
    const month = getReportMonth(report)
    return [month.key, month]
  })).values()].filter((month) => month.key !== 'unknown').sort((first, second) => second.key.localeCompare(first.key))
  const [selectedMonth, setSelectedMonth] = useState('')
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const monthKey = monthOptions.some((month) => month.key === selectedMonth)
    ? selectedMonth
    : monthOptions[0]?.key ?? currentMonth
  const monthLabel = monthOptions.find((month) => month.key === monthKey)?.label
    ?? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date())
  const buildingCounts = reports.reduce<BuildingReportCount[]>((counts, report) => {
    if (getReportMonth(report).key !== monthKey) return counts
    const building = report.location.split('·')[0].trim()
    const existing = counts.find((item) => item.building === building)
    if (existing) existing.count += 1
    else counts.push({ building, count: 1 })
    return counts
  }, []).sort((first, second) => second.count - first.count || first.building.localeCompare(second.building))
  const total = buildingCounts.reduce((sum, item) => sum + item.count, 0)
  const colors = ['#d8735e', '#e5ad5d', '#6f9c82', '#718ba8', '#ac83a7', '#8d7967']
  let angle = 0
  const pieBackground = buildingCounts.map((item, index) => {
    const start = angle
    angle += (item.count / total) * 360
    return `${colors[index % colors.length]} ${start}deg ${angle}deg`
  }).join(', ')

  return (
    <section className="building-reports-panel" aria-labelledby="building-reports-title">
      <div className="panel-heading"><div><p className="eyebrow">MONTHLY BREAKDOWN</p><h2 id="building-reports-title">Reports by building</h2></div>
        <label className="building-month-select"><span className="sr-only">Select report month</span><select value={monthKey} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Select report month">
          {!monthOptions.length && <option value={currentMonth}>{monthLabel}</option>}
          {monthOptions.map((month) => <option value={month.key} key={month.key}>{month.label}</option>)}
        </select></label>
      </div>
      {total
        ? <div className="building-chart-content">
          <div className="building-pie" role="img" aria-label={`${total} reports by building for ${monthLabel}: ${buildingCounts.map((item) => `${item.building}, ${item.count}`).join('; ')}`} style={{ background: `conic-gradient(${pieBackground})` }} />
          <ul className="building-legend">{buildingCounts.map((item, index) => <li key={item.building}><span className="building-legend-swatch" style={{ backgroundColor: colors[index % colors.length] }} /><span className="building-legend-name">{item.building}</span><strong>{item.count}</strong><small>{Math.round((item.count / total) * 100)}%</small></li>)}</ul>
        </div>
        : <p className="public-feedback-message">No building reports for {monthLabel}.</p>}
    </section>
  )
}

function Login({ onLogin }: { onLogin: (role: Role, email: string, password: string) => void }) {
  const [role, setRole] = useState<Role>('Student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onLogin(role, email, password)
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand"><span className="brand-mark" aria-hidden="true">✦</span><strong>Smart Campus</strong></div>
        <div className="auth-message"><span className="banner-label">CAMPUS CARE</span><h1>A better campus starts with being heard.</h1><p>One clear place to report an issue, track its progress, and help your campus work better for everyone.</p><div className="auth-stat"><strong>2.3 days</strong><span>average response time this month</span></div></div>
        <div className="auth-shape shape-one"></div><div className="auth-shape shape-two"></div>
      </section>
      <section className="auth-card"><div className="auth-card-inner"><p className="eyebrow">WELCOME BACK</p><h2>Sign in to your campus</h2><p className="auth-intro">Choose your account type to continue.</p><div className="role-tabs" role="tablist">{(['Student', 'Admin', 'Maintenance'] as Role[]).map((item) => <button key={item} type="button" className={role === item ? 'selected' : ''} onClick={() => setRole(item)}>{item}</button>)}</div><form onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={`${role.toLowerCase()}@campus.edu`} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label><div className="form-options"><label className="remember"><input type="checkbox" /> <span>Remember me</span></label><a href="#forgot">Forgot password?</a></div><button className="login-button" type="submit">Sign in as {role} <span>→</span></button></form><p className="auth-note">New to the system? <a href="#register">Create an account</a></p><PublicFeedbackPanel /></div></section>
    </main>
  )
}

function ReportForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (draft: ReportDraft) => SubmittedReport }) {
  const [photo, setPhoto] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submittedReportId, setSubmittedReportId] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const selects = form.querySelectorAll('select')
    const description = form.querySelector('textarea')?.value.trim() ?? ''
    const title = description.length > 64 ? `${description.slice(0, 61)}...` : description
    const report = onSubmit({
      title,
      category: selects[0]?.value ?? '',
      location: `${selects[1]?.value ?? ''} · ${selects[2]?.value ?? ''} · ${form.querySelector<HTMLInputElement>('input:not([type="file"])')?.value.trim() ?? ''}`,
    })
    setSubmittedReportId(report.id)
    setSubmitted(true)
  }

  if (submitted) {
    return <div className="modal-backdrop"><section className="report-modal success-modal"><button className="modal-close" onClick={onClose} aria-label="Close">×</button><div className="success-icon">✓</div><p className="eyebrow">REPORT RECEIVED</p><h2>Your issue is in the queue.</h2><p className="success-copy">Your complaint has been submitted successfully. The campus team will review it and update you as it moves forward.</p><div className="ticket-number"><span>Complaint ID</span><strong>{submittedReportId}</strong><b>Pending</b></div><button className="login-button" onClick={onClose}>Back to overview</button></section></div>
  }

  return <div className="modal-backdrop"><section className="report-modal"><div className="modal-heading"><div><p className="eyebrow">NEW COMPLAINT</p><h2>Report an issue</h2><p>Give us the details so the right team can act quickly.</p></div><button className="modal-close" onClick={onClose} aria-label="Close">×</button></div><form className="report-form" onSubmit={submit}><label className="photo-upload">{photo ? <img src={photo} alt="Selected issue" /> : <><span>＋</span><strong>Add a photo</strong><small>JPG or PNG, up to 5 MB</small></>}<input type="file" accept="image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file) setPhoto(URL.createObjectURL(file)) }} />{photo && <button type="button" className="remove-photo" onClick={() => setPhoto(null)}>Remove photo</button>}</label><div className="form-grid"><label>Category<select required defaultValue=""><option value="" disabled>Select a category</option><option>Furniture</option><option>AC / Cooler</option><option>Electrical</option><option>Washroom</option><option>Cleanliness</option><option>Other</option></select></label><label>Building<select required defaultValue=""><option value="" disabled>Select building</option><option>Block A</option><option>Block B</option><option>Block C</option><option>Block D</option><option>Library</option><option>Sports Complex</option></select></label><label>Floor<select required defaultValue=""><option value="" disabled>Select floor</option><option>Ground Floor</option><option>1st Floor</option><option>2nd Floor</option><option>3rd Floor</option></select></label><label>Room / section<input required placeholder="e.g. Room 204 or East Wing" /></label></div><label className="description-label">Describe the issue<textarea required rows={4} placeholder="Tell us what happened and anything that may help the maintenance team..."></textarea></label><div className="form-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="login-button">Submit complaint <span>→</span></button></div></form></section></div>
}

type AdminReport = { id: string; title: string; location: string; category: string; status: string; date: string; assignee: string; responseDays?: number }
const adminReports: AdminReport[] = [
  { id: 'SC-0148', title: 'Broken chair in lecture hall', location: 'Block A · 2nd Floor · Room 204', category: 'Furniture', status: 'In progress', date: 'Sep 16', assignee: 'Ravi Mehta', responseDays: 2.6 },
  { id: 'SC-0147', title: 'Flickering lights near staircase', location: 'Block B · Ground Floor · East Wing', category: 'Electrical', status: 'Pending', date: 'Sep 14', assignee: 'Unassigned' },
  { id: 'SC-0146', title: 'Water leakage in washroom', location: 'Block A · 1st Floor · North Wing', category: 'Washroom', status: 'Resolved', date: 'Sep 10', assignee: 'Vikram Singh', responseDays: 2 },
  { id: 'SC-0145', title: 'AC not cooling properly', location: 'Block C · 3rd Floor · Lab 301', category: 'AC / Cooler', status: 'Pending', date: 'Sep 09', assignee: 'Unassigned' },
]

function AdminDashboard({ onSignOut, onSwitchUser, submittedReports, notifications, onMarkNotificationsRead, onReportAssigned }: { onSignOut: () => void; onSwitchUser: (nextRole: Role) => void; submittedReports: SubmittedReport[]; notifications: CampusNotification[]; onMarkNotificationsRead: () => void; onReportAssigned: (reportId: string, staff: string, task: Omit<MaintenanceJob, 'id' | 'status' | 'assignee'>) => void }) {
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [buildingFilter, setBuildingFilter] = useState('All buildings')
  const [assigned, setAssigned] = useState<Record<string, string>>(loadReportAssignments)
  const [notice, setNotice] = useState('')
  const [activeSection, setActiveSection] = useState('admin-overview')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const allReports = [
    ...submittedReports.map((report) => ({ ...report, assignee: assigned[report.id] || report.assignee || 'Unassigned' })),
    ...adminReports.map((report) => ({ ...report, assignee: assigned[report.id] || report.assignee })),
  ]
  const filteredReports = allReports.filter((report) => (statusFilter === 'All statuses' || report.status === statusFilter) && (buildingFilter === 'All buildings' || report.location.startsWith(buildingFilter)))
  const pendingCount = allReports.filter((report) => report.status === 'Pending').length
  const inProgressCount = allReports.filter((report) => report.status === 'In progress').length
  const resolvedCount = allReports.filter((report) => report.status === 'Resolved').length
  const openCount = pendingCount + inProgressCount
  const unassignedPendingCount = allReports.filter((report) => report.status === 'Pending' && report.assignee === 'Unassigned').length
  const resolutionRate = allReports.length ? Math.round((resolvedCount / allReports.length) * 100) : 0
  const categoryCounts = ['Furniture', 'Electrical', 'Washroom', 'AC / Cooler'].map((category) => ({
    category,
    count: allReports.filter((report) => report.category === category).length,
  }))
  const staff = [
    { name: 'Ravi Mehta', speciality: 'Electrical', phone: '+1 (555) 010-0148' },
    { name: 'Vikram Singh', speciality: 'Plumbing', phone: '+1 (555) 010-0146' },
    { name: 'Neha Joshi', speciality: 'HVAC', phone: '+1 (555) 010-0145' },
  ]

  function navigateToSection(section: string) {
    setActiveSection(section)
    setShowNotifications(false)
  }

  useEffect(() => {
    function syncAssignments(event: StorageEvent) {
      if (event.key === REPORT_ASSIGNMENTS_KEY) setAssigned(loadReportAssignments())
    }
    window.addEventListener('storage', syncAssignments)
    return () => window.removeEventListener('storage', syncAssignments)
  }, [])

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>('.admin-content .admin-stats article')
    const metrics = [
      { label: 'Total complaints', value: allReports.length, detail: 'All campus reports' },
      { label: 'Pending review', value: pendingCount, detail: `${unassignedPendingCount} need assignment` },
      { label: 'In progress', value: inProgressCount, detail: `${inProgressCount} active assignments` },
      { label: 'Resolved', value: resolvedCount, detail: `${resolutionRate}% resolution rate` },
    ]

    metrics.forEach((metric, index) => {
      const card = cards.item(index)
      const label = card?.querySelector('small')
      const value = card?.querySelector('strong')
      const detail = card?.querySelector('em')
      if (label) label.textContent = metric.label
      if (value) value.textContent = String(metric.value)
      if (detail) detail.textContent = metric.detail
    })

    const openMetric = document.querySelector('.admin-content .admin-date strong')
    if (openMetric) openMetric.textContent = String(openCount)
  }, [allReports.length, pendingCount, inProgressCount, resolvedCount, unassignedPendingCount, resolutionRate, openCount])

  function assign(report: AdminReport, staff: string) {
    const updatedAssignments = { ...assigned, [report.id]: staff }
    setAssigned(updatedAssignments)
    localStorage.setItem(REPORT_ASSIGNMENTS_KEY, JSON.stringify(updatedAssignments))
    onReportAssigned(report.id, staff, {
      title: report.title,
      location: report.location,
      category: report.category,
      priority: 'Medium',
      due: 'Today',
    })
    setNotice(staff === 'Unassigned' ? `${report.id} is unassigned` : `${report.id} assigned to ${staff}`)
    window.setTimeout(() => setNotice(''), 2600)
  }

  return (
    <div className="app-shell admin-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">✦</span><span>Smart Campus</span></div>
        <div className="profile"><div className="avatar">PS</div><div><strong>Priya Shah</strong><small>Admin account</small></div><span className="chevron">⌄</span></div>
        <nav>
          <a className={activeSection === 'admin-overview' ? 'active' : ''} href="#admin-overview" onClick={() => navigateToSection('admin-overview')}><span>▦</span> Dashboard</a>
          <a className={activeSection === 'admin-reports' ? 'active' : ''} href="#admin-reports" onClick={() => navigateToSection('admin-reports')}><span>◉</span> All complaints <b>{allReports.length}</b></a>
          <a className={activeSection === 'staff' ? 'active' : ''} href="#staff" onClick={() => navigateToSection('staff')}><span>♧</span> Maintenance staff</a>
          <a className={activeSection === 'analytics' ? 'active' : ''} href="#analytics" onClick={() => navigateToSection('analytics')}><span>◒</span> Analytics</a>
        </nav>
        <div className="sidebar-bottom"><button className="help-center-link" type="button" onClick={() => setShowHelp(true)}><span>?</span> Help center</button><button className="sign-out" onClick={onSignOut}><span>↪</span> Sign out</button></div>
      </aside>
      <main id="admin-overview" className="main-content admin-content">
        <header className="topbar">
          <div><p className="eyebrow">ADMINISTRATION · MONDAY, 19 SEPTEMBER 2026</p><h1>Good morning, Priya.</h1><p className="subheading">Here is what needs your attention today.</p></div>
          <div className="header-actions">
            <button className="icon-button" aria-label={`Notifications${notifications.some((item) => !item.read) ? ', unread updates' : ''}`} aria-expanded={showNotifications} onClick={() => setShowNotifications((current) => !current)}>♢{notifications.some((item) => !item.read) && <i className="notification-badge">{notifications.filter((item) => !item.read).length}</i>}</button>
            <AccountMenu role="Admin" onSwitchUser={onSwitchUser} />
            {showNotifications && <Notifications notifications={notifications} onClose={() => setShowNotifications(false)} onMarkAllRead={onMarkNotificationsRead} />}
          </div>
        </header>
        <section className="admin-intro"><div><p className="eyebrow">CAMPUS OPERATIONS</p><h2>Make every report count.</h2><p>Review new complaints, keep assignments moving, and give students visibility at every step.</p></div><div className="admin-date"><strong>{openCount}</strong><span>open complaints<br />need attention</span></div></section>
        <div className="admin-stats">
          <article><span className="admin-stat-icon coral">◌</span><small>Total complaints</small><strong>{allReports.length}</strong><em>All campus reports</em></article>
          <article><span className="admin-stat-icon amber pending-review-icon" aria-hidden="true"></span><small>Pending review</small><strong>{pendingCount}</strong><em className="orange">{unassignedPendingCount} need assignment</em></article>
          <article><span className="admin-stat-icon blue">♧</span><small>In progress</small><strong>{inProgressCount}</strong><em>{inProgressCount} active assignments</em></article>
          <article><span className="admin-stat-icon green">✓</span><small>Resolved</small><strong>{resolvedCount}</strong><em>{resolutionRate}% resolution rate</em></article>
        </div>
        <section className="admin-table-panel" id="admin-reports">
          <div className="panel-heading"><div><p className="eyebrow">WORK QUEUE</p><h2>Complaints to manage</h2></div><span className="queue-count">{filteredReports.length} of {allReports.length} shown</span></div>
          <div className="admin-filters">
            <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Pending</option><option>In progress</option><option>Resolved</option></select>
            <select aria-label="Filter by building" value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}><option>All buildings</option><option>Block A</option><option>Block B</option><option>Block C</option><option>Block D</option></select>
            <button className="filter-button" onClick={() => { setStatusFilter('All statuses'); setBuildingFilter('All buildings') }}>Clear filters</button>
          </div>
          <div className="admin-table">
            <div className="admin-table-head"><span>Complaint</span><span>Location</span><span>Category</span><span>Status</span><span>Assignment</span></div>
            {filteredReports.map((report) => <div className="admin-table-row" key={report.id}>
              <div className="admin-complaint"><StatusIcon status={report.status} /><div><strong>{report.title}</strong><small>{report.id} · {report.date}</small></div></div>
              <span className="table-location">{report.location}</span><span className="table-category">{report.category}</span>
              <span className={`status ${report.status === 'Resolved' ? 'resolved' : report.status === 'Pending' ? 'pending' : 'in-progress'}`}>{report.status}</span>
              <select className="assign-select" aria-label={`Assign ${report.id}`} value={assigned[report.id] || report.assignee} onChange={(event) => assign(report, event.target.value)}><option>Unassigned</option><option>Ravi Mehta</option><option>Vikram Singh</option><option>Neha Joshi</option></select>
            </div>)}
          </div>
          {filteredReports.length === 0 && <p className="empty-queue">No complaints match these filters.</p>}
        </section>
        <section className="admin-table-panel admin-extra-panel" id="staff">
          <div className="panel-heading"><div><p className="eyebrow">CAMPUS TEAM</p><h2>Maintenance staff</h2></div></div>
          <div className="staff-list">{staff.map((member) => {
            const activeTasks = allReports.filter((report) => (assigned[report.id] || report.assignee) === member.name && report.status !== 'Resolved').length
            return <article className="staff-card" key={member.name}><div className="avatar">{member.name.split(' ').map((part) => part[0]).join('')}</div><div><strong>{member.name}</strong><span>{member.speciality}</span><small>{member.phone}</small></div><b>{activeTasks} active {activeTasks === 1 ? 'task' : 'tasks'}</b></article>
          })}</div>
        </section>
        <section className="admin-table-panel admin-extra-panel" id="analytics">
          <div className="panel-heading"><div><p className="eyebrow">CAMPUS INSIGHTS</p><h2>Complaint analytics</h2></div></div>
          <div className="analytics-summary"><div><span>Resolution rate</span><strong>{resolutionRate}%</strong></div><div><span>Pending review</span><strong>{pendingCount}</strong></div><div><span>In progress</span><strong>{inProgressCount}</strong></div><div><span>Resolved</span><strong>{resolvedCount}</strong></div></div>
          <h3 className="analytics-subtitle">Reports by category</h3>
          <div className="category-bars">{categoryCounts.map(({ category, count }) => <div className="category-bar-row" key={category}><span>{category}</span><div><i style={{ width: `${allReports.length ? (count / allReports.length) * 100 : 0}%` }} /></div><strong>{count}</strong></div>)}</div>
        </section>
        <div className="admin-insights-grid">
          <PublicFeedbackPanel title="System insights" />
          <BuildingReportsChart reports={allReports} />
        </div>
        {notice && <div className="admin-toast">✓ {notice}</div>}
        {showHistory && <StatusHistory onClose={() => setShowHistory(false)} />}
        {showHelp && <HelpCenter role="Admin" onClose={() => setShowHelp(false)} />}
      </main>
    </div>
  )
}

type MaintenanceJob = { id: string; title: string; location: string; category: string; priority: string; status: string; due: string; assignee?: string; resolutionNote?: string }
const MAINTENANCE_JOBS_KEY = 'smart-campus-maintenance-jobs'
const maintenanceJobs: MaintenanceJob[] = [
  { id: 'SC-0148', title: 'Broken chair in lecture hall', location: 'Block A · 2nd Floor · Room 204', category: 'Furniture', priority: 'High', status: 'In progress', due: 'Today', assignee: 'Ravi Mehta' },
  { id: 'SC-0147', title: 'Flickering lights near staircase', location: 'Block B · Ground Floor · East Wing', category: 'Electrical', priority: 'Medium', status: 'Assigned', due: 'Tomorrow' },
  { id: 'SC-0145', title: 'AC not cooling properly', location: 'Block C · 3rd Floor · Lab 301', category: 'AC / Cooler', priority: 'High', status: 'Assigned', due: 'Sep 22' },
]

function isMaintenanceJob(job: unknown): job is MaintenanceJob {
  if (typeof job !== 'object' || job === null) return false
  return 'id' in job && typeof job.id === 'string' &&
    'title' in job && typeof job.title === 'string' &&
    'location' in job && typeof job.location === 'string' &&
    'category' in job && typeof job.category === 'string' &&
    'priority' in job && typeof job.priority === 'string' &&
    'status' in job && typeof job.status === 'string' &&
    'due' in job && typeof job.due === 'string' &&
    (!('resolutionNote' in job) || typeof job.resolutionNote === 'string')
}

function loadMaintenanceJobs(): MaintenanceJob[] {
  const storedJobs = localStorage.getItem(MAINTENANCE_JOBS_KEY)
  if (!storedJobs) return maintenanceJobs

  try {
    const parsedJobs: unknown = JSON.parse(storedJobs)
    if (!Array.isArray(parsedJobs) || !parsedJobs.every(isMaintenanceJob)) {
      throw new Error('Stored maintenance jobs have an invalid format')
    }
    const jobsWithSeedAssignments = parsedJobs.filter(isMaintenanceJob).map((job) => {
      const seedAssignment = maintenanceJobs.find((seedJob) => seedJob.id === job.id)?.assignee
      return job.assignee || !seedAssignment ? job : { ...job, assignee: seedAssignment }
    })
    return [...new Map(jobsWithSeedAssignments.map((job) => [job.id, job])).values()]
  } catch {
    localStorage.removeItem(MAINTENANCE_JOBS_KEY)
    return maintenanceJobs
  }
}

function MaintenanceDashboard({ onSignOut, onSwitchUser, submittedReports, notifications, onMarkNotificationsRead }: { onSignOut: () => void; onSwitchUser: (nextRole: Role) => void; submittedReports: SubmittedReport[]; notifications: CampusNotification[]; onMarkNotificationsRead: () => void }) {
  const [storedJobs, setJobs] = useState(loadMaintenanceJobs)
  const [assignments, setAssignments] = useState(loadReportAssignments)
  const reportRecords = [
    ...submittedReports.map((report) => ({ ...report, assignee: assignments[report.id] || report.assignee || 'Unassigned' })),
    ...adminReports.map((report) => ({ ...report, assignee: assignments[report.id] || report.assignee })),
  ]
  const reportJobs = reportRecords.flatMap((report): MaintenanceJob[] => {
    if (report.assignee !== roleDetails.Maintenance.name) return []
    const savedJob = storedJobs.find((job) => job.id === report.id)
    return [{
      id: report.id,
      title: report.title,
      location: report.location,
      category: report.category,
      priority: savedJob?.priority ?? 'Medium',
      status: savedJob?.status ?? (report.status === 'Pending' ? 'Assigned' : report.status),
      due: savedJob?.due ?? 'Today',
      assignee: report.assignee,
      ...(savedJob?.resolutionNote ? { resolutionNote: savedJob.resolutionNote } : {}),
    }]
  })
  const assignedNotificationJobs = notifications.flatMap((notification): MaintenanceJob[] => {
    const assignee = notification.message.split(' was assigned to ').at(-1)?.replace(/\.$/, '')
    if (notification.type !== 'task-assigned' || !notification.task || assignee !== roleDetails.Maintenance.name || reportRecords.some((report) => report.id === notification.reportId)) return []
    return [{
      ...notification.task,
      id: notification.reportId,
      status: 'Assigned',
      assignee,
    }]
  })
  const jobsById = new Map<string, MaintenanceJob>()
  const allJobs = [...reportJobs, ...assignedNotificationJobs]
  allJobs.forEach((job) => {
    if (!jobsById.has(job.id)) jobsById.set(job.id, job)
  })
  const jobs = [...jobsById.values()]
  const [selectedJob, setSelectedJob] = useState<MaintenanceJob | null>(null)
  const [detailsJob, setDetailsJob] = useState<MaintenanceJob | null>(null)
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState('')
  const [activeSection, setActiveSection] = useState<'work' | 'completed' | 'notifications'>('work')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const activeJobs = jobs.filter((job) => job.status !== 'Resolved')
  const completedJobs = jobs.filter((job) => job.status === 'Resolved')
  const highPriorityJobs = activeJobs.filter((job) => job.priority === 'High')

  useEffect(() => {
    function syncAssignments(event: StorageEvent) {
      if (event.key === REPORT_ASSIGNMENTS_KEY) setAssignments(loadReportAssignments())
    }
    window.addEventListener('storage', syncAssignments)
    return () => window.removeEventListener('storage', syncAssignments)
  }, [])

  function persistJobs(updatedJobs: MaintenanceJob[]) {
    const updatedJobIds = new Set(updatedJobs.map((job) => job.id))
    const persistedJobs = [
      ...updatedJobs,
      ...storedJobs.filter((job) => job.assignee !== roleDetails.Maintenance.name && !updatedJobIds.has(job.id)),
    ]
    localStorage.setItem(MAINTENANCE_JOBS_KEY, JSON.stringify(persistedJobs))
    setJobs(persistedJobs)
  }

  function updateStatus(jobId: string, status: string) {
    const updatedJobs = jobs.map((job) => job.id === jobId ? { ...job, status } : job)
    persistJobs(updatedJobs)
    setNotice(`${jobId} marked ${status.toLowerCase()}`)
    window.setTimeout(() => setNotice(''), 2600)
  }

  function navigateToSection(section: 'work' | 'completed') {
    setActiveSection(section)
    setShowNotifications(false)
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function toggleNotifications() {
    const opening = !showNotifications
    setShowNotifications(opening)
    setActiveSection(opening ? 'notifications' : 'work')
  }

  function saveNote() {
    if (!selectedJob) return
    const resolutionNote = note.trim()
    if (!resolutionNote) {
      setNotice('Enter a resolution note before saving')
      window.setTimeout(() => setNotice(''), 2600)
      return
    }

    const updatedJobs = jobs.map((job) => job.id === selectedJob.id ? { ...job, resolutionNote } : job)
    persistJobs(updatedJobs)
    setNotice(`Note saved for ${selectedJob.id}`)
    setSelectedJob(null)
    setNote('')
    window.setTimeout(() => setNotice(''), 2600)
  }

  function renderJobCards(jobList: MaintenanceJob[]) {
    return jobList.map((job) => <article className="job-card" key={job.id}>
      <div className="job-card-top">
        <div className="job-title"><StatusIcon status={job.status} /><div><strong>{job.title}</strong><small>{job.id} · Reported Sep 16 by Arjun Kumar</small></div></div>
        <span className={`priority ${job.priority.toLowerCase()}`}>{job.priority} priority</span>
      </div>
      <div className="job-info"><span>⌖ {job.location}</span><span>▣ {job.category}</span><span>Due: <b>{job.due}</b></span></div>
      <div className="job-actions">
        <select aria-label={`Update status for ${job.id}`} value={job.status} onChange={(event) => updateStatus(job.id, event.target.value)}><option>Assigned</option><option>In progress</option><option>Resolved</option></select>
        <button className="note-button" onClick={() => { setSelectedJob(job); setNote(job.resolutionNote ?? '') }}>＋ {job.resolutionNote ? 'Edit resolution note' : 'Add resolution note'}</button>
        <button className="details-button" onClick={() => setDetailsJob(job)}>View details <span>→</span></button>
      </div>
    </article>)
  }

  return (
    <div className="app-shell maintenance-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">✦</span><span>Smart Campus</span></div>
        <div className="profile"><div className="avatar">RM</div><div><strong>Ravi Mehta</strong><small>Maintenance account</small></div><span className="chevron">⌄</span></div>
        <nav>
          <a className={activeSection === 'work' ? 'active' : ''} href="#work" onClick={(event) => { event.preventDefault(); navigateToSection('work') }}><span>▦</span> My work <b>{activeJobs.length}</b></a>
          <a className={activeSection === 'completed' ? 'active' : ''} href="#completed" onClick={(event) => { event.preventDefault(); navigateToSection('completed') }}><span>✓</span> Completed jobs <b>{completedJobs.length}</b></a>
          <a className={activeSection === 'notifications' ? 'active' : ''} href="#notifications" onClick={(event) => { event.preventDefault(); toggleNotifications() }}><span>♢</span> Notifications</a>
        </nav>
        <div className="sidebar-bottom"><button className="help-center-link" type="button" onClick={() => setShowHelp(true)}><span>?</span> Help center</button><button className="sign-out" onClick={onSignOut}><span>↪</span> Sign out</button></div>
      </aside>
      <main className="main-content maintenance-content">
        <header className="topbar">
          <div><p className="eyebrow">MAINTENANCE TEAM · MONDAY, 19 SEPTEMBER 2026</p><h1>Good morning, Ravi.</h1><p className="subheading">Here are the issues assigned to you.</p></div>
          <div className="header-actions">
            <button className="icon-button" aria-label={`Notifications${notifications.some((item) => !item.read) ? ', unread updates' : ''}`} aria-expanded={showNotifications} onClick={toggleNotifications}>♢{notifications.some((item) => !item.read) && <i className="notification-badge">{notifications.filter((item) => !item.read).length}</i>}</button>
            <AccountMenu role="Maintenance" onSwitchUser={onSwitchUser} />
            {showNotifications && <Notifications notifications={notifications} onClose={() => { setShowNotifications(false); setActiveSection('work') }} onMarkAllRead={onMarkNotificationsRead} />}
          </div>
        </header>
        <section className="maintenance-banner"><div><p className="eyebrow">TODAY'S FOCUS</p><h2>Small fixes make a big difference.</h2><p>Keep students informed by updating your work as you move through each job.</p></div><div className="work-progress"><strong>{completedJobs.length}</strong><span>of {jobs.length}<br />jobs complete</span></div></section>
        <div className="maintenance-stats">
          <article><span className="admin-stat-icon amber">◷</span><small>Assigned to me</small><strong>{activeJobs.length}</strong><em>Active work orders</em></article>
          <article><span className="admin-stat-icon coral">!</span><small>High priority</small><strong>{highPriorityJobs.length}</strong><em className="orange">Needs attention today</em></article>
          <article><span className="admin-stat-icon green">✓</span><small>Completed jobs</small><strong>{completedJobs.length}</strong><em>From your assigned queue</em></article>
        </div>
        <section className="jobs-panel maintenance-section" id="work">
          <div className="panel-heading"><div><p className="eyebrow">MY WORK QUEUE</p><h2>Assigned complaints</h2></div><span className="queue-count">{activeJobs.length} active {activeJobs.length === 1 ? 'job' : 'jobs'}</span></div>
          <div className="job-list">{renderJobCards(activeJobs)}</div>
          {activeJobs.length === 0 && <p className="empty-queue">No active jobs assigned. You’re all caught up.</p>}
        </section>
        <section className="jobs-panel maintenance-section" id="completed">
          <div className="panel-heading"><div><p className="eyebrow">FINISHED WORK</p><h2>Completed jobs</h2></div><span className="queue-count">{completedJobs.length} {completedJobs.length === 1 ? 'job' : 'jobs'}</span></div>
          <div className="job-list">{renderJobCards(completedJobs)}</div>
          {completedJobs.length === 0 && <p className="empty-queue">No jobs completed yet. Mark a job as resolved to see it here.</p>}
        </section>
        <PublicFeedbackPanel title="Crew feedback" />
        {notice && <div className="admin-toast" role="status">✓ {notice}</div>}
        {detailsJob && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsJob(null) }}><section className="report-modal job-details-modal" role="dialog" aria-modal="true" aria-labelledby="job-details-title">
          <button className="modal-close" onClick={() => setDetailsJob(null)} aria-label="Close details">×</button>
          <p className="eyebrow">{detailsJob.id} · COMPLAINT DETAILS</p>
          <h2 id="job-details-title">{detailsJob.title}</h2>
          <div className="job-details-status"><span>Current status</span><strong className={`status ${detailsJob.status === 'Resolved' ? 'resolved' : detailsJob.status === 'In progress' ? 'in-progress' : 'assigned'}`}>{detailsJob.status}</strong></div>
          <div className="job-details-grid">
            <div><span>Category</span><strong>{detailsJob.category}</strong></div>
            <div><span>Priority</span><strong>{detailsJob.priority}</strong></div>
            <div><span>Location</span><strong>{detailsJob.location}</strong></div>
            <div><span>Due date</span><strong>{detailsJob.due}</strong></div>
            <div><span>Reported by</span><strong>Arjun Kumar</strong></div>
            <div><span>Complaint ID</span><strong>{detailsJob.id}</strong></div>
          </div>
          <section className="resolution-note-box" aria-labelledby="resolution-note-title">
            <h3 id="resolution-note-title">Resolution note</h3>
            <p>{detailsJob.resolutionNote || 'No resolution note has been added yet.'}</p>
          </section>
          <p className="job-details-description">Review the reported issue at the location above. Update the work status as progress is made, and add a resolution note when the task is complete.</p>
          <div className="job-details-actions"><button className="cancel-button" onClick={() => setDetailsJob(null)}>Close</button><button className="login-button" onClick={() => { setSelectedJob(detailsJob); setNote(detailsJob.resolutionNote ?? ''); setDetailsJob(null) }}>{detailsJob.resolutionNote ? 'Edit resolution note' : 'Add resolution note'}</button></div>
        </section></div>}
        {selectedJob && <div className="modal-backdrop"><section className="report-modal note-modal"><button className="modal-close" onClick={() => setSelectedJob(null)} aria-label="Close">×</button><p className="eyebrow">{selectedJob.id} · RESOLUTION NOTE</p><h2>What did you find?</h2><p>Add a short note so the admin and student understand the work completed.</p><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} placeholder="e.g. Replaced the damaged chair leg and tested it for stability..." /><button className="login-button" onClick={saveNote}>Save note <span>→</span></button></section></div>}
        {showHelp && <HelpCenter role="Maintenance" onClose={() => setShowHelp(false)} />}
      </main>
    </div>
  )
}

type HistoryEvent = { title: string; detail: string; date: string; done: boolean; current?: boolean }

const complaintHistory: HistoryEvent[] = [
  { title: 'Complaint submitted', detail: 'Arjun Kumar reported this issue with a photo.', date: 'Sep 16, 10:24 AM', done: true },
  { title: 'Assigned to maintenance', detail: 'Ravi Mehta has been assigned to review the issue.', date: 'Sep 16, 2:10 PM', done: true },
  { title: 'Work in progress', detail: 'The maintenance team is currently working on it.', date: 'Sep 17, 9:05 AM', done: true, current: true },
  { title: 'Resolved', detail: 'The issue will appear here once the work is completed.', date: 'Waiting for update', done: false },
]

function notificationAge(createdAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 60_000))
  if (!Number.isFinite(minutes)) return 'Just now'
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function Notifications({ notifications, onClose, onMarkAllRead }: { notifications: CampusNotification[]; onClose: () => void; onMarkAllRead: () => void }) {
  const hasUnread = notifications.some((notification) => !notification.read)
  return <div className="notification-popover"><div className="notification-head"><div><p className="eyebrow">UPDATES</p><h3>Notifications</h3></div><button onClick={onMarkAllRead} disabled={!hasUnread}>{hasUnread ? 'Mark all read' : 'All caught up'}</button><button className="popover-close" onClick={onClose} aria-label="Close">×</button></div>{notifications.length === 0 ? <p className="notification-empty">You’re all caught up. New updates will appear here.</p> : notifications.map((notification) => <div className={`notification-item ${notification.read ? '' : 'unread'}`} key={notification.id}><span className={`notification-icon ${notification.type === 'task-assigned' ? 'green' : 'coral'}`}>{notification.type === 'task-assigned' ? '✓' : '♢'}</span><div><strong>{notification.title}</strong><p>{notification.message}</p><small>{notificationAge(notification.createdAt)}</small></div></div>)}</div>
}

function StatusHistory({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop"><section className="report-modal history-modal"><button className="modal-close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">SC-0148 · STATUS HISTORY</p><h2>Broken chair in lecture hall</h2><p className="history-location">Block A · 2nd Floor · Room 204</p><div className="history-status"><span>Current status</span><strong>In progress</strong></div><div className="timeline">{complaintHistory.map((event) => <div className={`timeline-event ${event.done ? 'done' : ''} ${event.current ? 'current' : ''}`} key={event.title}><span className="timeline-dot">{event.done ? '✓' : ''}</span><div><strong>{event.title}</strong><p>{event.detail}</p><small>{event.date}</small></div></div>)}</div><button className="login-button" onClick={onClose}>Close timeline</button></section></div>
}

function Dashboard({ role, onSignOut, onSwitchUser, submittedReports, notifications, onMarkNotificationsRead, onReportSubmit, onReportAssigned }: { role: Role; onSignOut: () => void; onSwitchUser: (nextRole: Role) => void; submittedReports: SubmittedReport[]; notifications: CampusNotification[]; onMarkNotificationsRead: () => void; onReportSubmit: (draft: ReportDraft) => SubmittedReport; onReportAssigned: (reportId: string, staff: string, task: Omit<MaintenanceJob, 'id' | 'status' | 'assignee'>) => void }) {
  const user = roleDetails[role]
  const [showReport, setShowReport] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showAllReports, setShowAllReports] = useState(false)
  const [activeSection, setActiveSection] = useState<'overview' | 'reports' | 'notifications'>('overview')
  const overviewReports = [...adminReports, ...submittedReports]
  const inProgressCount = overviewReports.filter((report) => report.status === 'In progress').length
  const resolvedCount = overviewReports.filter((report) => report.status === 'Resolved').length
  const resolutionRate = overviewReports.length ? Math.round((resolvedCount / overviewReports.length) * 100) : 0
  const responseDurations = overviewReports.flatMap((report) => typeof report.responseDays === 'number' ? [report.responseDays] : [])
  const averageResponseDays = responseDurations.length
    ? responseDurations.reduce((total, days) => total + days, 0) / responseDurations.length
    : null

  function navigateToSection(section: 'overview' | 'reports') {
    setActiveSection(section)
    setShowNotifications(false)
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function toggleNotifications() {
    const opening = !showNotifications
    setShowNotifications(opening)
    setActiveSection(opening ? 'notifications' : 'overview')
  }
  useEffect(() => {
    const heading = document.querySelector('.main-content .topbar h1')
    const dateLabel = document.querySelector('.main-content .topbar .eyebrow')
    if (!heading || !dateLabel) return

    const updateHeader = () => {
      const currentDate = new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()).toUpperCase()
      const hour = new Date().getHours()
      const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
      const firstName = roleDetails[role].name.split(' ')[0]
      const datePrefix = role === 'Admin' ? 'ADMINISTRATION · ' : role === 'Maintenance' ? 'MAINTENANCE TEAM · ' : ''

      heading.textContent = `${greeting}, ${firstName}.`
      dateLabel.textContent = `${datePrefix}${currentDate}`
    }

    updateHeader()
    const intervalId = window.setInterval(updateHeader, 60_000)
    return () => window.clearInterval(intervalId)
  }, [role])
  if (role === 'Admin') return <AdminDashboard onSignOut={onSignOut} onSwitchUser={onSwitchUser} submittedReports={submittedReports} notifications={notifications} onMarkNotificationsRead={onMarkNotificationsRead} onReportAssigned={onReportAssigned} />
  if (role === 'Maintenance') return <MaintenanceDashboard onSignOut={onSignOut} onSwitchUser={onSwitchUser} submittedReports={submittedReports} notifications={notifications} onMarkNotificationsRead={onMarkNotificationsRead} />
  return (
    <>
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">✦</span><span>Smart Campus</span></div>
        <div className="profile"><div className="avatar">{user.initials}</div><div><strong>{user.name}</strong><small>{role} account</small></div><span className="chevron">⌄</span></div>
        <nav><a className={activeSection === 'overview' ? 'active' : ''} href="#overview" onClick={(event) => { event.preventDefault(); event.stopPropagation(); navigateToSection('overview') }}><span>▦</span> Overview</a><a className={activeSection === 'reports' ? 'active' : ''} href="#reports" onClick={(event) => { event.preventDefault(); event.stopPropagation(); navigateToSection('reports') }}><span>◉</span> {role === 'Student' ? 'My reports' : 'All reports'} <b>{overviewReports.length}</b></a><a className={activeSection === 'notifications' ? 'active' : ''} href="#notifications" onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleNotifications() }}><span>♢</span> Notifications</a></nav>
        <div className="sidebar-bottom"><button className="help-center-link" type="button" onClick={() => setShowHelp(true)}><span>?</span> Help center</button><button className="sign-out" onClick={onSignOut}><span>↪</span> Sign out</button></div>
      </aside>
      <main id="overview" className="main-content">
        <header className="topbar"><div><p className="eyebrow">MONDAY, 19 SEPTEMBER 2026</p><h1>Good morning, {user.name.split(' ')[0]}.</h1><p className="subheading">{user.description}</p></div><div className="header-actions"><button className="icon-button" aria-label={`Notifications${notifications.some((item) => !item.read) ? ', unread updates' : ''}`} onClick={() => setShowNotifications((current) => !current)}>♢{notifications.some((item) => !item.read) && <i className="notification-badge">{notifications.filter((item) => !item.read).length}</i>}</button><AccountMenu role={role} onSwitchUser={onSwitchUser} /><button className="report-button" onClick={() => setShowReport(true)}>＋ Report an issue</button>{showNotifications && <Notifications notifications={notifications} onClose={() => setShowNotifications(false)} onMarkAllRead={onMarkNotificationsRead} />}</div></header>
        <section className="welcome-banner"><div><span className="banner-label">CAMPUS CARE</span><h2>See something that needs attention?</h2><p>Report it in under a minute. Add a photo and exact location so the right team can act faster.</p><button className="banner-button" onClick={() => setShowReport(true)}>Start a new report <span>→</span></button></div><div className="banner-art" aria-hidden="true"><div className="sun"></div><div className="building building-one"></div><div className="building building-two"></div><div className="plant">✦</div></div></section>
        <section className="section-heading"><div><p className="eyebrow">YOUR ACTIVITY</p><h2>Issue overview</h2></div><button className="text-action" onClick={() => setShowAllReports(true)}>View all reports <span>→</span></button></section>
        <div className="stats-grid"><article className="stat-card"><span className="stat-icon coral">◌</span><p>Total reports</p><strong>{overviewReports.length}</strong><small>All submitted issues</small></article><article className="stat-card"><span className="stat-icon amber">◷</span><p>In progress</p><strong>{inProgressCount}</strong><small>Being looked into</small></article><article className="stat-card"><span className="stat-icon green">✓</span><p>Resolved</p><strong>{resolvedCount}</strong><small><em>{resolutionRate}%</em> resolution rate</small></article><article className="stat-card response"><div className="ring"><span>{averageResponseDays === null ? '—' : averageResponseDays.toFixed(1)}</span><small>days</small></div><div><p>Average response</p><small>From reports with a response</small></div></article></div>
        <section className="reports-panel" id="reports">
          <div className="panel-heading">
            <div><p className="eyebrow">RECENT ACTIVITY</p><h2>{showAllReports ? 'Overall reports' : 'Recent reports'}</h2></div>
            <button className="filter-button" onClick={() => setShowAllReports((current) => !current)}>
              {showAllReports ? 'Recent reports' : 'All reports'} <span>⌄</span>
            </button>
          </div>
          <div className="report-list">
            {submittedReports.map((report) => (
              <div className="report-row" key={report.id}>
                <StatusIcon status={report.status} />
                <div className="report-detail"><strong>{report.title}</strong><span>{report.location}</span></div>
                <span className={`status ${report.status === 'Resolved' ? 'resolved' : report.status === 'Pending' ? 'pending' : 'in-progress'}`}>{report.status}</span>
                <time>{report.date}</time><span className="row-arrow">›</span>
              </div>
            ))}
            <button className="report-row report-row-button" onClick={() => setShowHistory(true)}>
              <span className="issue-dot furniture">▰</span>
              <div className="report-detail"><strong>Broken chair in lecture hall</strong><span>Block A · 2nd Floor · Room 204</span></div>
              <span className="status in-progress">In progress</span><time>Sep 16</time><span className="row-arrow">›</span>
            </button>
            <div className="report-row">
              <span className="issue-dot electrical">ϟ</span>
              <div className="report-detail"><strong>Flickering lights near staircase</strong><span>Block B · Ground Floor · East Wing</span></div>
              <span className="status pending">Pending</span><time>Sep 14</time><span className="row-arrow">›</span>
            </div>
            <div className="report-row">
              <StatusIcon status="Resolved" />
              <div className="report-detail"><strong>Water leakage in washroom</strong><span>Block A · 1st Floor · North Wing</span></div>
              <span className="status resolved">Resolved</span><time>Sep 10</time><span className="row-arrow">›</span>
            </div>
            {showAllReports && (
              <div className="report-row">
                <span className="issue-dot furniture">▰</span>
                <div className="report-detail"><strong>Damaged desk in seminar room</strong><span>Block C · 1st Floor · Room 112</span></div>
                <span className="status pending">Pending</span><time>Sep 04</time><span className="row-arrow">›</span>
              </div>
            )}
          </div>
        </section>
        <PublicFeedbackPanel />
      </main>
    </div>
    {showReport && <ReportForm onClose={() => setShowReport(false)} onSubmit={onReportSubmit} />}
    {showHistory && <StatusHistory onClose={() => setShowHistory(false)} />}
    {showHelp && <HelpCenter role={role} onClose={() => setShowHelp(false)} />}
    </>
  )
}

export default App
