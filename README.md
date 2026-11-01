# Smart Campus Issue Reporting System

A structured, location-based complaint tracking platform for campuses. Students report issues with photos and exact locations; admins manage and assign complaints; maintenance staff update progress until resolution.

## Project Status

The project is being built incrementally. The current repository contains a responsive React frontend and the first runnable backend foundation.

## What Has Been Built

### Section 1: Frontend Foundation

- React + TypeScript + Vite client in `client/`
- Smart Campus visual identity and responsive dashboard shell
- Student overview with complaint statistics and recent reports
- Desktop, tablet, and mobile layout behavior
- Readable typography and mobile touch targets

### Section 2: Authentication and Role Structure

- Role selection for Student, Admin, and Maintenance
- Sign-in form UI
- Role-specific dashboard identity and navigation
- Frontend sign-out flow
- Temporary frontend-only session behavior

### Section 3: Student Complaint Submission

- Report issue modal
- Photo upload preview and removal
- Category, building, floor, room/section, and description fields
- Required-field validation
- Pending complaint confirmation and complaint ID

### Section 4: Admin Dashboard

- Complaint management queue
- Status and building filters
- Complaint metrics
- Maintenance staff assignment controls
- Assignment confirmation feedback

### Section 5: Maintenance Dashboard

- Assigned work queue
- Priority and due-date information
- Status updates: Assigned, In progress, Resolved
- Resolution note dialog
- Completion feedback

### Section 6: Notifications and Status History

- Notification popover
- Unread notification states
- Complaint status timeline
- Submission, assignment, work-in-progress, and resolution stages

### Section 7: Interaction and Responsive Polish

- Functional report filters and expanded report list
- Interactive complaint rows and detail actions
- Responsive mobile navigation
- Responsive cards, forms, tables, modals, and touch controls
- Shared feedback messages for previously visual-only actions

### Section 8: Backend Foundation (Current)

- Express + TypeScript API in `server/`
- Environment configuration template
- CORS and JSON request handling
- `GET /api/health` service check
- `GET /api/meta` roles, statuses, and categories
- Reserved API routes for login and complaint creation
- Server-sent events for live, role-targeted notifications
- PostgreSQL and JWT configuration placeholders

### Real-time notifications

New student reports notify the Admin role immediately. Assigning a report notifies the Maintenance role and adds the task to its work queue. Updates appear as an in-app popup and are retained in the notification menu. The event stream is delivered by the backend; BroadcastChannel and browser storage events provide a same-browser fallback. Keep both the frontend and backend running for updates across different devices.

## Run the Frontend and Backend

Start the backend in one terminal:

```powershell
cd server
npm install
Copy-Item .env.example .env
npm run dev
```

In a second terminal, start the frontend:
```powershell
cd client
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173/`. The Vite development proxy forwards `/api` requests and the live notification event stream to the backend on port 4000.

Check it with:

```text
http://localhost:4000/api/health
```

## Next Section

The next backend section will add the PostgreSQL schema and real persistence for users, complaints, status logs, assignments, and notifications. After that, JWT authentication and frontend API integration will replace the temporary frontend demo state.
