# Full-Stack LMS

Monorepo for a school management system with backend, internal software, public website, and mobile app.

## Structure

```text
backend/
frontend/
  software/
  website/
  mobile/
  shared/
LOCAL_CONTEXT.md
```

## Apps

- `backend`: Node.js + Express + MySQL API
- `frontend/software`: internal web app
- `frontend/website`: public website
- `frontend/mobile`: Expo mobile app

## Getting Started

Use the local example env files where available:

- `backend/.env.example`
- `frontend/software/.env.example`
- `frontend/mobile/.env.example`

Install dependencies per app as needed.

## Local Run Commands

Backend:

```bash
cd backend
npm install
npm run dev
```

Software:

```bash
cd frontend/software
npm install
npm run dev
```

Website:

```bash
cd frontend/website
npm install
npm run dev
```

Mobile:

```bash
cd frontend/mobile
npm install
npm run start
```

## Backend Pattern

Modules generally follow:

- `*.routes.js`
- `*.controller.js`
- `*.service.js`
- `*.repository.js`

Typical flow:

1. route applies auth and permission checks
2. controller parses request input
3. service applies business rules
4. repository performs SQL work

## Main Functional Areas

- attendance
- reports and marks
- fees and payments
- messaging
- notifications
- academic settings
- teacher, student, and parent workflows

## Database

Main folders:

- `backend/database/migrations`
- `backend/database/seeds`

Guidelines:

- prefer migrations over reseeding
- treat migrations as the authoritative schema history
- some local databases may lag behind newer migrations, so apply required migrations before testing newer features

## Development Notes

- `LOCAL_CONTEXT.md` is the local working memory file for recent implementation details and handoff notes
- avoid committing real `.env` files
- avoid destructive git operations in a dirty worktree
- prefer targeted checks over full-repo lint/test runs when the repo already has unrelated noise

## References

- `LOCAL_CONTEXT.md`
- `backend/apis.md`
- `backend/serverSetup.md`
