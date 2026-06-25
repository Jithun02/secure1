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
  Wifi,
  Eye,
  EyeOff
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Alert, AlertDescription } from "../components/ui/alert";
import { getAutofillSettings, saveAutofillSettings } from "../lib/localApi";

type AutofillSettings = {
  autofillEnabled: boolean;
  httpsOnly: boolean;
  matchOnUrl: boolean;
  matchOnName: boolean;
};

export function AutofillSettingsScreen() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AutofillSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        setError("");
        const response = getAutofillSettings();
        setSettings(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    };

    void fetchSettings();
  }, []);

  const updateSetting = async (key: keyof AutofillSettings, value: boolean) => {
    if (!settings) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const newSettings = { ...settings, [key]: value };
      saveAutofillSettings(newSettings);
      setSettings(newSettings);
      setSuccess("✓ Setting updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update setting");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading autofill settings...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">Failed to load autofill settings</AlertDescription>
        </Alert>
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
              <h1 className="text-3xl font-bold text-gray-900">Autofill Settings</h1>
              <p className="text-gray-600 mt-1">Configure how SecurePass autofill works</p>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {success && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="mb-6 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {}
        <Alert className="mb-8">
          <Zap className="h-4 w-4" />
          <AlertDescription>
            The SecurePass browser extension automatically fills your login credentials on websites and apps. All data is encrypted end-to-end.
          </AlertDescription>
        </Alert>

        {}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Autofill Control
            </CardTitle>
            <CardDescription>Enable or disable autofill functionality</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Wifi className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Enable Autofill</p>
                  <p className="text-sm text-gray-600">Allow secure autofill on login pages</p>
                </div>
              </div>
              <Switch
                checked={settings.autofillEnabled}
                onCheckedChange={(value) => updateSetting("autofillEnabled", value)}
                disabled={saving}
              />
            </div>
          </CardContent>
        </Card>

        {}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-green-600" />
              Security Features
            </CardTitle>
            <CardDescription>Encryption and safety validation settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">HTTPS Only</p>
                  <p className="text-sm text-gray-600">Autofill only on secure pages (recommended)</p>
                </div>
              </div>
              <div className="text-green-600 font-semibold">✓ Always On</div>
            </div>

            {}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Match on URL</p>
                  <p className="text-sm text-gray-600">Match stored URL with current website</p>
                </div>
              </div>
              <Switch
                checked={settings.matchOnUrl}
                disabled={true}
                className="opacity-75"
              />
            </div>

            {}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <EyeOff className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium text-gray-900">Match on Name</p>
                  <p className="text-sm text-gray-600">Fallback to name matching if URL doesn't match</p>
                </div>
              </div>
              <Switch
                checked={settings.matchOnName}
                disabled={true}
                className="opacity-75"
              />
            </div>
          </CardContent>
        </Card>

        {/* Encryption Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Encryption & Privacy
            </CardTitle>
            <CardDescription>How your credentials are protected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="font-semibold text-purple-900 mb-3">🔐 Encryption Pipeline</h3>
                <ul className="space-y-2 text-sm text-purple-800">
                  <li>✓ <strong>AES-256-GCM</strong> - Military-grade encryption</li>
                  <li>✓ <strong>Session Keys</strong> - Unique key per tab</li>
                  <li>✓ <strong>HTTPS Only</strong> - Secure transport</li>
                  <li>✓ <strong>Origin Verification</strong> - Prevents credential leaks</li>
                  <li>✓ <strong>No Local Storage</strong> - Credentials never cached</li>
                </ul>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-3">✓ Security Measures</h3>
                <ul className="space-y-2 text-sm text-green-800">
                  <li>✓ Authentication required (session token)</li>
                  <li>✓ User ownership verified</li>
                  <li>✓ Hostname-based matching</li>
                  <li>✓ Security logging for audit</li>
                  <li>✓ Auto-cleanup after 1 hour</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How Autofill Works</CardTitle>
            <CardDescription>Step-by-step process of secure credential delivery</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-bold">1</div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Extension Detects Form</h4>
                  <p className="text-sm text-gray-600">Browser extension scans page for login fields</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-bold">2</div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">You Click Autofill</h4>
                  <p className="text-sm text-gray-600">Click button or press Cmd/Ctrl + Shift + L</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-bold">3</div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Encrypted Request Sent</h4>
                  <p className="text-sm text-gray-600">AES-256-GCM encrypted credential request</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-bold">4</div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Credentials Matched</h4>
                  <p className="text-sm text-gray-600">Backend finds matching stored credentials</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-bold">5</div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Form Automatically Filled</h4>
                  <p className="text-sm text-gray-600">Username and password fields populated securely</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <div className="mt-8 p-6 bg-blue-50 border-l-4 border-blue-600 rounded">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Installation & Usage</h3>
          <ol className="space-y-2 text-sm text-blue-800">
            <li>1. Install SecurePass Browser Extension (Chrome/Firefox)</li>
            <li>2. Login with your SecurePass account</li>
            <li>3. Visit any login page with saved credentials</li>
            <li>4. Click the 🔐 button or press Cmd/Ctrl + Shift + L</li>
            <li>5. Credentials automatically fill and you're logged in!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
