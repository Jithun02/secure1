import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Lock, Fingerprint, Shield, Clock, Moon, Download, Trash2, ChevronRight, HardDrive, BarChart3, Zap } from "lucide-react";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { apiRequest } from "../lib/api";
import {
  applyDarkMode,
  clearAuthSession,
  getAuthSession,
  getUserSettings,
  saveUserSettings,
  type UserSettings,
} from "../lib/session";
import { disableBiometricOnServer, enrollBiometric } from "../lib/biometric";

export function SettingsScreen() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<UserSettings>(getUserSettings());
  const isDark = settings.darkMode;

  useEffect(() => {
    applyDarkMode(settings.darkMode);
  }, [settings.darkMode]);

  useEffect(() => {
    const syncSettings = async () => {
      const auth = getAuthSession();
      if (!auth?.token) return;

      try {
        const response = await apiRequest<{ settings: UserSettings }>("/api/settings");
        setSettings(response.settings);
        saveUserSettings(response.settings);
      } catch {

      }
    };

    syncSettings();
  }, []);

  const persistSettings = async (nextSettings: UserSettings) => {
    setSettings(nextSettings);
    saveUserSettings(nextSettings);

    const auth = getAuthSession();
    if (!auth?.token) return;

    await apiRequest<{ settings: UserSettings }>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(nextSettings),
    });
  };

  const handleChangeMasterPassword = async () => {
    const auth = getAuthSession();
    const currentPassword = window.prompt("Enter current master password:");
    if (!currentPassword) return;

    const newPassword = window.prompt("Enter new master password (min 8 chars):");
    if (!newPassword || newPassword.length < 8) {
      alert("New password must be at least 8 characters.");
      return;
    }

    if (!auth?.token) {
      alert("Login required to change master password.");
      return;
    }

    try {
      await apiRequest<{ success: boolean }>("/api/auth/change-master", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      alert("Master password changed successfully.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to change master password");
    }
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        const auth = getAuthSession();
        if (!auth?.user?.email) {
          alert("Login required before enabling biometric authentication.");
          return;
        }

        await enrollBiometric(auth.user.email, auth.user.username);
      } else {
        const auth = getAuthSession();
        if (auth?.token) {
          await disableBiometricOnServer(auth.token);
        }
      }

      await persistSettings({ ...settings, biometricEnabled: enabled });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update biometric setting");
    }
  };

  const handleTwoFactorToggle = async (enabled: boolean) => {
    try {
      const auth = getAuthSession();

      if (!auth?.token) {
        await persistSettings({ ...settings, twoFactorEnabled: enabled });
        return;
      }

      if (!enabled) {
        await persistSettings({ ...settings, twoFactorEnabled: false });
        return;
      }

      const request = await apiRequest<{ code: string; expiresInSeconds: number }>(
        "/api/settings/2fa/request",
        { method: "POST" }
      );

      const entered = window.prompt(
        `Enter the 2FA verification code: ${request.code} (valid for ${request.expiresInSeconds} seconds)`
      );

      if (!entered) {
        return;
      }

      const verified = await apiRequest<{ settings: UserSettings }>("/api/settings/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ code: entered }),
      });

      setSettings(verified.settings);
      saveUserSettings(verified.settings);
      alert("Two-factor authentication enabled.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update 2FA setting");
    }
  };

  const handleAutoLogoutChange = async () => {
    const options = [5, 15, 30, 60];
    const currentIndex = options.indexOf(settings.autoLogoutMinutes);
    const nextIndex = (currentIndex + 1) % options.length;

    try {
      await persistSettings({ ...settings, autoLogoutMinutes: options[nextIndex] });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update auto logout");
    }
  };

  const handleDarkModeToggle = async (enabled: boolean) => {
    try {
      await persistSettings({ ...settings, darkMode: enabled });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update dark mode");
    }
  };

  const handleExportBackup = async () => {
    try {
      const auth = getAuthSession();
      let data: unknown;

      if (auth?.token) {
        const response = await apiRequest<{ data: unknown }>("/api/data/export");
        data = response.data;
      } else {
        data = {
          exportedAt: new Date().toISOString(),
          settings,
          message: "No authenticated account session. Export includes local settings only.",
        };
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `securepass-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to export backup");
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      return;
    }

    try {
      const auth = getAuthSession();
      if (auth?.token) {
        await apiRequest<{ success: boolean }>("/api/account", { method: "DELETE" });
      }

      clearAuthSession();
      saveUserSettings({
        biometricEnabled: false,
        twoFactorEnabled: false,
        darkMode: false,
        autoLogoutMinutes: 15,
      });
      applyDarkMode(false);
      alert("Account deleted.");
      navigate("/");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to delete account");
    }
  };

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? "bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 [&_.bg-white]:!bg-slate-800 [&_.text-gray-900]:!text-slate-100 [&_.text-gray-700]:!text-slate-200 [&_.text-gray-600]:!text-slate-300 [&_.text-gray-500]:!text-slate-400 [&_.text-gray-400]:!text-slate-500 [&_.bg-gray-50]:!bg-slate-700/40 [&_.bg-gray-100]:!bg-slate-700 [&_.border-gray-100]:!border-slate-700 [&_.border-red-200]:!border-red-500/40"
          : "bg-gradient-to-br from-blue-50 to-white"
      }`}
    >
      {}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {}
            <button
              onClick={handleChangeMasterPassword}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Lock className="w-5 h-5 text-blue-600" />
                </div>
                <span className="font-medium text-gray-900">Change Master Password</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            {}
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Fingerprint className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Biometric Login</p>
                  <p className="text-sm text-gray-500">Fingerprint & Face ID</p>
                </div>
              </div>
              <Switch
                checked={settings.biometricEnabled}
                onCheckedChange={handleBiometricToggle}
              />
            </div>

            {}
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                  <p className="text-sm text-gray-500">Extra security layer</p>
                </div>
              </div>
              <Switch
                checked={settings.twoFactorEnabled}
                onCheckedChange={handleTwoFactorToggle}
              />
            </div>

            {}
            <button
              onClick={handleAutoLogoutChange}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Auto Logout Timer</p>
                  <p className="text-sm text-gray-500">After {settings.autoLogoutMinutes} minutes of inactivity</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-gray-600 to-gray-700">
            <h2 className="font-semibold text-white">Preferences</h2>
          </div>

          <div className="divide-y divide-gray-100">
            {}
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Moon className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Dark Mode</p>
                  <p className="text-sm text-gray-500">Easier on the eyes</p>
                </div>
              </div>
              <Switch
                checked={settings.darkMode}
                onCheckedChange={handleDarkModeToggle}
              />
            </div>
          </div>
        </div>

        {}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-teal-500 to-teal-600">
            <h2 className="font-semibold text-white">Data Management</h2>
          </div>

          <div className="divide-y divide-gray-100">
            {}
            <button
              onClick={() => navigate("/audit")}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Account Health & Audit</p>
                  <p className="text-sm text-gray-500">View vault statistics and security status</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            {}
            <button
              onClick={() => navigate("/backup")}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Backup & Recovery</p>
                  <p className="text-sm text-gray-500">Create and restore backups</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

              {}
              <button
                onClick={() => navigate("/autofill-settings")}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Zap className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Autofill Settings</p>
                    <p className="text-sm text-gray-500">Configure secure autofill for login pages</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

            {}
            <button
              onClick={handleExportBackup}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                  <Download className="w-5 h-5 text-teal-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Export Encrypted Backup</p>
                  <p className="text-sm text-gray-500">Save your passwords securely</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden border-2 border-red-200">
          <div className="px-6 py-4 bg-gradient-to-r from-red-500 to-red-600">
            <h2 className="font-semibold text-white">Danger Zone</h2>
          </div>

          <div className="p-6">
            <Button
              onClick={handleDeleteAccount}
              className="w-full h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Delete Account
            </Button>
            <p className="text-xs text-center text-gray-500 mt-3">
              This will permanently delete all your data
            </p>
          </div>
        </div>

        {}
        <div className="text-center py-6">
          <p className="text-sm text-gray-500">SecurePass v1.0.0</p>
          <p className="text-xs text-gray-400 mt-1">© 2026 SecurePass. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
