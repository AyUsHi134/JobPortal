import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * Factory for the signup handler, mirroring the `deps` injection-seam
 * pattern `createListJobsHandler`/`createGetJobHandler` already
 * established in controllers/jobs.js — lets backend/scripts/testAuthSecurity.js
 * exercise real signup logic deterministically (mocked User model/bcrypt,
 * no MongoDB connection) without touching production data. Production
 * behavior is unchanged: `routes/auth.js` still imports the same
 * `register`/`login` names.
 */
export function createRegisterHandler(deps = {}) {
  const UserModel = deps.User || User;
  const hash = deps.hash || bcrypt.hash;

  return async function register(req, res) {
    const { name, email, password } = req.body;
    try {
      let user = await UserModel.findOne({ email });
      if (user) return res.status(400).json({ msg: "User already exists" });

      const hashed = await hash(password, 10);
      user = new UserModel({ name, email, password: hashed });
      await user.save();

      // Never echoes the hash, the plaintext password, or any other user
      // field back to the client.
      res.status(201).json({ msg: "User created" });
    } catch (err) {
      res.status(500).json({ msg: "Server error" });
    }
  };
}

export const register = createRegisterHandler();

export function createLoginHandler(deps = {}) {
  const UserModel = deps.User || User;
  const compare = deps.compare || bcrypt.compare;
  const sign = deps.sign || jwt.sign;

  return async function login(req, res) {
    const { email, password } = req.body;
    try {
      const user = await UserModel.findOne({ email });
      // Both "no such user" and "wrong password" return the exact same
      // 401 + message — never reveal which case occurred, so a client
      // can't enumerate registered emails via the login endpoint.
      if (!user) return res.status(401).json({ msg: "Invalid credentials" });

      const isMatch = await compare(password, user.password);
      if (!isMatch) return res.status(401).json({ msg: "Invalid credentials" });

      const token = sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "2d" });
      res.json({ token, user: { name: user.name, email: user.email } });
    } catch (err) {
      res.status(500).json({ msg: "Server error" });
    }
  };
}

export const login = createLoginHandler();
