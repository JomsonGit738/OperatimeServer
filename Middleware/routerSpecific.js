
const jwt = require("jsonwebtoken");
const {
  ACCESS_TOKEN_SECRET,
  SESSION_COOKIE_NAME,
} = require("../config/security");

const attachVerifiedIdentity = (request, token) => {
  const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET, {
    audience: "operatime-web",
    issuer: "operatime-server",
  });
  request.userId = decoded.sub;
  request.userEmail = decoded.userEmail;
};

const loginMiddleware = (request, response, next) => {
  const token = request.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    return response.status(401).json({ message: "Authentication required" });
  }

  try {
    attachVerifiedIdentity(request, token);
    // Controllers use only this verified identity, never an email supplied by the browser.
    return next();
  } catch {
    return response
      .status(401)
      .json({ message: "Session expired. Please log in again." });
  }
};

const optionalLoginMiddleware = (request, _response, next) => {
  const token = request.cookies?.[SESSION_COOKIE_NAME];
  if (token) {
    try {
      attachVerifiedIdentity(request, token);
    } catch {
      // A guest or expired session is normal on public pages; protected routes still return 401.
    }
  }
  return next();
};

module.exports = { loginMiddleware, optionalLoginMiddleware };
