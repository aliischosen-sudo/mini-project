# Smart Campus — Frontend Plan (for GitHub Copilot)

**Project:** Smart Campus: College Maintenance & Issue Reporting System
**Goal:** Students report infrastructure issues with a photo + exact location. Admins assign them to workers. Workers fix and mark them resolved. Everyone sees live status.

---

## 0. How to use this file with Copilot

1. Create the project folder and put this file in the root as `FRONTEND_PLAN.md`.
2. Copy **Section 1 (Project Context)** into `.github/copilot-instructions.md` so Copilot always knows the project rules.
3. Work **one phase at a time**. For each phase: open Copilot Chat (Agent mode), paste that phase's **Copilot Prompt**, review the code, run it, tick the checklist, then commit.
4. Never ask Copilot to build the whole app at once. Small phases = fewer bugs.
5. Commit after every phase: `git commit -m "phase 3: auth pages"`.

---

## 1. Project Context (paste into `.github/copilot-instructions.md`)

```
Project: Smart Campus – College Maintenance & Issue Reporting System (frontend).

Stack: React (Vite), React Router v6, Tailwind CSS, Axios, React Hook Form, Context API for state.
Language: JavaScript (JSX). Functional components and hooks only.

Roles: student, admin, worker.
Complaint status values (exact strings): "Pending", "In Progress", "Resolved".
Categories: Washroom, Furniture, AC, Electrical, Plumbing, Cleaning, Other.
Location is hierarchical: Block -> Floor -> Room -> Section.

Rules:
- Keep components small and reusable; one component per file.
- All API calls go through src/services/*.js, never inside components.
- Use a mock API layer first (src/services/mockApi.js with localStorage) so the frontend works without the backend. Switch with VITE_USE_MOCK=true.
- Mobile-first, responsive layouts. Students will mostly use phones.
- Every list/page needs loading, empty and error states.
- Use clear folder structure from FRONTEND_PLAN.md.
- Add comments only where logic is non-obvious.
```

---

## 2. Tech decisions (taken from your PDF, narrowed to one choice each)

| Area | Choice | Why |
|---|---|---|
| Framework | React + Vite | Fast setup, matches your PDF |
| Routing | React Router v6 | Role-based routes |
| Styling | Tailwind CSS | Copilot generates it very well, quick responsive UI |
| HTTP | Axios | Interceptors for auth token |
| Forms | React Hook Form | Simple validation |
| State | Context API (Auth, Toast) | Enough for a mini project |
| Icons | lucide-react | Light and clean |
| Charts (optional) | recharts | Admin stats |
| Image upload | Native `<input type="file" accept="image/*" capture="environment">` | Opens camera on phones |

---

## 3. Folder structure

```
smart-campus-frontend/
├─ .github/copilot-instructions.md
├─ public/
├─ src/
│  ├─ assets/
│  ├─ components/
│  │  ├─ common/        Button, Input, Select, Modal, Spinner, Toast, EmptyState, StatusBadge, Navbar, Sidebar
│  │  ├─ complaint/     ComplaintCard, ComplaintList, ComplaintFilters, ComplaintTimeline, PhotoUploader
│  │  ├─ location/      LocationPicker
│  │  └─ admin/         StatsCards, AssignWorkerModal
│  ├─ context/          AuthContext.jsx, ToastContext.jsx
│  ├─ data/             locations.js, categories.js
│  ├─ hooks/            useAuth.js, useComplaints.js, useDebounce.js
│  ├─ layouts/          PublicLayout, StudentLayout, AdminLayout, WorkerLayout
│  ├─ pages/
│  │  ├─ auth/          Login, Register
│  │  ├─ student/       Dashboard, ReportIssue, MyComplaints, ComplaintDetail
│  │  ├─ admin/         Dashboard, AllComplaints, ComplaintDetail, Workers
│  │  ├─ worker/        MyTasks, TaskDetail
│  │  └─ NotFound.jsx, Landing.jsx
│  ├─ routes/           AppRoutes.jsx, ProtectedRoute.jsx
│  ├─ services/         api.js, authService.js, complaintService.js, workerService.js, mockApi.js
│  ├─ utils/            constants.js, formatDate.js, imageCompress.js
│  ├─ App.jsx
│  └─ main.jsx
├─ .env                 VITE_API_URL, VITE_USE_MOCK
└─ package.json
```

---

## 4. Data shapes (frontend contract with the backend)

**User**
```json
{ "id": "u1", "name": "Ali", "email": "ali@college.edu", "role": "student", "rollNo": "optional" }
```

**Complaint**
```json
{
  "id": "c101",
  "title": "Tap leaking",
  "description": "Water leaking continuously",
  "category": "Washroom",
  "location": { "block": "A", "floor": "2", "room": "Washroom-2", "section": "Left wing" },
  "photoUrl": "https://...",
  "status": "Pending",
  "priority": "Medium",
  "reportedBy": { "id": "u1", "name": "Ali" },
  "assignedTo": null,
  "createdAt": "2026-10-29T10:00:00Z",
  "updatedAt": "2026-10-29T10:00:00Z",
  "history": [ { "status": "Pending", "at": "...", "by": "Ali", "note": "Reported" } ]
}
```

**Worker**: `{ id, name, phone, speciality, activeTasks }`

---

## 5. Routes and who can see them

| Path | Page | Role |
|---|---|---|
| `/` | Landing | public |
| `/login`, `/register` | Auth | public |
| `/student` | Dashboard | student |
| `/student/report` | Report Issue | student |
| `/student/complaints` | My Complaints | student |
| `/student/complaints/:id` | Complaint Detail | student |
| `/admin` | Dashboard | admin |
| `/admin/complaints` | All Complaints | admin |
| `/admin/complaints/:id` | Complaint Detail + Assign | admin |
| `/admin/workers` | Workers list | admin |
| `/worker` | My Tasks | worker |
| `/worker/tasks/:id` | Task Detail + Update status | worker |
| `*` | NotFound | public |

---

## 6. Phases (small sections)

Each phase = about 1 to 3 hours. Do them in order.

---

### Phase 1 — Project setup

**Goal:** Empty app that runs with Tailwind and the folder structure.

**Tasks**
- Create Vite React app, install dependencies.
- Setup Tailwind.
- Create folders from Section 3.
- Add `.env` with `VITE_USE_MOCK=true` and `VITE_API_URL=http://localhost:5000/api`.
- Add `.github/copilot-instructions.md` from Section 1.

**Copilot Prompt**
```
Set up a new React project using Vite in this folder (JavaScript). Install react-router-dom, axios,
react-hook-form, lucide-react, and Tailwind CSS (latest Vite-compatible setup). Create the folder structure
described in FRONTEND_PLAN.md section 3 with empty placeholder files where needed. Add a .env file with
VITE_USE_MOCK=true and VITE_API_URL=http://localhost:5000/api. Make App.jsx render a simple "Smart Campus"
heading styled with Tailwind to confirm setup works.
```

**Done when:** `npm run dev` shows the heading with Tailwind styling.

---

### Phase 2 — Design system and common components

**Goal:** Reusable UI pieces so all pages look consistent.

**Tasks**
- Pick a palette (suggestion: brown/beige to match your presentation, or any 1 primary + neutrals).
- Build: `Button`, `Input`, `Select`, `Textarea`, `Modal`, `Spinner`, `EmptyState`, `Toast`, `StatusBadge`.
- `StatusBadge` colours: Pending = amber, In Progress = blue, Resolved = green.

**Copilot Prompt**
```
Create reusable Tailwind-styled components in src/components/common: Button (variants: primary, secondary,
danger, ghost; loading prop), Input, Select, Textarea (all with label and error message props, compatible with
react-hook-form via forwardRef), Modal, Spinner, EmptyState (icon, title, message, optional action button),
and StatusBadge (props: status; "Pending" amber, "In Progress" blue, "Resolved" green). Also create a
ToastContext with a useToast hook (success, error, info) and a Toast container component. Keep components
mobile-friendly and accessible.
```

**Done when:** A temporary demo page shows every component working.

---

### Phase 3 — Mock API and services layer

**Goal:** Frontend works fully without the real backend.

**Tasks**
- `mockApi.js` using localStorage with seed data (3 users, one per role, 5 workers, 10 complaints).
- `authService`, `complaintService`, `workerService` that call mock or real API depending on `VITE_USE_MOCK`.
- `api.js`: Axios instance with auth token interceptor and 401 handling.

**Functions to expose**
- Auth: `login`, `register`, `logout`, `getCurrentUser`
- Complaints: `createComplaint`, `getMyComplaints`, `getAllComplaints(filters)`, `getComplaintById`, `assignComplaint(id, workerId)`, `updateStatus(id, status, note)`, `getStats`
- Workers: `getWorkers`, `getMyTasks`

**Copilot Prompt**
```
Build the services layer in src/services. Create mockApi.js that stores users, workers and complaints in
localStorage, seeded with sample data matching the data shapes in FRONTEND_PLAN.md section 4 (3 demo users:
student, admin, worker; 5 workers; 10 complaints with mixed statuses/categories/locations). Create
authService.js, complaintService.js and workerService.js exposing the functions listed in the plan. Each
function should call mockApi when import.meta.env.VITE_USE_MOCK === "true", otherwise call the real REST API
through api.js (Axios instance with baseURL from VITE_API_URL, Authorization Bearer token from localStorage, and
a response interceptor that logs out on 401). Add a small artificial delay (300ms) in mock functions to simulate
network. updateStatus must append an entry to the complaint's history array.
```

**Done when:** You can call the service functions from the browser console / a test page and get data.

---

### Phase 4 — Auth context, protected routes and layouts

**Goal:** Login, role-based access, correct layout per role.

**Tasks**
- `AuthContext` with `user`, `login`, `logout`, `loading`.
- `ProtectedRoute` with `allowedRoles`.
- Layouts: `PublicLayout`, `StudentLayout`, `AdminLayout`, `WorkerLayout` (navbar + sidebar on desktop, bottom nav on mobile for student/worker).
- `AppRoutes.jsx` per the table in Section 5.

**Copilot Prompt**
```
Create AuthContext (user, loading, login, register, logout; persist token and user in localStorage and restore
on refresh) and a useAuth hook. Create ProtectedRoute in src/routes that takes allowedRoles and redirects
unauthenticated users to /login and wrong-role users to their own home (/student, /admin or /worker). Create
layouts: PublicLayout, StudentLayout (top bar + bottom navigation on mobile), AdminLayout (sidebar), and
WorkerLayout. Set up AppRoutes.jsx with all routes from FRONTEND_PLAN.md section 5 using placeholder pages for
now, and wire everything in App.jsx with BrowserRouter and the providers.
```

**Done when:** Logging in as each demo role lands on the right layout; visiting another role's URL redirects.

---

### Phase 5 — Login, Register, Landing pages

**Tasks**
- Login form (email, password) with validation and error toast.
- Register form (name, email, password, confirm password, role fixed to student; roll number optional).
- Landing page: short hero, 3 steps (Click → Tag → Track), Login/Register buttons.
- Add "Use demo account" buttons on Login for quick testing.

**Copilot Prompt**
```
Build the pages Landing, Login and Register in src/pages using react-hook-form and the common components.
Validate email format, password min 6 chars, confirm password match. On success call AuthContext and
redirect based on role. Add three "Demo login" buttons on the Login page (Student, Admin, Worker) that fill
the demo credentials from mockApi seed data. Landing page: hero section, a 3-step "How it works" section
(Click a photo, Tag the location, Track the status), and CTA buttons. Make everything mobile-first.
```

---

### Phase 6 — Location data and LocationPicker

**Goal:** The key feature: exact Block → Floor → Room → Section tagging.

**Tasks**
- `data/locations.js` with sample college structure (blocks A, B, C… each with floors, rooms, sections). Easy to edit later.
- `LocationPicker` with four dependent dropdowns; each resets when the parent changes; returns `{block, floor, room, section}`.
- Show a one-line preview: "Block A › Floor 2 › Room 204 › Left wing".

**Copilot Prompt**
```
Create src/data/locations.js exporting a nested structure: blocks (A, B, C, Library, Canteen), each with
floors (Ground, 1, 2, 3), each floor with rooms (e.g. Room 101, Washroom, Lab 1) and each room with sections
(e.g. Front, Middle, Back, Left wing, Right wing). Then create components/location/LocationPicker.jsx: four
dependent selects (Block, Floor, Room, Section) where each next select is disabled until the previous is
chosen and resets when a parent changes. It should accept value and onChange props (object with block, floor,
room, section), show validation errors if used inside react-hook-form via Controller, and display a breadcrumb
preview of the selected location.
```

---

### Phase 7 — PhotoUploader

**Tasks**
- Button "Take / choose photo" using `<input type="file" accept="image/*" capture="environment">`.
- Preview, remove, replace.
- Validate type and size (max 5 MB).
- Compress/resize on the client with canvas to max width about 1280px before upload.
- Return a `File` plus a preview URL.

**Copilot Prompt**
```
Create components/location/../complaint/PhotoUploader.jsx and utils/imageCompress.js. The uploader shows a large
dashed drop/tap area with a camera icon, opens the rear camera on phones via capture="environment" (and
file picker on desktop), validates image type and max 5MB, shows a preview with Remove and Retake buttons, and
compresses the image with a canvas to max width 1280px at 0.8 JPEG quality before passing the File to the
parent via onChange. Handle errors with the toast hook. In mock mode the photo should be converted to a base64
data URL so it can be stored in localStorage.
```

(Use path `src/components/complaint/PhotoUploader.jsx`.)

---

### Phase 8 — Student: Report Issue page

**Flow:** Photo → Category → Location → Title/Description → Submit.

**Tasks**
- Single page with sections or a 3-step wizard (Photo, Details, Location) with a progress bar.
- Category selection as icon cards (Washroom, Furniture, AC, Electrical, Plumbing, Cleaning, Other).
- Priority select (Low/Medium/High), optional.
- Review summary before submit.
- On success: toast + redirect to the new complaint detail.

**Copilot Prompt**
```
Build pages/student/ReportIssue.jsx as a 3-step form wizard with a progress indicator: Step 1 Photo
(PhotoUploader, required), Step 2 Details (category as selectable icon cards using lucide-react icons, title,
description, priority), Step 3 Location (LocationPicker, all four fields required) followed by a review summary.
Use react-hook-form. Back/Next buttons, validation per step, submit calls complaintService.createComplaint,
shows a loading state on the button, then a success toast and navigation to /student/complaints/:id.
Data must match the Complaint shape in FRONTEND_PLAN.md.
```

---

### Phase 9 — Student: Dashboard, My Complaints, Complaint Detail

**Tasks**
- Dashboard: greeting, 3 count cards (Pending / In Progress / Resolved), big "Report an issue" button, 3 recent complaints.
- My Complaints: list of `ComplaintCard` with filter tabs by status and search by title.
- Complaint Detail: photo, info, location breadcrumb, status badge, assigned worker (if any), `ComplaintTimeline` from `history`.

**Copilot Prompt**
```
Create ComplaintCard (thumbnail photo, title, category, location breadcrumb, StatusBadge, relative time),
ComplaintFilters (status tabs + search input with debounce), and ComplaintTimeline (vertical timeline from the
history array) in components/complaint. Then build student pages: Dashboard (greeting, three count cards for
Pending/In Progress/Resolved, a prominent Report Issue button, last 3 complaints), MyComplaints (filters + list
with loading, empty and error states), and ComplaintDetail (large photo, details, status badge, assigned
worker, timeline). Use complaintService and the logged-in user.
```

---

### Phase 10 — Admin: Dashboard and All Complaints

**Tasks**
- Dashboard: stats cards (Total, Pending, In Progress, Resolved), simple chart by category and by status (recharts or simple bars), latest complaints table.
- All Complaints: table on desktop, cards on mobile; filters for status, category, block, date; search; sorting; pagination (10 per page).

**Copilot Prompt**
```
Build admin pages. AdminDashboard: StatsCards (Total, Pending, In Progress, Resolved), a bar chart of
complaints by category and a donut/pie of status split using recharts, and a "Latest complaints" list.
AllComplaints: a responsive table (cards on mobile) with filters for status, category, block and a text search,
sort by date/priority, and client-side pagination of 10 per page. Each row links to
/admin/complaints/:id. Include loading, empty and error states and use complaintService.getAllComplaints with
a filters object.
```

---

### Phase 11 — Admin: Complaint Detail, Assign Worker, Workers page

**Tasks**
- Detail page like student's, plus an **Assign worker** button opening `AssignWorkerModal` (list workers with speciality and active task count).
- After assigning, status becomes "In Progress" and the history gets an entry.
- Admin can also change status manually and add a note.
- Workers page: list of workers with name, phone, speciality, active tasks.

**Copilot Prompt**
```
Build admin/ComplaintDetail.jsx reusing the student detail layout, with an "Assign worker" button that opens
AssignWorkerModal (searchable list of workers showing speciality and active tasks, select one and confirm).
Confirming calls complaintService.assignComplaint, which sets assignedTo and status "In Progress" and adds a
history entry; refresh the page data and show a toast. Add a status dropdown with an optional note field for
manual status changes. Also build admin/Workers.jsx listing workers in cards with name, phone, speciality and
active task count.
```

---

### Phase 12 — Worker: My Tasks and Task Detail

**Tasks**
- My Tasks: assigned complaints, tabs Active / Completed, sorted by priority.
- Task Detail: photo (tap to zoom), full location breadcrumb (big and clear), description, buttons: **Start work** (stays In Progress with note) and **Mark as Resolved** (with note and optional "after" photo).

**Copilot Prompt**
```
Build worker pages. MyTasks lists complaints assigned to the logged-in worker with tabs Active and Completed,
sorted by priority then date. TaskDetail shows the photo (click to open a full-screen zoom modal), a large
clear location breadcrumb, description, category and history timeline. Add a "Mark as Resolved" button that
opens a modal asking for a note and an optional after-fix photo (reuse PhotoUploader), then calls
complaintService.updateStatus(id, "Resolved", note) and shows a success toast.
```

---

### Phase 13 — Polish: responsiveness, states, accessibility

**Checklist**
- Test at 360px, 768px, 1280px widths.
- Every async page has loading, empty and error states.
- Buttons disabled while submitting (no double submits).
- Keyboard focus visible, labels on all inputs, alt text on images.
- Confirm dialogs for destructive actions.
- Page titles per route.
- Dark mode (optional).

**Copilot Prompt**
```
Review the whole src folder for UI consistency and responsiveness. Fix: missing loading/empty/error states,
buttons that can be double-clicked during submit, inputs without labels, images without alt text, tables that
overflow on small screens, and inconsistent spacing/colours. Add document.title updates per route. Do not
change business logic. List every change you made.
```

---

### Phase 14 — Connect to the real backend

**Tasks**
- Set `VITE_USE_MOCK=false` and `VITE_API_URL` to the backend.
- Check each endpoint matches the services; adjust only inside `services/`.
- Photo upload: send `FormData` (multipart) to `POST /complaints`; backend uploads to Cloudinary or local storage and returns `photoUrl`.
- Handle CORS and token expiry.

**Expected endpoints (share this with whoever builds the backend)**

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Register student |
| POST | `/auth/login` | Login, returns `{token, user}` |
| GET | `/auth/me` | Current user |
| POST | `/complaints` | Create (multipart with photo) |
| GET | `/complaints/mine` | Student's complaints |
| GET | `/complaints?status=&category=&block=&q=&page=` | Admin list |
| GET | `/complaints/:id` | Detail |
| PATCH | `/complaints/:id/assign` | Body `{workerId}` |
| PATCH | `/complaints/:id/status` | Body `{status, note}` |
| GET | `/complaints/stats` | Counts for dashboard |
| GET | `/workers` | Workers list |
| GET | `/workers/me/tasks` | Worker's tasks |

**Copilot Prompt**
```
Switch the app to the real API. Review src/services and make sure each function matches the endpoints in
FRONTEND_PLAN.md section 6 phase 14. createComplaint must send multipart FormData (photo file + fields, with
location as JSON string). Normalise backend responses to the Complaint shape used by the UI inside the service
layer only. Show friendly error toasts for 400, 401, 403, 404 and 500 responses. Do not modify page components
unless a prop name changes.
```

---

### Phase 15 — Deploy and demo prep

- Build: `npm run build`, test with `npm run preview`.
- Deploy to Vercel or Netlify (set env vars; add SPA redirect to `index.html`).
- Prepare 3 demo accounts and 10 realistic complaints.
- Rehearse the demo flow: Student reports → Admin assigns → Worker resolves → Student sees "Resolved".

---

## 7. Suggested split for 3 team members

| Member | Phases |
|---|---|
| Person 1 | 1, 2, 3, 4, 13 (setup, common UI, services, routing, polish) |
| Person 2 | 5, 6, 7, 8, 9 (auth pages, location, photo, all student screens) |
| Person 3 | 10, 11, 12, 14 (admin and worker screens, backend connection) |

Merge after Phase 4 so everyone works on the same base. Use one Git branch per phase.

---

## 8. Final checklist

- [ ] Student can register, log in, report with photo and full location
- [ ] Student sees status updates and the history timeline
- [ ] Admin sees all complaints, filters them, assigns a worker
- [ ] Worker sees only their tasks and can mark Resolved
- [ ] Works well on phone screen sizes
- [ ] Loading, empty and error states everywhere
- [ ] Mock mode and real API mode both work through `VITE_USE_MOCK`
- [ ] README with setup steps and demo credentials

---

## 9. Stretch features (only if time remains — your PDF says you cut these)

- Notifications when status changes
- Upvote / "me too" on existing complaints to avoid duplicates
- Export complaints to CSV
- Dark mode
- Worker live GPS and AI image detection (leave for future work)