export type AuthSession = {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
};

export type UserSettings = {
  biometricEnabled: boolean;
  twoFactorEnabled: boolean;
  darkMode: boolean;
  autoLogoutMinutes: number;
};

const AUTH_KEY = "spm_auth_session";
const SETTINGS_KEY = "spm_user_settings";
const LAST_ACTIVITY_KEY = "spm_last_activity";

export const DEFAULT_SETTINGS: UserSettings = {
  biometricEnabled: false,
  twoFactorEnabled: false,
  darkMode: false,
  autoLogoutMinutes: 15,
};

export function getAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_KEY);
}

export function getUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<UserSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveUserSettings(settings: UserSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function applyDarkMode(enabled: boolean): void {
  document.documentElement.classList.toggle("dark", enabled);
}

export function markActivity(): void {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function getLastActivity(): number {
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
  return raw ? Number(raw) || Date.now() : Date.now();
}
