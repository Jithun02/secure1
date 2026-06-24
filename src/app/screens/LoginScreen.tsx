import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Shield, Eye, EyeOff, Fingerprint, Scan } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { apiRequest } from "../lib/api";
import { getUserSettings, markActivity, setAuthSession } from "../lib/session";
import { completeBiometricTwoFactorLogin, verifyBiometricLogin } from "../lib/biometric";

export function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiRequest<{
        token: string;
        user: { id: string; username: string; email: string };
      }>("/api/auth/login", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ email, masterPassword }),
      });

      setAuthSession({ token: response.token, user: response.user });
      markActivity();
      navigate("/dashboard");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    const settings = getUserSettings();
    const targetEmail = email;

    if (!settings.biometricEnabled) {
      alert("Enable biometric login from Settings first.");
      return;
    }

    if (!targetEmail) {
      alert("Enter your email first to use biometric login.");
      return;
    }

    try {
      const loginResponse = await verifyBiometricLogin(targetEmail);

      if (loginResponse.requiresTwoFactor) {
        const enteredCode = window.prompt(
          `Enter 2FA code: ${loginResponse.code} (valid ${loginResponse.expiresInSeconds}s)`
        );

        if (!enteredCode) {
          return;
        }

        const twoFactorResult = await completeBiometricTwoFactorLogin(
          loginResponse.pendingLoginToken,
          enteredCode
        );

        setAuthSession({ token: twoFactorResult.token, user: twoFactorResult.user });
      } else {
        setAuthSession({ token: loginResponse.token, user: loginResponse.user });
      }

      markActivity();
      navigate("/dashboard");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Biometric verification failed");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl shadow-lg mb-4">
            <Shield className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SecurePass</h1>
          <p className="text-gray-600">Your passwords, protected</p>
        </div>

        {}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            {}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Master Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter master password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="h-12 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>

          {}
          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-4 text-sm text-gray-500">OR</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {}
          <div className="space-y-3">
            <p className="text-sm text-center text-gray-600 mb-3">
              Login with biometrics
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleBiometricLogin}
                className="flex-1 h-14 bg-blue-50 hover:bg-blue-100 rounded-xl flex items-center justify-center gap-2 transition-colors group"
              >
                <Fingerprint className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-blue-600">Fingerprint</span>
              </button>
              <button
                onClick={handleBiometricLogin}
                className="flex-1 h-14 bg-blue-50 hover:bg-blue-100 rounded-xl flex items-center justify-center gap-2 transition-colors group"
              >
                <Scan className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-blue-600">Face ID</span>
              </button>
            </div>
          </div>

          {}
          <div className="text-center mt-6">
            <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Forgot Password?
            </a>
          </div>
        </div>

        {}
        <div className="text-center mt-6">
          <p className="text-gray-600">
            Don't have an account?{" "}
            <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-semibold">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
