
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "node:path";
import { fileURLToPath } from "node:url";


const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 5000;
const secret = process.env.JWT_SECRET;
if (!process.env.MONGODB_URI || !secret) throw new Error("Set MONGODB_URI and JWT_SECRET in .env before starting SharePlate.");

const userSchema = new mongoose.Schema({ name: { type: String, required: true }, email: { type: String, unique: true, lowercase: true, required: true }, password: { type: String, required: true }, role: { type: String, enum: ["admin", "ngo", "donor", "recipient", "volunteer"], required: true }, organisation: String, approved: { type: Boolean, default: true } }, { timestamps: true });
const donationSchema = new mongoose.Schema({ donor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, donorName: String, food: String, meals: Number, expiry: String, area: String, priority: { type: String, enum: ["Available", "Urgent"], default: "Available" }, pickup: { type: Boolean, default: false }, recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, createdAt: { type: Date, default: Date.now } });
const recipientSchema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, name: String, meals: Number, notes: String, area: String, contact: String });
const volunteerSchema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, name: String, role: String, availability: String, hours: { type: Number, default: 0 }, phone: String });
const User = mongoose.model("User", userSchema);
const Donation = mongoose.model("Donation", donationSchema);
const Recipient = mongoose.model("Recipient", recipientSchema);
const Volunteer = mongoose.model("Volunteer", volunteerSchema);

app.use(express.json());
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working" });
});
const tokenFor = (user) => jwt.sign({ id: user._id, role: user.role, name: user.name }, secret, { expiresIn: "8h" });
const auth = (...roles) => async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Please sign in." });
    const decoded = jwt.verify(token, secret); const user = await User.findById(decoded.id);
    if (!user || !user.approved) return res.status(401).json({ error: "Account is unavailable." });
    if (roles.length && !roles.includes(user.role)) return res.status(403).json({ error: "This role cannot access that action." });
    req.user = user; next();
  } catch { res.status(401).json({ error: "Your session has expired. Please sign in again." }); }
};

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { name, email, password, role, organisation = "" } = req.body;
    if (!name || !email || !password || !["ngo", "donor", "recipient", "volunteer"].includes(role)) return res.status(400).json({ error: "Complete all required registration fields." });
    if (password.length < 8) return res.status(400).json({ error: "Use a password of at least 8 characters." });
    if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ error: "An account already exists with this email." });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), role, organisation });
    res.status(201).json({ token: tokenFor(user), user: { id: user._id, name: user.name, email: user.email, role: user.role, organisation: user.organisation } });
  } catch (e) { next(e); }
});
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const user = await User.findOne({ email: String(req.body.email || "").toLowerCase() });
    if (!user || !(await bcrypt.compare(req.body.password || "", user.password))) return res.status(401).json({ error: "Incorrect email or password." });
    res.json({ token: tokenFor(user), user: { id: user._id, name: user.name, email: user.email, role: user.role, organisation: user.organisation } });
  } catch (e) { next(e); }
});
app.get("/api/auth/me", auth(), (req, res) => res.json({ id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role, organisation: req.user.organisation }));

app.get("/api/data", auth(), async (req, res, next) => {
  try {
    const query = req.user.role === "donor" ? { donor: req.user._id } : req.user.role === "recipient" ? { recipient: req.user._id } : {};
    const [donations, recipients, volunteers] = await Promise.all([Donation.find(query).sort({ createdAt: -1 }), Recipient.find().sort({ name: 1 }), Volunteer.find().sort({ name: 1 })]);
    res.json({ donations, recipients, volunteers });
  } catch (e) { next(e); }
});
app.post("/api/donations", auth("donor", "ngo", "admin"), async (req, res, next) => {
  try {
    const { food, meals, expiry, area, priority = "Available" } = req.body;
    if (![food, meals, expiry, area].every(Boolean)) return res.status(400).json({ error: "Complete all donation fields." });
    const item = await Donation.create({ donor: req.user._id, donorName: req.user.organisation || req.user.name, food, meals: Number(meals), expiry, area, priority });
    res.status(201).json(item);
  } catch (e) { next(e); }
});
app.patch("/api/donations/:id", auth("ngo", "admin"), async (req, res, next) => {
  try {
    const update = {}; if (typeof req.body.pickup === "boolean") update.pickup = req.body.pickup;
    if (req.body.recipient) update.recipient = req.body.recipient || null;
    const item = await Donation.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!item) return res.status(404).json({ error: "Donation not found." });
    res.json(item);
  } catch (e) { next(e); }
});
app.delete("/api/donations/:id", auth("donor", "ngo", "admin"), async (req, res, next) => {
  try {
    const item = await Donation.findById(req.params.id);
    if (!item || (req.user.role === "donor" && String(item.donor) !== String(req.user._id))) return res.status(404).json({ error: "Donation not found." });
    await item.deleteOne(); res.status(204).end();
  } catch (e) { next(e); }
});
app.post("/api/recipients", auth("recipient", "ngo", "admin"), async (req, res, next) => {
  try { const { name, meals, area, notes = "", contact = "" } = req.body; if (!name || !meals || !area) return res.status(400).json({ error: "Complete recipient name, meal need and area." }); res.status(201).json(await Recipient.create({ user: req.user._id, name, meals: Number(meals), area, notes, contact })); } catch (e) { next(e); }
});
app.post("/api/volunteers", auth("volunteer", "ngo", "admin"), async (req, res, next) => {
  try { const { name, role, availability, hours = 0, phone = "" } = req.body; if (!name || !role || !availability) return res.status(400).json({ error: "Complete volunteer name, role and availability." }); res.status(201).json(await Volunteer.create({ user: req.user._id, name, role, availability, hours: Number(hours), phone })); } catch (e) { next(e); }
});
app.delete("/api/recipients/:id", auth("recipient", "ngo", "admin"), async (req, res, next) => {
  try { await Recipient.findByIdAndDelete(req.params.id); res.status(204).end(); } catch (e) { next(e); }
});
app.delete("/api/volunteers/:id", auth("volunteer", "ngo", "admin"), async (req, res, next) => {
  try { await Volunteer.findByIdAndDelete(req.params.id); res.status(204).end(); } catch (e) { next(e); }
});
app.use(express.static(path.join(root, "dist")));
app.get("/{*splat}", (_req, res) => res.sendFile(path.join(root, "dist", "index.html")));
app.use((e, _req, res, _next) => { console.error(e); res.status(500).json({ error: "The server could not process this request." }); });

mongoose.connect(process.env.MONGODB_URI).then(() => app.listen(port, () => console.log(`SharePlate running at http://127.0.0.1:${port}`))).catch((e) => { console.error("MongoDB connection failed:", e.message); process.exit(1); });
