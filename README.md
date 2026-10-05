# Todo List

A simple single-user todo app with email + password sign-in (server-side session, no tokens).

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, react-icons |
| Backend  | Java 21, Spring Boot 4, Spring Security, Spring Data JPA, Bean Validation, Liquibase |
| Database | PostgreSQL 17 + Redis 8 for sessions (via Docker Compose) |

## Features

- Sign in with email + password (one fixed account), sign out from the header menu
- Settings page: reset your password with a 6-digit code emailed through Brevo SMTP
- "Forgot password?" on the sign-in page, using the same emailed code
- Add / edit tasks in a dialog: title, notes, priority (Low / Medium / High), due date
- Styled date picker with Today / Tomorrow / Next week shortcuts
- Mark as done (optimistic update); delete and clear completed with a 5-second **Undo**
- Filter (All / Open / Done, priority, due date), search by name, sort
- Due-date hints (Today, Tomorrow, overdue), light / dark theme, responsive layout
- Custom 404 page

## Project structure

```
todo/
├── docker-compose.yml      # PostgreSQL + Redis
├── backend/                # Spring Boot REST API (port 8080)
│   └── src/main/java/com/example/todo/
│       ├── auth/           # Login / current-user endpoints, session sign-out
│       ├── account/        # Login account, Settings + forgot-password endpoints
│       ├── otp/            # One-time codes: issue, verify, limits
│       ├── mail/           # Sends the code email over SMTP (Brevo)
│       ├── todo/           # Entity, repository, service, controller, DTOs
│       ├── config/         # Security (session) + CORS configuration
│       └── common/         # Global exception handler (ProblemDetail), GET /health
│   ├── src/main/resources/db/changelog/   # Liquibase migrations
│   ├── Dockerfile          # Optional image build: docker build -t todo-backend backend
│   └── .env.example        # Copy to .env for your email + Brevo SMTP key
└── frontend/               # Next.js app (port 3000)
    └── src/
        ├── proxy.ts        # Redirects to /login when there is no valid session
        ├── app/            # tasks page, /login, /forgot-password, /settings, 404
        ├── components/auth # Login, forgot password, code entry, account menu
        ├── components/settings # Settings page
        ├── components/todo # Todo UI components
        ├── components/ui   # shadcn/ui components
        └── lib/            # API client, types, helpers
    └── .env.example        # Copy to .env.local to point the frontend at the backend
```

## Getting started

Prerequisites: Java 21, Node.js 20+, Docker.

### 1. Start PostgreSQL and Redis

```bash
docker compose up -d
```

The database is exposed on **localhost:5433** (db `todo_db`, user `todo`, password `todo`).
Port 5433 is used to avoid clashing with an existing local Postgres on 5432.
Redis (login sessions) is on **localhost:6381**, password `todo`; see "Sessions in Redis" below.

### 2. Run the backend

```bash
cd backend
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
```

API runs at http://localhost:8080. Override settings with env vars:
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `PORT`, `CORS_ORIGINS`.

#### Local settings: `backend/.env`

Your email and the Brevo SMTP key go in `backend/.env`, which git ignores. Start from
the example:

```bash
cd backend
cp .env.example .env          # then edit .env
```

The backend loads it automatically; real environment variables override it.

#### Login account

There is one account:

| Setting             | Default           | Notes |
| ------------------- | ----------------- | ----- |
| `APP_AUTH_EMAIL`    | `me@example.com`  | Must be a real inbox: password reset codes are sent here. Changing it and restarting updates the account's email. |
| `APP_AUTH_PASSWORD` | `changeme123`     | Only used the **first** time the account is created. After that the password lives (bcrypt-hashed) in the database and is changed from **Settings**. |

The backend logs a warning while the default password is still in use.

#### Email (Brevo SMTP)

Password reset codes are emailed through [Brevo](https://www.brevo.com)'s SMTP relay:

1. In Brevo, open **SMTP & API → SMTP**. Copy the **Login** (looks like
   `8a1b2c001@smtp-brevo.com`) into `MAIL_USERNAME`, and generate an **SMTP key**
   (starts with `xsmtpsib-`) for `MAIL_PASSWORD`. This is not your Brevo account password.
2. Under **Senders, domains & dedicated IPs**, verify the address you'll send from and
   put it in `MAIL_FROM`.
3. Restart the backend.

| Setting          | Default                | |
| ---------------- | ---------------------- | - |
| `MAIL_HOST`      | `smtp-relay.brevo.com` | |
| `MAIL_PORT`      | `587`                  | STARTTLS |
| `MAIL_USERNAME`  | –                      | Brevo SMTP login |
| `MAIL_PASSWORD`  | –                      | Brevo SMTP key |
| `MAIL_FROM`      | –                      | Verified sender address |
| `MAIL_FROM_NAME` | `Tasks`                | Name shown in the inbox |

Until mail is configured, "Reset password" shows an "Email isn't set up" message and
nothing is changed.

How the codes work: 6 digits, valid for 10 minutes, at most 5 wrong tries, a new
code at most once a minute (5 per hour), and requesting a new code cancels the old
one. Only a SHA-256 hash of each code is stored. Changing the password from Settings
signs out your other devices; a forgot-password reset signs out every device.

How sign-in works (no tokens):

- `POST /api/auth/login` checks the password and stores the login in a server-side
  session **in Redis** (Spring Session). The browser only receives the `TODO_SESSION`
  cookie (a random session id), which is
  `HttpOnly` (JavaScript can't read it) and `SameSite=Lax` (other sites can't send it
  with their requests, which is what protects against CSRF).
- The session id is regenerated on login. Sessions end after **30 minutes without
  activity** (`SESSION_IDLE_TIMEOUT`) and, however active, **8 hours after sign-in**
  (`SESSION_MAX_LIFETIME`), which caps how long a leaked cookie could be used. The sign-in
  page then explains that you were signed out.
- The cookie has no expiry date, so closing the browser also ends it. Because sessions
  live in Redis, restarting the backend does **not** sign you out.
- Set `SESSION_COOKIE_SECURE=true` when serving over HTTPS.

#### Sessions in Redis

Redis runs in Docker (`todo-redis`) on **localhost:6381**, password-protected
(`REDIS_PASSWORD`, default `todo`) and reachable only from this machine. Session keys
use the prefix `todo:session:`:

| Key | Holds |
| --- | ----- |
| `todo:session:sessions:<id>` | The session: sign-in time, security context, last access. Redis deletes it automatically after the idle timeout (plus a 5-minute cleanup margin). |
| `todo:session:index:…PRINCIPAL_NAME_INDEX_NAME:<email>` | Which sessions belong to which user, so a password change can delete the user's other sessions. |
| `todo:session:sessions:expires:<id>`, `todo:session:expirations:*` | Expiry bookkeeping. |

To look inside:

```bash
docker exec todo-redis redis-cli -a todo --no-auth-warning --scan --pattern 'todo:session:*'
```

Signing out, a password change and the 8-hour limit delete sessions from Redis; the
old cookie stops working immediately.

| Setting          | Default     |
| ---------------- | ----------- |
| `REDIS_HOST`     | `localhost` |
| `REDIS_PORT`     | `6381`      |
| `REDIS_PASSWORD` | `todo`      |

#### Database migrations (Liquibase)

The schema is managed by Liquibase and applied automatically on startup.
Hibernate runs with `ddl-auto=validate`, so it never changes the schema itself.

```
backend/src/main/resources/db/changelog/
├── db.changelog-master.yaml        # includes every migration, in order
└── changes/
    └── 001-create-todos-table.yaml
```

To change the schema:

1. Add a new file, e.g. `changes/002-add-tags.yaml`, with one or more `changeSet`s.
2. Include it at the end of `db.changelog-master.yaml`.
3. Update the JPA entity to match, then restart the backend.

Never edit a changeset that has already run — Liquibase stores a checksum of each
one in the `databasechangelog` table and will refuse to start if it changes.

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev                   # or: npm run dev -- -p 3005 to use another port
```

Open http://localhost:3000. The Next.js server proxies `/api/*` to the backend
(see `next.config.ts`), so no CORS setup is needed.

#### Frontend settings: `frontend/.env.local`

`BACKEND_URL` points the server at the backend; it defaults to `http://localhost:8080`,
so you only need this file when the backend lives somewhere else (for example
`http://backend:8080` when the frontend is a container on the same network). Start from
the example:

```bash
cd frontend
cp .env.example .env.local      # then edit it
```

| Setting             | Default     | Used by |
| ------------------- | ----------- | ------- |
| `BACKEND_URL`       | `http://localhost:8080` | `next.config.ts` (the `/api/*` proxy) and `src/proxy.ts` (the session check) |
| `NEXT_PUBLIC_API_URL` | `/api`    | The browser, only when you want to skip the proxy and call the backend directly. Needs `CORS_ORIGINS` on the backend to allow the frontend's origin. |

## REST API

Everything except sign-in and the two forgot-password endpoints requires a signed-in
session and returns `401` otherwise.

| Method | Path                      | Description              |
| ------ | ------------------------- | ------------------------ |
| GET    | `/health`                 | Backend, database and Redis status; no session needed (`200` up, `503` down) |
| POST   | `/api/auth/login`         | Sign in: `{"email": "...", "password": "..."}` |
| POST   | `/api/auth/logout`        | Sign out (ends the session) |
| GET    | `/api/auth/me`            | Current user's email     |
| POST   | `/api/auth/password-reset/request` | Forgot password: `{"email"}`. Always `202`, whether or not the email matches |
| POST   | `/api/auth/password-reset/confirm` | `{"email", "code", "newPassword"}` → `204` |
| GET    | `/api/account`            | Account email and when the password last changed |
| POST   | `/api/account/password/code` | Email a reset code to the signed-in account |
| POST   | `/api/account/password`   | `{"code", "newPassword"}` → `204` |
| GET    | `/api/todos`              | List all todos           |
| GET    | `/api/todos/{id}`         | Get one todo             |
| POST   | `/api/todos`              | Create a todo            |
| PUT    | `/api/todos/{id}`         | Update a todo            |
| PATCH  | `/api/todos/{id}/toggle`  | Toggle completed         |
| DELETE | `/api/todos/{id}`         | Delete a todo            |
| DELETE | `/api/todos/completed`    | Delete all completed     |

Request body for create/update:

```json
{
  "title": "Buy groceries",
  "description": "Milk, eggs",
  "priority": "HIGH",
  "dueDate": "2026-10-05",
  "completed": false
}
```

Validation errors return `400` with a `ProblemDetail` body containing an `errors` map;
missing todos return `404`.

## Tests

```bash
cd backend
./mvnw test                   # Windows: mvnw.cmd test
```

Backend tests start their own throwaway PostgreSQL and Redis containers (Testcontainers), so they
need Docker running but never touch your real `todo_db` or `todo-redis`. Emails are captured instead of
sent, and a test clock checks code expiry and the resend wait without sleeping.
