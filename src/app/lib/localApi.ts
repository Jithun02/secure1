const USERS_KEY = "spm_users_v2";
const AUTOFILL_KEY = "spm_autofill_settings";

type StoredUser = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  keySalt: string;
  settings?: Record<string, unknown>;
};

type StoredEntry = {
  id: string;
  userId: string;
  iv: string;
  cipherText: string;
  tag: string;
};

export type PasswordEntry = {
  id: string;
  site: string;
  username: string;
  password: string;
  category?: string;
  createdAt?: string;
};

export type AutofillSettings = {
  autofillEnabled: boolean;
  httpsOnly: boolean;
  matchOnUrl: boolean;
  matchOnName: boolean;
};

function vaultKey(userId: string) {
  return `spm_vault_${userId}`;
}

function getUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getVault(userId: string): StoredEntry[] {
  try {
    return JSON.parse(localStorage.getItem(vaultKey(userId)) || "[]");
  } catch {
    return [];
  }
}

function saveVault(userId: string, vault: StoredEntry[]) {
  localStorage.setItem(vaultKey(userId), JSON.stringify(vault));
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(salt), iterations: 200000, hash: "SHA-256" },
    keyMaterial, 256
  );
  return bytesToHex(new Uint8Array(bits));
}

async function deriveKey(password: string, keySalt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: hexToBytes(keySalt), iterations: 200000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(data: object, key: CryptoKey): Promise<{ iv: string; cipherText: string; tag: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(data))
  );
  const encBytes = new Uint8Array(encrypted);
  const cipherText = encBytes.slice(0, encBytes.length - 16);
  const tag = encBytes.slice(encBytes.length - 16);
  return {
    iv: bytesToHex(iv),
    cipherText: bytesToHex(cipherText),
    tag: bytesToHex(tag),
  };
}

async function decryptData(stored: { iv: string; cipherText: string; tag: string }, key: CryptoKey): Promise<object> {
  const iv = hexToBytes(stored.iv);
  const cipherText = hexToBytes(stored.cipherText);
  const tag = hexToBytes(stored.tag);
  const combined = new Uint8Array(cipherText.length + tag.length);
  combined.set(cipherText);
  combined.set(tag, cipherText.length);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

function randomHex(bytes: number): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}

let _currentKey: CryptoKey | null = null;
let _currentUserId: string | null = null;

export function setCurrentSession(userId: string, key: CryptoKey) {
  _currentKey = key;
  _currentUserId = userId;
}

export function clearCurrentSession() {
  _currentKey = null;
  _currentUserId = null;
}

export async function localSignup(username: string, email: string, masterPassword: string): Promise<void> {
  const users = getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("An account with this email already exists.");
  }
  const salt = randomHex(32);
  const keySalt = randomHex(32);
  const passwordHash = await hashPassword(masterPassword, salt);
  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    username,
    email: email.toLowerCase(),
    passwordHash,
    salt,
    keySalt,
  };
  users.push(newUser);
  saveUsers(users);
}

export async function localLogin(email: string, masterPassword: string): Promise<{ token: string; user: { id: string; username: string; email: string } }> {
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error("No account found with this email.");

  const hash = await hashPassword(masterPassword, user.salt);
  if (hash !== user.passwordHash) throw new Error("Incorrect master password.");

  const key = await deriveKey(masterPassword, user.keySalt);
  setCurrentSession(user.id, key);

  return {
    token: "local_session_" + user.id,
    user: { id: user.id, username: user.username, email: user.email },
  };
}

export async function localChangeMasterPassword(currentPassword: string, newPassword: string): Promise<void> {
  if (!_currentUserId) throw new Error("Not authenticated.");
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === _currentUserId);
  if (userIndex === -1) throw new Error("User not found.");
  const user = users[userIndex];

  const currentHash = await hashPassword(currentPassword, user.salt);
  if (currentHash !== user.passwordHash) throw new Error("Current password is incorrect.");

  const passwords = await localGetPasswords();

  const newSalt = randomHex(32);
  const newKeySalt = randomHex(32);
  const newPasswordHash = await hashPassword(newPassword, newSalt);
  const newKey = await deriveKey(newPassword, newKeySalt);

  const newVault: StoredEntry[] = [];
  for (const entry of passwords) {
    const encrypted = await encryptData(entry, newKey);
    newVault.push({ id: entry.id, userId: _currentUserId!, ...encrypted });
  }

  users[userIndex] = { ...user, salt: newSalt, keySalt: newKeySalt, passwordHash: newPasswordHash };
  saveUsers(users);
  saveVault(_currentUserId!, newVault);
  _currentKey = newKey;
}

export async function localDeleteAccount(): Promise<void> {
  if (!_currentUserId) return;
  const users = getUsers().filter(u => u.id !== _currentUserId);
  saveUsers(users);
  localStorage.removeItem(vaultKey(_currentUserId));
  clearCurrentSession();
}

export async function localGetPasswords(): Promise<PasswordEntry[]> {
  if (!_currentKey || !_currentUserId) throw new Error("Not authenticated.");
  const vault = getVault(_currentUserId);
  const results: PasswordEntry[] = [];
  for (const entry of vault) {
    try {
      const decrypted = await decryptData(entry, _currentKey) as PasswordEntry;
      results.push({ ...decrypted, id: entry.id });
    } catch {
      // skip corrupted entries
    }
  }
  return results;
}

export async function localAddPassword(data: Omit<PasswordEntry, "id">): Promise<PasswordEntry> {
  if (!_currentKey || !_currentUserId) throw new Error("Not authenticated.");
  const id = crypto.randomUUID();
  const entry: PasswordEntry = { ...data, id, createdAt: new Date().toISOString() };
  const encrypted = await encryptData(entry, _currentKey);
  const vault = getVault(_currentUserId);
  vault.push({ id, userId: _currentUserId, ...encrypted });
  saveVault(_currentUserId, vault);
  return entry;
}

export async function localGetPassword(id: string): Promise<PasswordEntry> {
  if (!_currentKey || !_currentUserId) throw new Error("Not authenticated.");
  const vault = getVault(_currentUserId);
  const stored = vault.find(e => e.id === id);
  if (!stored) throw new Error("Password not found.");
  const decrypted = await decryptData(stored, _currentKey) as PasswordEntry;
  return { ...decrypted, id };
}

export async function localUpdatePassword(id: string, data: Partial<PasswordEntry>): Promise<PasswordEntry> {
  if (!_currentKey || !_currentUserId) throw new Error("Not authenticated.");
  const vault = getVault(_currentUserId);
  const index = vault.findIndex(e => e.id === id);
  if (index === -1) throw new Error("Password not found.");
  const existing = await decryptData(vault[index], _currentKey) as PasswordEntry;
  const updated: PasswordEntry = { ...existing, ...data, id };
  const encrypted = await encryptData(updated, _currentKey);
  vault[index] = { id, userId: _currentUserId, ...encrypted };
  saveVault(_currentUserId, vault);
  return updated;
}

export async function localDeletePassword(id: string): Promise<void> {
  if (!_currentUserId) throw new Error("Not authenticated.");
  const vault = getVault(_currentUserId);
  saveVault(_currentUserId, vault.filter(e => e.id !== id));
}

export function getAutofillSettings(): AutofillSettings {
  try {
    const raw = localStorage.getItem(AUTOFILL_KEY);
    if (!raw) return { autofillEnabled: true, httpsOnly: true, matchOnUrl: true, matchOnName: true };
    return JSON.parse(raw) as AutofillSettings;
  } catch {
    return { autofillEnabled: true, httpsOnly: true, matchOnUrl: true, matchOnName: true };
  }
}

export function saveAutofillSettings(settings: AutofillSettings): void {
  localStorage.setItem(AUTOFILL_KEY, JSON.stringify(settings));
}

export async function localCreateBackup(): Promise<{ passwordCount: number; blob: Blob; filename: string }> {
  const passwords = await localGetPasswords();
  const backup = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    passwords,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const filename = `securepass-backup-${new Date().toISOString().split("T")[0]}.json`;
  return { passwordCount: passwords.length, blob, filename };
}

export async function localRestoreBackup(file: File): Promise<{ importedCount: number; duplicateCount: number }> {
  if (!_currentKey || !_currentUserId) throw new Error("Not authenticated.");
  const text = await file.text();
  let data: { passwords?: PasswordEntry[] };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid backup file — not valid JSON.");
  }
  if (!Array.isArray(data.passwords)) {
    throw new Error("Invalid backup format. Expected a SecurePass backup file.");
  }

  const existing = await localGetPasswords();
  const existingKeys = new Set(existing.map(p => `${p.site}::${p.username}`));

  let importedCount = 0;
  let duplicateCount = 0;

  for (const entry of data.passwords) {
    const key = `${entry.site}::${entry.username}`;
    if (existingKeys.has(key)) {
      duplicateCount++;
    } else {
      await localAddPassword({ site: entry.site, username: entry.username, password: entry.password, category: entry.category });
      importedCount++;
    }
  }

  return { importedCount, duplicateCount };
}
