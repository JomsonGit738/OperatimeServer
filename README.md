# Operatime Server

Operatime Server is the Express and MongoDB API for the Operatime portfolio
movie-booking application. It owns authentication, user identity, bookings, and
all TMDB credentials so secrets never enter the Angular bundle.

This repository is the backend. The Angular client lives in the sibling
`OperatimeApp` repository.

> **Portfolio demo:** Bookings, PayPal Sandbox activity, tickets, and QR codes
> demonstrate application behavior. This server does not sell or validate real
> cinema admission.

## Responsibilities

- Proxy approved movie-catalog requests to TMDB.
- Keep the TMDB read token on the server.
- Cache movie responses and retry transient TMDB connection failures.
- Create users with bcrypt-hashed passwords.
- Verify Google ID tokens using Google's official authentication library.
- Issue short-lived JWT sessions in HttpOnly cookies.
- Return an optional guest session without failing public pages.
- Protect profile and booking operations.
- Derive booking ownership from the verified session rather than request data.
- Store users, tickets, occupied seats, and bookings in MongoDB.
- Remove customer emails from public seat-availability responses.

## Architecture

```text
Angular client
  -> /api movie routes -> TMDB
  -> /api auth routes  -> JWT HttpOnly cookie
  -> /api booking      -> MongoDB users and bookings

Browser JavaScript cannot read the session cookie or backend secrets.
```

## Technology

- Node.js 18+
- Express 4
- MongoDB and Mongoose
- JSON Web Tokens
- bcrypt
- Google Auth Library
- cookie-parser
- CORS

## Requirements

- Node.js 18 or newer
- npm
- MongoDB connection string
- TMDB API Read Access Token
- Google OAuth web client ID

## Environment setup: the important idea

Environment variables keep credentials and deployment-specific settings outside
the source code:

- `.env.example` is a safe template. It contains variable names and placeholder
  values, so it **is committed** to Git.
- `.env` contains the real local credentials for one computer. It **must never
  be committed, emailed, or copied into the frontend**.
- Render stores the production values in its Environment settings. Production
  does not need the local `.env` file.

The first line of `index.js` calls `require("dotenv").config()`. This reads
`OperatimeServer/.env` into `process.env` before the database, authentication,
and movie modules load. For that reason, `.env` must be in the repository root,
beside `index.js` and `package.json`:

```text
OperatimeServer/
├── .env                 # real local secrets; ignored by Git
├── .env.example         # safe setup template; committed
├── index.js
├── package.json
└── ...
```

Do not place `.env` inside `Controller`, `config`, or the Angular repository.
After changing an environment variable, stop and restart `npm start`; a running
Node process does not automatically reload `.env`.

## New-computer setup (Windows PowerShell)

1. Install Node.js 18 or newer and Git.

2. Clone both repositories so the frontend and backend are sibling folders:

   ```text
   C:\Projects\
   ├── OperatimeApp\
   └── OperatimeServer\
   ```

3. Install the backend dependencies:

   ```powershell
   cd C:\Projects\OperatimeServer
   npm install
   ```

4. Create your private `.env` from the committed template:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

5. Replace every placeholder in `.env` with the values described below. A
   complete local file has this shape:

   ```dotenv
   DATABASE=mongodb+srv://YOUR_DB_USER:YOUR_DB_PASSWORD@YOUR_CLUSTER/operatime?retryWrites=true&w=majority
   ACCESS_TOKEN_SECRET=REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS_LONG
   ACCESS_TOKEN_EXPIRES_IN=15m
   SESSION_COOKIE_NAME=operatime_session
   SESSION_COOKIE_MAX_AGE_MS=900000
   TMDB_READ_TOKEN=YOUR_TMDB_API_READ_ACCESS_TOKEN
   TMDB_API_BASE=https://api.themoviedb.org/3
   TMDB_CACHE_TTL_MS=300000
   GOOGLE_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com
   FRONTEND_ORIGINS=http://localhost:4200,https://operatimebooking.netlify.app
   BCRYPT_ROUNDS=10
   PORT=3000
   NODE_ENV=development
   ```

   Do not copy the example values literally. Do not add spaces around `=`.
   `FRONTEND_ORIGINS` is the one comma-separated value in this file.

6. Start the API:

   ```powershell
   npm start
   ```

   A successful startup prints:

   ```text
   MongoDB connection string is set.
   Server started at PORT: 3000
   MongoDB connection successful!
   ```

7. Open `http://localhost:3000/` in a browser. The API routes are under
   `http://localhost:3000/api`. Start the Angular app separately on
   `http://localhost:4200`.

## Where each value comes from

### `DATABASE`

This is the MongoDB connection string.

For MongoDB Atlas:

1. Create or open an Atlas project and cluster.
2. Under **Database Access**, create a database user. This is not necessarily
   the same as the email used to sign in to Atlas.
3. Under **Network Access**, allow the new computer's current IP address.
4. Choose **Connect > Drivers > Node.js** and copy the connection string.
5. Replace its username, password, and database name. Use `operatime` as the
   database name if creating a new demo database.

If the database password contains characters such as `@`, `:`, `/`, `?`, `#`,
or `%`, URL-encode the password before putting it in the URI. An unencoded
special character is a common cause of MongoDB authentication or URI errors.
Never paste the connection string into logs or a support message because it
contains database credentials.

### `ACCESS_TOKEN_SECRET`

This secret signs Operatime's session JWT. It is not a Google token or a TMDB
token. Generate a new random value on each independent environment:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the printed value into `.env`. It will be 64 characters. The server refuses
to start with a missing value or one shorter than 32 characters.

Production and local development may use different signing secrets. Changing
the secret logs out every existing user because previously issued sessions can
no longer be verified.

### `TMDB_READ_TOKEN`

Create or open a TMDB account, go to account settings, and open the API section.
Copy the **API Read Access Token** (the long bearer token), not the shorter API
key. This token belongs only in the backend `.env` or Render settings. The
Angular app calls the Operatime movie proxy and must never receive this token.

`TMDB_API_BASE` normally remains `https://api.themoviedb.org/3`.
`TMDB_CACHE_TTL_MS=300000` caches responses for five minutes.

### `GOOGLE_CLIENT_ID`

In Google Cloud Console:

1. Select the project used by Operatime.
2. Configure the OAuth consent screen.
3. Create an **OAuth 2.0 Client ID** with application type **Web application**.
4. Add `http://localhost:4200` as an authorized JavaScript origin for local
   development.
5. Add the exact Netlify production origin as another authorized JavaScript
   origin.
6. Copy the client ID ending in `.apps.googleusercontent.com`.

The backend `GOOGLE_CLIENT_ID` must exactly match the Google client ID configured
by the Angular Google sign-in provider. The backend uses it to verify that a
Google ID token was issued specifically for Operatime. A client secret is not
required for the current Google ID-token flow.

If Google login is not being tested, this value may be omitted; password login
still works. Google login will return a configuration error until it is added.

### `FRONTEND_ORIGINS`

This is the CORS allowlist. Enter browser origins only—scheme, hostname, and
optional port—with no path and preferably no trailing slash:

```dotenv
FRONTEND_ORIGINS=http://localhost:4200,https://operatimebooking.netlify.app
```

Correct: `https://operatimebooking.netlify.app`

Incorrect: `https://operatimebooking.netlify.app/login`

Separate multiple origins with commas. Do not use `*` because the server accepts
credentialed cookie requests.

### Session and runtime settings

| Variable | Required | Local recommendation | Purpose |
| --- | --- | --- | --- |
| `ACCESS_TOKEN_EXPIRES_IN` | No | `15m` | JWT session lifetime |
| `SESSION_COOKIE_NAME` | No | `operatime_session` | Name of the HttpOnly cookie |
| `SESSION_COOKIE_MAX_AGE_MS` | No | `900000` | Cookie lifetime in milliseconds |
| `BCRYPT_ROUNDS` | No | `10` | Password-hashing cost |
| `PORT` | No | `3000` | Local HTTP port; Render supplies its own port |
| `NODE_ENV` | Yes in production | `development` locally | Uses Secure cookies when set to `production` |

`ACCESS_TOKEN_EXPIRES_IN` and `SESSION_COOKIE_MAX_AGE_MS` should normally
describe the same session duration. `15m` equals `900000` milliseconds.

## Complete environment-variable reference

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE` | Yes | MongoDB connection string |
| `ACCESS_TOKEN_SECRET` | Yes | JWT signing secret; minimum 32 characters |
| `ACCESS_TOKEN_EXPIRES_IN` | No | JWT lifetime, default `15m` |
| `SESSION_COOKIE_NAME` | No | Cookie name, default `operatime_session` |
| `SESSION_COOKIE_MAX_AGE_MS` | No | Browser cookie lifetime, default `900000` |
| `TMDB_READ_TOKEN` | Yes for movie routes | Server-only TMDB API Read Access Token |
| `TMDB_API_BASE` | No | TMDB base URL |
| `TMDB_CACHE_TTL_MS` | No | Movie-cache lifetime, default five minutes |
| `GOOGLE_CLIENT_ID` | Yes for Google login | OAuth web client ID used to verify ID tokens |
| `FRONTEND_ORIGINS` | Yes in production | Comma-separated browser-origin allowlist |
| `BCRYPT_ROUNDS` | No | Password-hashing cost, default `10` |
| `PORT` | No | HTTP port, default `3000` |
| `NODE_ENV` | Yes in production | Enables Secure session cookies |

## Render production environment

Do not upload or commit `.env` for Render. In the Render dashboard, open the
Operatime server service and add the variables under **Environment**.

Set at least:

```dotenv
DATABASE=YOUR_PRODUCTION_MONGODB_URI
ACCESS_TOKEN_SECRET=YOUR_PRODUCTION_RANDOM_SECRET
ACCESS_TOKEN_EXPIRES_IN=15m
SESSION_COOKIE_NAME=operatime_session
SESSION_COOKIE_MAX_AGE_MS=900000
TMDB_READ_TOKEN=YOUR_TMDB_READ_TOKEN
GOOGLE_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com
FRONTEND_ORIGINS=https://operatimebooking.netlify.app
NODE_ENV=production
```

Render supplies `PORT`; do not hard-code Render to port `3000`. After saving
environment changes, redeploy or restart the service. The current production
server is `https://operatimeserver-2023.onrender.com`, while Netlify proxies
frontend `/api/*` requests to that server.

Keep `NODE_ENV=production` on Render so the session cookie receives the
`Secure` attribute. Keep `NODE_ENV=development` locally because local HTTP
cannot send a Secure cookie.

## Environment troubleshooting

### The server says a variable is missing

- Confirm the filename is exactly `.env`, not `.env.txt`.
- Confirm it is in `OperatimeServer`, beside `index.js`.
- Run `npm start` from `OperatimeServer`, not from its parent folder.
- Restart Node after editing `.env`.
- Check for misspellings; variable names are case-sensitive.

In PowerShell, this shows filenames without revealing secret contents:

```powershell
Get-ChildItem -Force .env*
```

### `EADDRINUSE: address already in use :::3000`

Another process is already listening on port 3000—often an earlier backend
instance. Find it:

```powershell
Get-NetTCPConnection -LocalPort 3000 |
  Select-Object LocalAddress, LocalPort, State, OwningProcess
```

Then inspect the process:

```powershell
Get-Process -Id THE_OWNING_PROCESS_ID
```

Stop the old server with `Ctrl+C` in its terminal. Alternatively set another
local `PORT`, but then also update the Angular development `apiBaseUrl` to use
that same port.

### MongoDB connection fails on a new network

- Add the computer's current public IP in MongoDB Atlas Network Access.
- Verify the Atlas database username and password.
- URL-encode special characters in the database password.
- Confirm the database user has permission for the intended database.

### Movie requests return `502`

- Confirm `TMDB_READ_TOKEN` is the API Read Access Token.
- Restart the server after changing it.
- Confirm the computer or hosting service can reach `api.themoviedb.org`.
- Read the backend terminal or Render logs; the browser's `502` is only the
  proxy's outward symptom.

### Login succeeds but the session does not persist

- Locally, use `NODE_ENV=development`.
- On Render, use `NODE_ENV=production`.
- Confirm Netlify is proxying `/api/*` to the Render backend.
- Confirm `FRONTEND_ORIGINS` contains the exact frontend origin.
- Do not switch the Angular production API base from `/api` to a cross-site URL;
  the same-origin proxy is intentional for the HttpOnly session cookie.

## Secret-handling rules

- `.env` and `.env.*` are ignored by Git; `.env.example` is the only exception.
- Before committing, run `git status` and confirm `.env` is not listed.
- Never put `DATABASE`, `ACCESS_TOKEN_SECRET`, or `TMDB_READ_TOKEN` in Angular
  environment files. Angular environment values are compiled into public
  browser JavaScript.
- Never share screenshots containing the Render Environment page or `.env`.
- If a secret is exposed in Git, chat, logs, or a screenshot, rotate it. Merely
  deleting it from the current file does not remove the leaked value.

## API routes

All routes use the `/api` prefix.

### Public movie routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/movies/popular` | Popular movies |
| `GET` | `/movies/genres` | TMDB genre list |
| `GET` | `/movies/now-playing` | Movies currently playing |
| `GET` | `/movies/search?query=&page=` | Search movies |
| `GET` | `/movies/:id` | Basic movie details |
| `GET` | `/movies/:id/full` | Movie details with videos and credits |

These are explicit proxy routes. The server does not accept arbitrary upstream
URLs, preventing it from becoming an open proxy.

### Authentication routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/user/signup` | Public | Create a password account |
| `POST` | `/user/login` | Public | Verify credentials and set session cookie |
| `POST` | `/user/gosin` | Public | Verify Google ID token and set session |
| `GET` | `/user/session` | Public | Return user or `null` for quiet header discovery |
| `GET` | `/user/me` | Authenticated | Return the sanitized current user |
| `POST` | `/user/logout` | Public | Clear the session cookie |

Login responses return sanitized user data. The JWT is never returned in JSON.

### Booking routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/getseats/:movieTitle` | Public | Return occupied seats without customer emails |
| `POST` | `/booking` | Authenticated | Save seats and add a ticket to the current user |

The booking controller ignores any browser-supplied user identity and uses the
verified JWT subject.

## Authentication flow

### Password login

1. The client sends email and password over HTTPS.
2. The server verifies the bcrypt password hash.
3. The server signs a short-lived JWT containing the user subject.
4. The JWT is stored in an HttpOnly session cookie.
5. Protected middleware verifies issuer, audience, signature, and expiry.

Legacy plaintext password records are upgraded to bcrypt after a successful
login.

### Google login

1. The Angular app receives a Google ID token after an explicit button click.
2. The backend verifies its signature, audience, issuer, expiry, and verified
   email through `google-auth-library`.
3. The server links the verified Google subject to the user.
4. The server creates the same HttpOnly application session.

Google One Tap is disabled in the frontend, and Google-only users do not receive
a shared placeholder password.

## Cookie and hosting requirements

Session cookies are:

- `HttpOnly`
- `SameSite=Lax`
- restricted to `/api`
- `Secure` when `NODE_ENV=production`

For production, the recommended topology is:

```text
https://your-frontend.example/api/*
  -> reverse proxy
  -> https://your-operatime-server.example/api/*
```

This keeps the cookie first-party. Configure the chosen frontend host, ingress,
or reverse proxy to forward `/api`. Also set `FRONTEND_ORIGINS` to the exact
allowed browser origins.

If frontend and backend are deliberately deployed cross-site, the cookie and
CSRF strategy must be redesigned before deployment; simply inserting a remote
backend URL into Angular is not sufficient.

## TMDB proxy behavior

- The browser never receives the TMDB token.
- Successful responses are cached in memory for five minutes by default.
- Duplicate in-flight requests are coalesced.
- Transient network failures receive bounded retries.
- A stale cached response can be returned during a brief TMDB outage.
- Customer application JWTs are never forwarded to TMDB.

Rotate any TMDB credential that has previously appeared in source control.
Deleting it from the current file does not remove it from Git history.

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start the API |
| `npm test` | Run Node security tests |
| `npm audit --omit=dev` | Audit production dependencies |

Current tests cover:

- HttpOnly/SameSite cookie configuration.
- Successful signed-cookie authentication.
- Rejection of browser-managed bearer headers.
- Guest-safe optional session discovery.

## Security notes

- Startup fails when `ACCESS_TOKEN_SECRET` is missing or too short.
- There are no hard-coded backend signing-secret fallbacks.
- MongoDB connection strings are not printed to logs.
- Password hashes are never returned from authenticated user endpoints.
- CORS uses an origin allowlist with credentials enabled.
- Public seat responses omit customer emails.
- Google identity is derived only from a verified ID token.

## Demo limitations and production work

Operatime deliberately prioritizes a frictionless portfolio demonstration.
Before adapting it for real commerce:

- Create and capture PayPal orders on the backend.
- Verify payment amount, currency, capture state, and order reuse.
- Make seat reservation and confirmation atomic to prevent race conditions.
- Generate cryptographically signed QR admission tokens on the backend.
- Add ticket-scanning and server-side redemption.
- Add rate limiting, structured validation, monitoring, and audit logging.
- Use a shared production cache if the API runs across multiple instances.

## Project structure

```text
Controller/    Authentication, users, bookings, and TMDB proxy
Middleware/    Required and optional session verification
Models/        Mongoose user and booking schemas
Routers/       API route declarations
config/        Security and session-cookie configuration
db/            MongoDB connection
test/          Node security tests
index.js       Express application entry point
```

## Frontend

See `C:\Projects\OperatimeApp\README.md` for the UI flow, Angular environments,
route access, and demo behavior.
