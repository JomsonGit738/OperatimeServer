const isProduction = process.env.NODE_ENV === "production";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
if (!ACCESS_TOKEN_SECRET) {
  throw new Error(
    "ACCESS_TOKEN_SECRET is required. Refusing to start with a hard-coded signing secret."
  );
}
if (ACCESS_TOKEN_SECRET.length < 32) {
  throw new Error("ACCESS_TOKEN_SECRET must be at least 32 characters long.");
}

const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME || "operatime_session";
const SESSION_COOKIE_MAX_AGE_MS = Number(
  process.env.SESSION_COOKIE_MAX_AGE_MS || 15 * 60 * 1000
);

const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  // The frontend uses a same-origin /api proxy, so Lax protects against most CSRF.
  sameSite: "lax",
  path: "/api",
  maxAge: SESSION_COOKIE_MAX_AGE_MS,
});

module.exports = {
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
};
