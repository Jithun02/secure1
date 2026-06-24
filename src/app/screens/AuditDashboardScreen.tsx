import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Shield,
  AlertCircle,
  CheckCircle2,
  Loader,
  Lock,
  Zap,
  Calendar,
  Gauge
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription } from "../components/ui/alert";
import { getPasswordStats, getPerformanceStatus } from "../lib/backup";

type PasswordStats = {
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

type PerformanceStatus = {
  status: string;
  passwordCount: number;
  responseTimeMs: number;
  timestamp: string;
};

export function AuditDashboardScreen() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PasswordStats | null>(null);
  const [performance, setPerformance] = useState<PerformanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError("");
        const [statsData, perfData] = await Promise.all([
          getPasswordStats(),
          getPerformanceStatus()
        ]);
        setStats(statsData);
        setPerformance(perfData);
      } catch (err) {
        if (err instanceof Error && err.message.includes("Session expired")) {
          navigate("/");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading audit dashboard...</p>
        </div>
      </div>
    );
  }

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
              <h1 className="text-3xl font-bold text-gray-900">Account Health & Audit</h1>
              <p className="text-gray-600 mt-1">View your password vault statistics and security status</p>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <Alert className="mb-6 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {stats && performance && (
          <>
            {}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-blue-600" />
                    Total Passwords
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-gray-900 mb-2">
                    {stats.totalPasswords}
                  </div>
                  <p className="text-gray-600">
                    {stats.createdThisMonth} added this month
                  </p>
                </CardContent>
              </Card>

              {}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-green-600" />
                    Account Age
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-gray-900 mb-2">
                    {stats.accountAge}
                  </div>
                  <p className="text-gray-600">days since creation</p>
                </CardContent>
              </Card>

              {}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-purple-600" />
                    Response Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-gray-900 mb-2">
                    {performance.responseTimeMs}
                  </div>
                  <p className="text-gray-600">milliseconds</p>
                </CardContent>
              </Card>

              {}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-orange-600" />
                    Auto Logout
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-gray-900 mb-2">
                    {stats.securityStatus.autoLogoutMinutes}
                  </div>
                  <p className="text-gray-600">minutes of inactivity</p>
                </CardContent>
              </Card>
            </div>

            {}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Security Status
                </CardTitle>
                <CardDescription>Current security configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">Master Password</p>
                        <p className="text-sm text-gray-600">Primary authentication</p>
                      </div>
                    </div>
                    {stats.securityStatus.masterPasswordSet ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>

                  {}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                        <p className="text-sm text-gray-600">Additional security layer</p>
                      </div>
                    </div>
                    {stats.securityStatus.twoFactorEnabled ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-medium text-gray-900">Biometric Authentication</p>
                        <p className="text-sm text-gray-600">Fingerprint & Face ID</p>
                      </div>
                    </div>
                    {stats.securityStatus.biometricEnabled ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-green-600" />
                  Encryption Details
                </CardTitle>
                <CardDescription>Current encryption configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Algorithm</p>
                      <p className="font-mono font-semibold text-gray-900">
                        {stats.encryptionInfo.algorithm}
                      </p>
                    </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Key Derivation</p>
                      <p className="font-mono font-semibold text-gray-900">
                        {stats.encryptionInfo.keyDerivation}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 mb-2">✓ Encryption Status</p>
                    <ul className="space-y-1 text-sm text-blue-800">
                      <li>• All passwords are encrypted with AES-256-GCM</li>
                      <li>• Master password uses scrypt key derivation</li>
                      <li>• Each password has unique IV and authentication tag</li>
                      <li>• Encryption is applied before storage</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {}
            <div className="mt-8 p-6 bg-amber-50 border-2 border-amber-200 rounded-lg">
              <h3 className="font-semibold text-amber-900 mb-3">💡 Security Recommendations</h3>
              <ul className="space-y-2 text-sm text-amber-800">
                {!stats.securityStatus.twoFactorEnabled && (
                  <li>• Enable Two-Factor Authentication for enhanced security</li>
                )}
                {!stats.securityStatus.biometricEnabled && (
                  <li>• Consider enabling biometric authentication for convenience</li>
                )}
                {stats.totalPasswords < 5 && (
                  <li>• Start storing your important passwords to build your vault</li>
                )}
                {stats.totalPasswords > 50 && (
                  <li>• Consider organizing passwords with better naming conventions</li>
                )}
                <li>• Regularly backup your passwords in a secure location</li>
                <li>• Review and update old passwords periodically</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
