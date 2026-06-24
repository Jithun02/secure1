import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Copy, RefreshCw, Check, Zap } from "lucide-react";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";

export function PasswordGeneratorScreen() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [length, setLength] = useState([16]);
  const [options, setOptions] = useState({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });

  const generatePassword = () => {
    let chars = "";
    let generatedPassword = "";

    if (options.uppercase) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (options.lowercase) chars += "abcdefghijklmnopqrstuvwxyz";
    if (options.numbers) chars += "0123456789";
    if (options.symbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";

    if (chars === "") {
      setPassword("");
      return;
    }

    for (let i = 0; i < length[0]; i++) {
      generatedPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    setPassword(generatedPassword);
    setCopied(false);
  };

  useEffect(() => {
    generatePassword();
  }, [length, options]);

  const copyToClipboard = () => {
    if (password) {
      navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getPasswordStrength = () => {
    let strength = 0;
    const pwd = password;

    if (!pwd) return 0;

    if (pwd.length >= 8) strength += 20;
    if (pwd.length >= 12) strength += 20;
    if (pwd.length >= 16) strength += 10;
    if (/[a-z]/.test(pwd)) strength += 15;
    if (/[A-Z]/.test(pwd)) strength += 15;
    if (/[0-9]/.test(pwd)) strength += 10;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength += 10;

    return Math.min(strength, 100);
  };

  const passwordStrength = getPasswordStrength();

  const getStrengthColor = () => {
    if (passwordStrength < 40) return "bg-red-500";
    if (passwordStrength < 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthText = () => {
    if (passwordStrength < 40) return "Weak";
    if (passwordStrength < 70) return "Medium";
    return "Strong";
  };

  const getStrengthTextColor = () => {
    if (passwordStrength < 40) return "text-red-600";
    if (passwordStrength < 70) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Password Generator</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Zap className="w-6 h-6 text-yellow-300" />
              <h2 className="text-xl font-semibold text-white">Generated Password</h2>
            </div>

            {}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4">
              <p className="text-white text-center font-mono text-lg break-all select-all">
                {password || "Configure options below"}
              </p>
            </div>

            {}
            <div className="flex gap-3">
              <Button
                onClick={generatePassword}
                className="flex-1 h-12 bg-white hover:bg-gray-100 text-blue-600 rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Regenerate
              </Button>
              <Button
                onClick={copyToClipboard}
                className="flex-1 h-12 bg-white hover:bg-gray-100 text-blue-600 rounded-xl font-medium flex items-center justify-center gap-2"
                disabled={!password}
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {}
          {password && (
            <div className="p-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Password Strength</span>
                <span className={`text-sm font-bold ${getStrengthTextColor()}`}>
                  {getStrengthText()}
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                  style={{ width: `${passwordStrength}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {}
        <div className="bg-white rounded-3xl shadow-xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Customize Password</h3>

          {}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-gray-700">
                Password Length
              </label>
              <span className="text-lg font-bold text-blue-600 bg-blue-50 px-4 py-1 rounded-lg">
                {length[0]}
              </span>
            </div>
            <Slider
              value={length}
              onValueChange={setLength}
              min={4}
              max={32}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>4</span>
              <span>32</span>
            </div>
          </div>

          {}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">Include Characters</h4>

            {}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="font-medium text-gray-900">Uppercase Letters</p>
                <p className="text-sm text-gray-500">A B C D E F G H I J K L M...</p>
              </div>
              <Switch
                checked={options.uppercase}
                onCheckedChange={(checked) =>
                  setOptions({ ...options, uppercase: checked })
                }
              />
            </div>

            {}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="font-medium text-gray-900">Lowercase Letters</p>
                <p className="text-sm text-gray-500">a b c d e f g h i j k l m...</p>
              </div>
              <Switch
                checked={options.lowercase}
                onCheckedChange={(checked) =>
                  setOptions({ ...options, lowercase: checked })
                }
              />
            </div>

            {}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="font-medium text-gray-900">Numbers</p>
                <p className="text-sm text-gray-500">0 1 2 3 4 5 6 7 8 9</p>
              </div>
              <Switch
                checked={options.numbers}
                onCheckedChange={(checked) =>
                  setOptions({ ...options, numbers: checked })
                }
              />
            </div>

            {}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="font-medium text-gray-900">Symbols</p>
                <p className="text-sm text-gray-500">! @ # $ % ^ & * ( ) - + =</p>
              </div>
              <Switch
                checked={options.symbols}
                onCheckedChange={(checked) =>
                  setOptions({ ...options, symbols: checked })
                }
              />
            </div>
          </div>
        </div>

        {}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
          <h4 className="font-semibold text-blue-900 mb-2">💡 Security Tips</h4>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• Use at least 12 characters for better security</li>
            <li>• Include all character types for maximum strength</li>
            <li>• Never reuse passwords across different accounts</li>
            <li>• Change passwords regularly (every 3-6 months)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
