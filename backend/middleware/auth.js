import jwt from 'jsonwebtoken';

/** Verifies Bearer token, sets req.user */
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
    // Set req.user to decoded token
    req.user = { id: decoded.id };
    next();
  } catch {
    res.status(401).json({ message: 'Token is not valid' });
  }
}
