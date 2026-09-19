import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

/** Signup handler factory, injectable deps */
export function createRegisterHandler(deps = {}) {
  const UserModel = deps.User || User;
  const hash = deps.hash || bcrypt.hash;
  const sign = deps.sign || jwt.sign;

  return async function register(req, res) {
    const { name, email, password } = req.body;
    try {
      let user = await UserModel.findOne({ email });
      if (user) return res.status(400).json({ msg: "User already exists" });

      const hashed = await hash(password, 10);
      user = new UserModel({ name, email, password: hashed });
      await user.save();

      // Never returns hash or password
      const token = sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "2d" });
      res.status(201).json({ token, user: { name: user.name, email: user.email } });
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
      // Same 401 prevents email enumeration
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
