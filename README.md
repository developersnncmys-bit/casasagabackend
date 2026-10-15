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
server.js                 local: starts the API once MongoDB is connected
api/index.js + vercel.json  Vercel: connects to MongoDB, then hands each request to Express
src/app.js                Express app: helmet, CORS, JSON, logging, /uploads, /api
src/config/               env, db connection, constants
src/models/               Admin, Suite, Addon, GalleryImage, Story, Booking, Enquiry, Setting
src/controllers/          request handlers, one per resource
src/routes/               Express routers, one per resource
src/services/             booking pricing and double-booking check
src/middleware/           JWT auth, image upload, website refresh, error handler
src/helpers/              ApiError, catchAsync, shared CRUD, slugs, JSON shape
src/seed/seed.js          imports the website's data.js into MongoDB
uploads/                  older local uploads (new images are stored in MongoDB)
```

Responses are `{ success: true, data }` or `{ success: false, message, details? }`.

**Availability:** pending, confirmed and checked-in bookings each hold a room. A suite is unavailable for a stay once, on any night of it, the held rooms reach the suite's `inventory`. Cancelling a request frees its room.

## API

Admin routes need `Authorization: Bearer <token>` from `POST /api/auth/login`.

| Route | |
| --- | --- |
| `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/password` | sign in, current admin, change password |
| `GET /api/dashboard` | pending requests, new enquiries, revenue and nights this month, arrivals |
| `/api/bookings` | list, create, get, update, delete. The server works out the bill (nights × rate + add-ons − discount + tax) and keeps the agreed prices on the booking |
| `GET /api/bookings/availability?checkIn&checkOut&exclude` | rooms free per suite for those dates |
| `POST /api/bookings/:id/confirm` `check-in` `check-out` `cancel` `reopen` | moves a stay along and records the time. `check-out` with `{ settle: true, paymentMode }` marks it fully paid |
| `POST /api/bookings/:id/invoice` | gives the booking a sequential invoice number (`CS-2026-0001`) once, and returns the booking and invoice settings; the admin panel builds the PDF |
| `/api/enquiries` | contact-form messages |
| `/api/suites` | `id` is the URL slug (`tulum`). `inventory` is the number of rooms of that type. A suite with upcoming bookings can't be deleted |
| `/api/addons` | `price: null` means "Price on request" |
| `/api/gallery`, `/api/stories` | gallery photos, guest reviews |
| `GET/PUT /api/settings` | contact, policies, occasions, values, gallery categories, invoice details (business name, GSTIN, default tax %, number prefix, note) |
| `POST /api/uploads` | multipart `file` (max 4 MB each) → `{ url, urls }`. Images are stored in MongoDB (GridFS) and served at `/uploads/<file>` |

Public routes used by the website (no sign-in, rate-limited):

| Route | |
| --- | --- |
| `GET /api/public/content` | everything the site shows, hidden items left out |
| `GET /api/public/availability?checkIn&checkOut` | which suites still have a free room (no guest details) |
| `POST /api/public/bookings` | booking form → pending request; `409` if the suite was taken in the meantime |
| `POST /api/public/enquiries` | contact form → new enquiry |

After any change to suites, add-ons, gallery, stories or settings, the API calls `WEBSITE_URL/api/revalidate` with `REVALIDATE_SECRET`, so the website updates straight away.

## Deploying (Vercel)

Live at https://casasagabackend.vercel.app. Pushing to `main` redeploys.

Set these under Project → Settings → Environment Variables, then redeploy:

- `NODE_ENV=production` hides error details from responses
- `MONGO_URI`, `JWT_SECRET` (long and random), `JWT_EXPIRES_IN`
- `CORS_ORIGIN`: the website and admin panel addresses, comma separated. Include `http://localhost:3000,http://localhost:3001` while developing locally
- `PUBLIC_URL=https://casasagabackend.vercel.app`
- `WEBSITE_URL`: the website's public address, for instant refresh. Vercel can't reach `localhost`, so a local website refreshes on its own every 60 seconds instead
- `REVALIDATE_SECRET`: the same value as in the website's env

On MongoDB Atlas → Network Access, allow `0.0.0.0/0`, because Vercel has no fixed IP. Uploaded images are stored in MongoDB, so nothing depends on Vercel's disk. Vercel limits a request to 4.5 MB, which is why images are capped at 4 MB.
