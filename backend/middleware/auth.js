// jobportal/backend/middleware/auth.js
import jwt from 'jsonwebtoken';

export default function auth(req, res, next) {
  const header = req.header('Authorization');
  if (!header) {
    return res.status(401).json({ message: 'No token, auth denied' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.id;
    next();
  } catch {
    res.status(401).json({ message: 'Token is not valid' });
  }
}
