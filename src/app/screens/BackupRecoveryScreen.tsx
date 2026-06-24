import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Download,
  Upload,
  Shield,
  AlertCircle,
  CheckCircle2,
  Loader
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { apiRequest } from "../lib/api";

type BackupData = {
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

export function BackupRecoveryScreen() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"backup" | "restore">("backup");
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<BackupData | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [restoreResult, setRestoreResult] = useState<{
    restoredCount: number;
    importedCount: number;
    duplicateCount: number;
  } | null>(null);

  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
        setErrorMessage("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  const handleCreateBackup = async () => {
    if (creating) return;

    setCreating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await apiRequest<{
        success: boolean;
        backup: BackupData;
      }>("/api/backup/create", {
        method: "POST",
        body: JSON.stringify({})
      });

      if (response.success && response.backup) {

        const backupJson = JSON.stringify(response.backup, null, 2);
        const blob = new Blob([backupJson], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `password-backup-${response.backup.backupId.slice(0, 8)}-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setSuccessMessage(`✅ Backup created successfully! (${response.backup.passwordCount} passwords)`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Session expired")) {
        navigate("/");
        return;
      }
      setErrorMessage(`❌ Backup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const fileContent = await file.text();
      const backupData: BackupData = JSON.parse(fileContent);

      if (!backupData.backupId || !backupData.encryptedData || !backupData.checksum) {
        throw new Error("Invalid backup file format");
      }

      setPendingRestoreFile(backupData);
      setShowConfirmRestore(true);
    } catch (error) {
      setErrorMessage(
        `❌ Failed to read backup file: ${error instanceof Error ? error.message : "Invalid JSON format"}`
      );
    }

    event.target.value = "";
  };

  const confirmRestore = async () => {
    if (!pendingRestoreFile || restoring) return;

    setRestoring(true);
    setErrorMessage("");
    setSuccessMessage("");
    setShowConfirmRestore(false);

    try {
      const response = await apiRequest<{
        success: boolean;
        restoredCount: number;
        importedCount: number;
        duplicateCount: number;
      }>("/api/backup/restore", {
        method: "POST",
        body: JSON.stringify({
          encryptedData: pendingRestoreFile.encryptedData,
          checksum: pendingRestoreFile.checksum
        })
      });

      if (response.success) {
        setRestoreResult({
          restoredCount: response.restoredCount,
          importedCount: response.importedCount,
          duplicateCount: response.duplicateCount
        });
        setSuccessMessage(
          `✅ Backup restored! Imported ${response.importedCount} new passwords (${response.duplicateCount} duplicates skipped)`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Session expired")) {
        navigate("/");
        return;
      }
      setErrorMessage(`❌ Restore failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setRestoring(false);
      setPendingRestoreFile(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/settings")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Backup & Recovery</h1>
              <p className="text-gray-600 mt-1">Securely backup and restore your passwords</p>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {}
        {successMessage && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
          </Alert>
        )}

        {errorMessage && (
          <Alert className="mb-6 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {}
        <Alert className="mb-8">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Backups are encrypted with your master password. You'll need your master password to
            restore them. Keep your backup files in a safe location.
          </AlertDescription>
        </Alert>

        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab("backup")}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "backup"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Create Backup
          </button>
          <button
            onClick={() => setActiveTab("restore")}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "restore"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Restore Backup
          </button>
        </div>

        {/* Backup Tab */}
        {activeTab === "backup" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Create a Backup
              </CardTitle>
              <CardDescription>
                Download an encrypted backup of all your saved passwords
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li>✓ All passwords are encrypted with your master password</li>
                  <li>✓ Backup includes metadata (names, usernames, URLs)</li>
                  <li>✓ Checksum validation ensures file integrity</li>
                  <li>✓ File is safe to store anywhere (cloud, USB, etc.)</li>
                </ul>
              </div>

              <Button
                onClick={handleCreateBackup}
                disabled={creating}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
              >
                {creating ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Creating Backup...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Create & Download Backup
                  </>
                )}
              </Button>

              <div className="text-sm text-gray-600">
                <p className="font-medium mb-2">Tips:</p>
                <ul className="space-y-1">
                  <li>• Create regular backups (weekly recommended)</li>
                  <li>• Store backups in multiple secure locations</li>
                  <li>• Test restore functionality periodically</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Restore Tab */}
        {activeTab === "restore" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Restore from Backup
              </CardTitle>
              <CardDescription>
                Upload a previously created backup file to restore your passwords
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                <h3 className="font-semibold text-amber-900 mb-2">Before restoring:</h3>
                <ul className="space-y-2 text-sm text-amber-800">
                  <li>✓ Ensure you're using the same master password</li>
                  <li>✓ Duplicate passwords will be skipped automatically</li>
                  <li>✓ Existing passwords will not be deleted</li>
                  <li>✓ Restore is additive (merges with existing data)</li>
                </ul>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFileSelect}
                  disabled={restoring}
                  className="hidden"
                  id="backup-file-input"
                />
                <label
                  htmlFor="backup-file-input"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-8 h-8 text-gray-400" />
                  <span className="text-gray-700 font-medium">
                    {restoring ? "Restoring..." : "Click to select backup file"}
                  </span>
                  <span className="text-sm text-gray-500">(JSON format)</span>
                </label>
              </div>

              {restoreResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-green-900 mb-2">Restore completed!</h3>
                      <ul className="space-y-1 text-sm text-green-800">
                        <li>📊 Total passwords in backup: {restoreResult.restoredCount}</li>
                        <li>✅ New passwords imported: {restoreResult.importedCount}</li>
                        <li>⚠️ Duplicates skipped: {restoreResult.duplicateCount}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {}
        <Dialog open={showConfirmRestore} onOpenChange={setShowConfirmRestore}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Restore</DialogTitle>
              <DialogDescription>
                You're about to restore {pendingRestoreFile?.passwordCount} passwords from a backup
                created on {pendingRestoreFile?.createdAt && new Date(pendingRestoreFile.createdAt).toLocaleDateString()}
                .
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-800">
                ℹ️ New passwords will be added. Duplicates will be automatically skipped.
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowConfirmRestore(false);
                    setPendingRestoreFile(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmRestore}
                  disabled={restoring}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {restoring ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Restoring...
                    </>
                  ) : (
                    "Confirm & Restore"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
