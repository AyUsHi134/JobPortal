import jwt from 'jsonwebtoken';

/**
 * Verifies the `Authorization: Bearer <token>` header and establishes
 * `req.user` as the authenticated identity for every downstream
 * protected handler. This is the ONLY place a request's user identity
 * should ever come from — controllers must never trust a client-supplied
 * id (e.g. `req.body.userId`) as if it were an authenticated identity
 * (see PHASE_1I4_REPORT.md for the save-job/profile impersonation gaps
 * this closes).
 *
 * Missing, malformed, invalid-signature, and expired tokens are all
 * rejected the same way: a generic 401 with no distinguishing detail
 * (jwt.verify throws JsonWebTokenError/TokenExpiredError/NotBeforeError
 * alike for all of these, and none of it — nor the token itself — is
 * ever logged here).
 */
export default function auth(req, res, next) {
  const header = req.header('Authorization');
  if (!header) {
    return res.status(401).json({ message: 'No token, auth denied' });
  }

  const token = header.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token is not valid' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Previously `req.user = decoded.id` (a bare string) — every
    // downstream `req.user.id` read was therefore always `undefined`,
    // which is what let saveJob/isJobSaved (bypassing this middleware
    // entirely) trust an unauthenticated `req.body.userId` instead.
    req.user = { id: decoded.id };
    next();
  } catch {
    res.status(401).json({ message: 'Token is not valid' });
  }
}
