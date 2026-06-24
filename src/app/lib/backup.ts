import { apiRequest } from "./api";

export type PasswordSearchResult = {
  id: string;
  name: string;
  username: string;
  url: string;
  icon: string;
  color: string;
  createdAt: string;
};

export type PasswordStats = {
  totalPasswords: number;
  createdThisMonth: number;
  accountAge: number;
  lastActivityAt: string;
  securityStatus: {
    masterPasswordSet: boolean;
    twoFactorEnabled: boolean;
    biometricEnabled: boolean;
    autoLogoutMinutes: number;
  };
  encryptionInfo: {
    algorithm: string;
    keyDerivation: string;
    status: string;
  };
};

export async function searchPasswords(
  query: string
): Promise<PasswordSearchResult[]> {
  try {
    const url = new URL("/api/passwords", window.location.origin);
    if (query) {
      url.searchParams.set("q", query);
    }

    const response = await apiRequest<{
      items: PasswordSearchResult[];
      totalCount: number;
      filteredCount: number;
    }>(url.toString());

    return response.items;
  } catch (error) {
    console.error("Search failed:", error);
    throw error;
  }
}

export async function getPasswordStats(): Promise<PasswordStats> {
  return apiRequest<PasswordStats>("/api/audit/stats");
}

export async function getPerformanceStatus(): Promise<{
  status: string;
  passwordCount: number;
  responseTimeMs: number;
  timestamp: string;
}> {
  return apiRequest("/api/performance/status");
}

export type BackupPayload = {
  backupId: string;
  createdAt: string;
  passwordCount: number;
  encryptedData: {
    iv: string;
    tag: string;
    cipherText: string;
  };
  checksum: string;
};

export async function createBackup(): Promise<BackupPayload> {
  const response = await apiRequest<{
    success: boolean;
    backup: BackupPayload;
  }>("/api/backup/create", {
    method: "POST",
    body: JSON.stringify({})
  });

  if (!response.success || !response.backup) {
    throw new Error("Backup creation failed");
  }

  return response.backup;
}

export async function restoreBackup(
  encryptedData: BackupPayload["encryptedData"],
  checksum: string
): Promise<{
  success: boolean;
  restoredCount: number;
  importedCount: number;
  duplicateCount: number;
}> {
  return apiRequest("/api/backup/restore", {
    method: "POST",
    body: JSON.stringify({
      encryptedData,
      checksum
    })
  });
}

export function downloadBackup(backup: BackupPayload): void {
  const backupJson = JSON.stringify(backup, null, 2);
  const blob = new Blob([backupJson], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `password-backup-${backup.backupId.slice(0, 8)}-${new Date(
    backup.createdAt
  )
    .toISOString()
    .split("T")[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function validateBackupFile(file: File): Promise<BackupPayload> {
  try {
    const fileContent = await file.text();
    const backup: BackupPayload = JSON.parse(fileContent);

    if (!backup.backupId || !backup.encryptedData || !backup.checksum) {
      throw new Error("Invalid backup file format");
    }

    if (!backup.encryptedData.iv || !backup.encryptedData.tag || !backup.encryptedData.cipherText) {
      throw new Error("Invalid encrypted data format");
    }

    return backup;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON format in backup file");
    }
    throw error;
  }
}
