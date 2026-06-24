const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5060);
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const sessions = new Map();
const pendingTwoFactorCodes = new Map();
const pendingPasskeyChallenges = new Map();
const pendingBiometricLogins = new Map();

const DEFAULT_SETTINGS = {
  biometricEnabled: false,
  twoFactorEnabled: false,
  darkMode: false,
  autoLogoutMinutes: 15
};

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(
    DB_PATH,
    JSON.stringify({ users: [], passwords: [] }, null, 2),
    "utf8"
  );
}

app.use(cors());
app.use(express.json());

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function mergeUserSettings(user) {
  return {
    ...DEFAULT_SETTINGS,
    ...(user.settings || {})
  };
}

function userById(db, userId) {
  return db.users.find((u) => u.id === userId);
}

function hashPassword(password, saltHex) {
  return crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64).toString("hex");
}

function deriveEncryptionKey(password, keySaltHex) {
  return crypto.scryptSync(password, Buffer.from(keySaltHex, "hex"), 32);
}

function encryptValue(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    cipherText: encrypted.toString("hex")
  };
}

function decryptValue(payload, key) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, "hex")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

function bytesToBase64Url(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\
    .replace(/=+$/g, "");
}

function base64UrlToBuffer(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = normalized + (pad ? "=".repeat(4 - pad) : "");
  return Buffer.from(padded, "base64");
}

function createChallenge() {
  return bytesToBase64Url(crypto.randomBytes(32));
}

function createTwoFactorCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function authRequired(req, res, next) {
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.session = sessions.get(token);
  req.token = token;
  return next();
}

function userByEmail(db, email) {
  return db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/signup", (req, res) => {
  const { username, email, masterPassword } = req.body || {};

  if (!username || !email || !masterPassword) {
    return res.status(400).json({ error: "username, email and masterPassword are required" });
  }

  if (String(masterPassword).length < 8) {
    return res.status(400).json({ error: "Master password must be at least 8 characters" });
  }

  const db = readDb();
  if (userByEmail(db, email)) {
    return res.status(409).json({ error: "Account already exists for this email" });
  }

  const hashSalt = crypto.randomBytes(16).toString("hex");
  const keySalt = crypto.randomBytes(16).toString("hex");

  const user = {
    id: uuidv4(),
    username,
    email,
    hashSalt,
    keySalt,
    masterHash: hashPassword(masterPassword, hashSalt),
    settings: DEFAULT_SETTINGS,
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  writeDb(db);

  return res.status(201).json({ success: true });
});

app.post("/api/auth/login", (req, res) => {
  const { email, masterPassword } = req.body || {};

  if (!email || !masterPassword) {
    return res.status(400).json({ error: "email and masterPassword are required" });
  }

  const db = readDb();
  const user = userByEmail(db, email);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const attempted = hashPassword(masterPassword, user.hashSalt);
  if (attempted !== user.masterHash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = uuidv4();
  const key = deriveEncryptionKey(masterPassword, user.keySalt);
  user.settings = mergeUserSettings(user);
  writeDb(db);

  sessions.set(token, {
    userId: user.id,
    keyHex: key.toString("hex")
  });

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    }
  });
});

app.post("/api/auth/biometric/register/options", authRequired, (req, res) => {
  const db = readDb();
  const user = userById(db, req.session.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const challenge = createChallenge();
  pendingPasskeyChallenges.set(user.id, {
    challenge,
    type: "register",
    expiresAt: Date.now() + 2 * 60 * 1000
  });

  return res.json({
    challenge,
    rp: { name: "SecurePass" },
    user: {
      id: bytesToBase64Url(Buffer.from(user.id, "utf8")),
      name: user.email,
      displayName: user.username || user.email
    }
  });
});

app.post("/api/auth/biometric/register/verify", authRequired, (req, res) => {
  const { credentialId, clientDataJSON } = req.body || {};

  if (!credentialId || !clientDataJSON) {
    return res.status(400).json({ error: "credentialId and clientDataJSON are required" });
  }

  const pending = pendingPasskeyChallenges.get(req.session.userId);
  if (!pending || pending.type !== "register" || pending.expiresAt < Date.now()) {
    pendingPasskeyChallenges.delete(req.session.userId);
    return res.status(400).json({ error: "Registration challenge expired. Try again." });
  }

  let clientData;
  try {
    clientData = JSON.parse(base64UrlToBuffer(clientDataJSON).toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid biometric response payload" });
  }

  if (clientData.challenge !== pending.challenge) {
    return res.status(400).json({ error: "Biometric challenge mismatch" });
  }

  const db = readDb();
  const user = userById(db, req.session.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  user.passkeyCredentialId = credentialId;
  user.passkeyEnabled = true;
  user.biometricKeyHex = req.session.keyHex;
  user.settings = {
    ...mergeUserSettings(user),
    biometricEnabled: true
  };

  pendingPasskeyChallenges.delete(req.session.userId);
  writeDb(db);

  return res.json({ success: true, settings: user.settings });
});

app.post("/api/auth/biometric/login/options", (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  const db = readDb();
  const user = userByEmail(db, email);

  if (!user || !user.passkeyEnabled || !user.passkeyCredentialId || !user.biometricKeyHex) {
    return res.status(400).json({ error: "Biometric login is not set up for this account" });
  }

  const challenge = createChallenge();
  pendingPasskeyChallenges.set(user.id, {
    challenge,
    type: "login",
    expiresAt: Date.now() + 2 * 60 * 1000
  });

  return res.json({
    challenge,
    credentialId: user.passkeyCredentialId
  });
});

app.post("/api/auth/biometric/login/verify", (req, res) => {
  const { email, credentialId, clientDataJSON } = req.body || {};

  if (!email || !credentialId || !clientDataJSON) {
    return res.status(400).json({ error: "email, credentialId and clientDataJSON are required" });
  }

  const db = readDb();
  const user = userByEmail(db, email);

  if (!user || !user.passkeyEnabled || !user.passkeyCredentialId || !user.biometricKeyHex) {
    return res.status(401).json({ error: "Biometric login failed" });
  }

  if (user.passkeyCredentialId !== credentialId) {
    return res.status(401).json({ error: "Biometric credential mismatch" });
  }

  const pending = pendingPasskeyChallenges.get(user.id);
  if (!pending || pending.type !== "login" || pending.expiresAt < Date.now()) {
    pendingPasskeyChallenges.delete(user.id);
    return res.status(400).json({ error: "Biometric challenge expired. Try again." });
  }

  let clientData;
  try {
    clientData = JSON.parse(base64UrlToBuffer(clientDataJSON).toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid biometric response payload" });
  }

  if (clientData.challenge !== pending.challenge) {
    return res.status(401).json({ error: "Biometric challenge mismatch" });
  }

  pendingPasskeyChallenges.delete(user.id);

  const settings = mergeUserSettings(user);
  if (settings.twoFactorEnabled) {
    const twoFactorCode = createTwoFactorCode();
    const pendingLoginToken = uuidv4();

    pendingBiometricLogins.set(pendingLoginToken, {
      userId: user.id,
      keyHex: user.biometricKeyHex,
      code: twoFactorCode,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    return res.json({
      requiresTwoFactor: true,
      pendingLoginToken,
      code: twoFactorCode,
      expiresInSeconds: 300
    });
  }

  const token = uuidv4();
  sessions.set(token, {
    userId: user.id,
    keyHex: user.biometricKeyHex
  });

  return res.json({
    requiresTwoFactor: false,
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    }
  });
});

app.post("/api/auth/biometric/login/2fa-verify", (req, res) => {
  const { pendingLoginToken, code } = req.body || {};

  if (!pendingLoginToken || !code) {
    return res.status(400).json({ error: "pendingLoginToken and code are required" });
  }

  const pending = pendingBiometricLogins.get(pendingLoginToken);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingBiometricLogins.delete(pendingLoginToken);
    return res.status(400).json({ error: "Biometric login verification expired. Try again." });
  }

  if (String(code) !== pending.code) {
    return res.status(400).json({ error: "Invalid verification code" });
  }

  const db = readDb();
  const user = userById(db, pending.userId);
  if (!user) {
    pendingBiometricLogins.delete(pendingLoginToken);
    return res.status(404).json({ error: "User not found" });
  }

  const token = uuidv4();
  sessions.set(token, {
    userId: user.id,
    keyHex: pending.keyHex
  });

  pendingBiometricLogins.delete(pendingLoginToken);

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    }
  });
});

app.delete("/api/auth/biometric", authRequired, (req, res) => {
  const db = readDb();
  const user = userById(db, req.session.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  delete user.passkeyCredentialId;
  delete user.passkeyEnabled;
  delete user.biometricKeyHex;
  user.settings = {
    ...mergeUserSettings(user),
    biometricEnabled: false
  };

  pendingPasskeyChallenges.delete(user.id);
  writeDb(db);
  return res.json({ success: true, settings: user.settings });
});

app.post("/api/auth/logout", authRequired, (req, res) => {
  sessions.delete(req.token);
  res.json({ success: true });
});

app.post("/api/auth/change-master", authRequired, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }

  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: "New master password must be at least 8 characters" });
  }

  const db = readDb();
  const user = userById(db, req.session.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const currentHash = hashPassword(currentPassword, user.hashSalt);
  if (currentHash !== user.masterHash) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const currentKey = Buffer.from(req.session.keyHex, "hex");
  const newHashSalt = crypto.randomBytes(16).toString("hex");
  const newKeySalt = crypto.randomBytes(16).toString("hex");
  const newKey = deriveEncryptionKey(newPassword, newKeySalt);

  db.passwords = db.passwords.map((entry) => {
    if (entry.userId !== req.session.userId) {
      return entry;
    }

    const plain = decryptValue(entry.passwordEncrypted, currentKey);
    return {
      ...entry,
      passwordEncrypted: encryptValue(plain, newKey)
    };
  });

  user.hashSalt = newHashSalt;
  user.keySalt = newKeySalt;
  user.masterHash = hashPassword(newPassword, newHashSalt);
  if (user.passkeyEnabled) {
    user.biometricKeyHex = newKey.toString("hex");
  }

  req.session.keyHex = newKey.toString("hex");
  writeDb(db);
  return res.json({ success: true });
});

app.get("/api/settings", authRequired, (req, res) => {
  const db = readDb();
  const user = userById(db, req.session.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  user.settings = mergeUserSettings(user);
  writeDb(db);
  return res.json({ settings: user.settings });
});

app.patch("/api/settings", authRequired, (req, res) => {
  const db = readDb();
  const user = userById(db, req.session.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const current = mergeUserSettings(user);
  const payload = req.body || {};

  const next = {
    ...current,
    ...(typeof payload.biometricEnabled === "boolean"
      ? { biometricEnabled: payload.biometricEnabled }
      : {}),
    ...(typeof payload.darkMode === "boolean" ? { darkMode: payload.darkMode } : {}),
    ...(typeof payload.twoFactorEnabled === "boolean"
      ? { twoFactorEnabled: payload.twoFactorEnabled }
      : {}),
    ...(payload.autoLogoutMinutes
      ? {
          autoLogoutMinutes: Math.max(5, Math.min(60, Number(payload.autoLogoutMinutes) || 15))
        }
      : {})
  };

  user.settings = next;
  writeDb(db);
  return res.json({ settings: next });
});

app.post("/api/settings/2fa/request", authRequired, (req, res) => {
  const code = createTwoFactorCode();
  pendingTwoFactorCodes.set(req.session.userId, {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  return res.json({ code, expiresInSeconds: 300 });
});

app.post("/api/settings/2fa/verify", authRequired, (req, res) => {
  const { code } = req.body || {};
  const pending = pendingTwoFactorCodes.get(req.session.userId);

  if (!pending || pending.expiresAt < Date.now()) {
    pendingTwoFactorCodes.delete(req.session.userId);
    return res.status(400).json({ error: "2FA verification expired. Try again." });
  }

  if (String(code || "") !== pending.code) {
    return res.status(400).json({ error: "Invalid verification code" });
  }

  const db = readDb();
  const user = userById(db, req.session.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  user.settings = {
    ...mergeUserSettings(user),
    twoFactorEnabled: true
  };

  pendingTwoFactorCodes.delete(req.session.userId);
  writeDb(db);

  return res.json({ settings: user.settings });
});

app.get("/api/data/export", authRequired, (req, res) => {
  const db = readDb();
  const user = userById(db, req.session.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      settings: mergeUserSettings(user)
    },
    passwords: db.passwords.filter((p) => p.userId === user.id)
  };

  return res.json({ data: exportPayload });
});

app.delete("/api/account", authRequired, (req, res) => {
  const db = readDb();
  const userId = req.session.userId;

  db.users = db.users.filter((u) => u.id !== userId);
  db.passwords = db.passwords.filter((p) => p.userId !== userId);
  writeDb(db);

  for (const [token, value] of sessions.entries()) {
    if (value.userId === userId) {
      sessions.delete(token);
    }
  }

  pendingTwoFactorCodes.delete(userId);
  return res.json({ success: true });
});

app.get("/api/passwords", authRequired, (req, res) => {
  const db = readDb();
  const key = Buffer.from(req.session.keyHex, "hex");
  const searchQuery = (req.query.q || "").toLowerCase();

  const items = db.passwords
    .filter((p) => p.userId === req.session.userId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      username: p.username,
      url: p.url,
      icon: p.icon || "🔒",
      color: p.color || "from-blue-400 to-blue-500",
      createdAt: p.createdAt,
      password: decryptValue(p.passwordEncrypted, key)
    }));

  const filtered = searchQuery
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery) ||
          item.username.toLowerCase().includes(searchQuery) ||
          item.url.toLowerCase().includes(searchQuery)
      )
    : items;

  res.json({ items: filtered, totalCount: items.length, filteredCount: filtered.length });
});

app.get("/api/passwords/:id", authRequired, (req, res) => {
  const db = readDb();
  const key = Buffer.from(req.session.keyHex, "hex");

  const item = db.passwords.find(
    (p) => p.id === req.params.id && p.userId === req.session.userId
  );

  if (!item) {
    return res.status(404).json({ error: "Password not found" });
  }

  return res.json({
    item: {
      id: item.id,
      name: item.name,
      username: item.username,
      url: item.url,
      icon: item.icon || "🔒",
      color: item.color || "from-blue-400 to-blue-500",
      createdAt: item.createdAt,
      password: decryptValue(item.passwordEncrypted, key)
    }
  });
});

app.post("/api/passwords", authRequired, (req, res) => {
  const { name, username, url, password, icon, color } = req.body || {};

  if (!name || !username || !url || !password) {
    return res.status(400).json({ error: "name, username, url and password are required" });
  }

  const db = readDb();
  const key = Buffer.from(req.session.keyHex, "hex");

  const record = {
    id: uuidv4(),
    userId: req.session.userId,
    name,
    username,
    url,
    icon: icon || "🔒",
    color: color || "from-blue-400 to-blue-500",
    passwordEncrypted: encryptValue(password, key),
    createdAt: new Date().toISOString()
  };

  db.passwords.unshift(record);
  writeDb(db);

  return res.status(201).json({ success: true, id: record.id });
});

app.put("/api/passwords/:id", authRequired, (req, res) => {
  const { name, username, url, password, icon, color } = req.body || {};
  const db = readDb();
  const key = Buffer.from(req.session.keyHex, "hex");

  const index = db.passwords.findIndex(
    (p) => p.id === req.params.id && p.userId === req.session.userId
  );

  if (index < 0) {
    return res.status(404).json({ error: "Password not found" });
  }

  const existing = db.passwords[index];
  db.passwords[index] = {
    ...existing,
    name: name || existing.name,
    username: username || existing.username,
    url: url || existing.url,
    icon: icon || existing.icon,
    color: color || existing.color,
    passwordEncrypted: password ? encryptValue(password, key) : existing.passwordEncrypted
  };

  writeDb(db);
  return res.json({ success: true });
});

app.delete("/api/passwords/:id", authRequired, (req, res) => {
  const db = readDb();
  const before = db.passwords.length;

  db.passwords = db.passwords.filter(
    (p) => !(p.id === req.params.id && p.userId === req.session.userId)
  );

  if (db.passwords.length === before) {
    return res.status(404).json({ error: "Password not found" });
  }

  writeDb(db);
  return res.json({ success: true });
});

app.post("/api/passwords/generate", authRequired, (req, res) => {
  const {
    length = 16,
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true
  } = req.body || {};

  let chars = "";
  if (uppercase) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (lowercase) chars += "abcdefghijklmnopqrstuvwxyz";
  if (numbers) chars += "0123456789";
  if (symbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";

  if (!chars.length) {
    return res.status(400).json({ error: "Enable at least one character set" });
  }

  const count = Math.max(4, Math.min(64, Number(length) || 16));
  const bytes = crypto.randomBytes(count);

  let password = "";
  for (let i = 0; i < count; i += 1) {
    password += chars[bytes[i] % chars.length];
  }

  return res.json({ password });
});

app.post("/api/backup/create", authRequired, (req, res) => {
  const db = readDb();
  const user = userById(db, req.session.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const userPasswords = db.passwords.filter((p) => p.userId === user.id);

  const backupData = {
    version: "1.0.0",
    backupId: uuidv4(),
    createdAt: new Date().toISOString(),
    userEmail: user.email,
    passwordCount: userPasswords.length,

    passwords: userPasswords.map((p) => ({
      id: p.id,
      name: p.name,
      username: p.username,
      url: p.url,
      icon: p.icon,
      color: p.color,
      passwordEncrypted: p.passwordEncrypted,
      createdAt: p.createdAt
    }))
  };

  const key = Buffer.from(req.session.keyHex, "hex");
  const backupJson = JSON.stringify(backupData);
  const encryptedBackup = encryptValue(backupJson, key);

  const checksum = crypto.createHash("sha256").update(backupJson).digest("hex");

  return res.json({
    success: true,
    backup: {
      backupId: backupData.backupId,
      createdAt: backupData.createdAt,
      passwordCount: userPasswords.length,
      encryptedData: encryptedBackup,
      checksum
    }
  });
});

app.post("/api/backup/restore", authRequired, (req, res) => {
  const { encryptedData, checksum } = req.body || {};

  if (!encryptedData || !checksum) {
    return res.status(400).json({ error: "encryptedData and checksum are required" });
  }

  try {
    const key = Buffer.from(req.session.keyHex, "hex");

    const decryptedJson = decryptValue(encryptedData, key);
    const backupData = JSON.parse(decryptedJson);

    const computedChecksum = crypto.createHash("sha256").update(decryptedJson).digest("hex");
    if (computedChecksum !== checksum) {
      return res.status(400).json({ error: "Backup checksum mismatch. File may be corrupted." });
    }

    if (!backupData.version || !backupData.passwords || !Array.isArray(backupData.passwords)) {
      return res.status(400).json({ error: "Invalid backup file format" });
    }

    const db = readDb();
    const user = userById(db, req.session.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (backupData.userEmail !== user.email) {
      return res.status(400).json({ error: "Backup does not belong to this account" });
    }

    const restoredCount = backupData.passwords.length;
    let importedCount = 0;

    for (const passwordEntry of backupData.passwords) {

      const existingIndex = db.passwords.findIndex((p) => p.id === passwordEntry.id);

      if (existingIndex < 0) {

        db.passwords.push({
          id: passwordEntry.id,
          userId: user.id,
          name: passwordEntry.name,
          username: passwordEntry.username,
          url: passwordEntry.url,
          icon: passwordEntry.icon || "🔒",
          color: passwordEntry.color || "from-blue-400 to-blue-500",
          passwordEncrypted: passwordEntry.passwordEncrypted,
          createdAt: passwordEntry.createdAt
        });
        importedCount++;
      }
    }

    writeDb(db);

    return res.json({
      success: true,
      restoredCount: restoredCount,
      importedCount: importedCount,
      duplicateCount: restoredCount - importedCount
    });
  } catch (error) {
    return res.status(400).json({
      error: "Failed to restore backup. Invalid file or wrong master password."
    });
  }
});

app.get("/api/backup/list", authRequired, (req, res) => {

  return res.json({ backups: [] });
});

app.get("/api/performance/status", authRequired, (req, res) => {
  const startTime = Date.now();
  const db = readDb();
  const user = userById(db, req.session.userId);
  const passwordCount = db.passwords.filter((p) => p.userId === req.session.userId).length;
  const responseTime = Date.now() - startTime;

  return res.json({
    status: "ok",
    passwordCount,
    responseTimeMs: responseTime,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/audit/stats", authRequired, (req, res) => {
  const db = readDb();
  const user = userById(db, req.session.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const userPasswords = db.passwords.filter((p) => p.userId === user.id);
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const stats = {
    totalPasswords: userPasswords.length,
    createdThisMonth: userPasswords.filter(
      (p) => new Date(p.createdAt).getTime() > thirtyDaysAgo
    ).length,
    accountAge: Math.floor(
      (now - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000)
    ),
    lastActivityAt: new Date().toISOString(),
    securityStatus: {
      masterPasswordSet: !!user.masterHash,
      twoFactorEnabled: user.settings?.twoFactorEnabled || false,
      biometricEnabled: user.settings?.biometricEnabled || false,
      autoLogoutMinutes: user.settings?.autoLogoutMinutes || 15
    },
    encryptionInfo: {
      algorithm: "AES-256-GCM",
      keyDerivation: "scrypt",
      status: "enabled"
    }
  };

  return res.json(stats);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

app.post("/api/autofill/get-credentials", authRequired, (req, res) => {
  const { siteName, siteUrl } = req.body || {};

  if (!siteName || !siteUrl) {
    return res.status(400).json({ error: "siteName and siteUrl are required" });
  }

  try {
    const db = readDb();
    const key = Buffer.from(req.session.keyHex, "hex");

    const userPasswords = db.passwords.filter((p) => p.userId === req.session.userId);

    let matchedPassword = null;

    for (const pwd of userPasswords) {
      try {
        const pwdUrl = new URL(pwd.url);
        const siteUrlObj = new URL(siteUrl);

        if (pwdUrl.hostname === siteUrlObj.hostname) {
          matchedPassword = pwd;
          break;
        }
      } catch {

        if (pwd.url.includes(new URL(siteUrl).hostname)) {
          matchedPassword = pwd;
          break;
        }
      }
    }

    if (!matchedPassword) {
      const siteNameLower = siteName.toLowerCase();
      matchedPassword = userPasswords.find(
        (p) => p.name.toLowerCase().includes(siteNameLower) ||
               p.url.includes(siteNameLower)
      );
    }

    if (!matchedPassword) {
      return res.status(404).json({ error: "No matching credentials found" });
    }

    const decryptedPassword = decryptValue(matchedPassword.passwordEncrypted, key);

    return res.json({
      success: true,
      credentials: {
        username: matchedPassword.username,
        password: decryptedPassword,
        siteName: matchedPassword.name,
        siteUrl: matchedPassword.url
      }
    });
  } catch (error) {
    console.error("[Autofill] Error:", error);
    return res.status(500).json({ error: "Autofill request failed" });
  }
});

app.get("/api/autofill/settings", authRequired, (req, res) => {
  const db = readDb();
  const user = userById(db, req.session.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({
    autofillEnabled: user.autofillEnabled !== false,
    httpsOnly: true,
    matchOnUrl: true,
    matchOnName: true
  });
});

app.patch("/api/autofill/settings", authRequired, (req, res) => {
  const db = readDb();
  const user = userById(db, req.session.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const { autofillEnabled } = req.body || {};

  if (typeof autofillEnabled === "boolean") {
    user.autofillEnabled = autofillEnabled;
    writeDb(db);
  }

  return res.json({
    success: true,
    autofillEnabled: user.autofillEnabled !== false
  });
});

app.post("/api/autofill/log", authRequired, (req, res) => {
  const { siteName, siteUrl, success } = req.body || {};

  console.log(`[Autofill] ${success ? "✅" : "❌"} ${siteName} at ${siteUrl} (User: ${req.session.userId})`);

  return res.json({ success: true });
});
