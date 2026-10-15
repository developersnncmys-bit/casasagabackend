# CasaSaga Backend

Node.js + Express + MongoDB API for the CasaSaga website and admin panel.

## Setup

```bash
npm install
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, SEED_ADMIN_*, WEBSITE_URL, REVALIDATE_SECRET
npm run seed           # imports the website's content (data.js) and creates the admin account
npm run dev            # http://localhost:5000
```

`npm run seed` needs the website repo next to it (`WEBSITE_DIR`). It only fills empty collections and never touches bookings or enquiries. `npm run seed:force` replaces suites, add-ons, gallery, stories and settings.

## Structure

```
server.js                 starts the API once MongoDB is connected
src/app.js                Express app: helmet, CORS, JSON, logging, /uploads, /api
src/config/               env, db connection, constants
src/models/               Admin, Suite, Addon, GalleryImage, Story, Booking, Enquiry, Setting
src/controllers/          request handlers, one per resource
src/routes/               Express routers, one per resource
src/services/             booking pricing and double-booking check
src/middleware/           JWT auth, image upload, website refresh, error handler
src/helpers/              ApiError, catchAsync, shared CRUD, slugs, JSON shape
src/seed/seed.js          imports the website's data.js into MongoDB
uploads/                  uploaded images, served at /uploads/<file>
```

Responses are `{ success: true, data }` or `{ success: false, message, details? }`.

## API

Admin routes need `Authorization: Bearer <token>` from `POST /api/auth/login`.

| Route | |
| --- | --- |
| `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/password` | sign in, current admin, change password |
| `GET /api/dashboard` | pending requests, new enquiries, revenue and nights this month, arrivals |
| `/api/bookings` | list, create, get, update, delete. The server works out the total; confirmed stays can't overlap |
| `/api/enquiries` | contact-form messages |
| `/api/suites` | `id` is the URL slug (`tulum`). A suite with upcoming bookings can't be deleted |
| `/api/addons` | `price: null` means "Price on request" |
| `/api/gallery`, `/api/stories` | gallery photos, guest reviews |
| `GET/PUT /api/settings` | contact, policies, occasions, values, gallery categories |
| `POST /api/uploads` | multipart `file` → `{ url, urls }` |

Public routes used by the website (no sign-in, rate-limited):

| Route | |
| --- | --- |
| `GET /api/public/content` | everything the site shows, hidden items left out |
| `POST /api/public/bookings` | booking form → pending request |
| `POST /api/public/enquiries` | contact form → new enquiry |

After any change to suites, add-ons, gallery, stories or settings, the API calls `WEBSITE_URL/api/revalidate` with `REVALIDATE_SECRET`, so the website updates straight away.

## Deploying

- Set `NODE_ENV=production`, a long random `JWT_SECRET`, the real `CORS_ORIGIN` (website and admin panel domains), `PUBLIC_URL`, `WEBSITE_URL` and `REVALIDATE_SECRET`.
- On MongoDB Atlas, add the server's IP under Network Access.
- `uploads/` is stored on local disk, so the host needs persistent storage. Serverless hosts like Vercel don't keep files.
