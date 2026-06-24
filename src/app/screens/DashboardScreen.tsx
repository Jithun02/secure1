import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import {
  Shield, Plus, Search, LogOut, Settings, Key,
  Eye, EyeOff, Copy, Trash2, BarChart2, RefreshCw, Lock,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { apiRequest } from "../lib/api";
import { clearAuthSession, getAuthSession, markActivity } from "../lib/session";

type PasswordEntry = {
  id: string;
  site: string;
  username: string;
  password: string;
  category?: string;
  createdAt?: string;
};

export function DashboardScreen() {
  const navigate = useNavigate();
  const auth = getAuthSession();
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!auth) { navigate("/"); return; }
    fetchPasswords();
  }, []);

  async function fetchPasswords() {
    try {
      const data = await apiRequest<PasswordEntry[]>("/api/passwords");
      setPasswords(data);
    } catch {
      setPasswords([]);
    } finally {
      setLoading(false);
    }
    markActivity();
  }

  function handleLogout() {
    clearAuthSession();
    navigate("/");
  }

  function toggleVisibility(id: string) {
    setVisibleIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this password?")) return;
    try {
      await apiRequest(`/api/passwords/${id}`, { method: "DELETE" });
      setPasswords(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
  }

  const filtered = passwords.filter(
    p =>
      p.site.toLowerCase().includes(search.toLowerCase()) ||
      p.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">SecurePass</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link to="/generator">
              <Button variant="ghost" size="sm" className="gap-2 text-gray-600">
                <RefreshCw className="w-4 h-4" />
                Generator
              </Button>
            </Link>
            <Link to="/audit">
              <Button variant="ghost" size="sm" className="gap-2 text-gray-600">
                <BarChart2 className="w-4 h-4" />
                Audit
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost" size="sm" className="gap-2 text-gray-600">
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </Link>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {auth?.user.username ?? "User"}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {passwords.length} password{passwords.length !== 1 ? "s" : ""} stored
            </p>
          </div>
          <Link to="/add-password">
            <Button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg gap-2 rounded-xl">
              <Plus className="w-4 h-4" />
              Add Password
            </Button>
          </Link>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by site or username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl border-gray-200 focus:border-blue-400 bg-white shadow-sm"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {search ? "No results found." : "No passwords yet. Add your first one!"}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(entry => (
              <div
                key={entry.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center shrink-0">
                      <Key className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{entry.site}</p>
                      <p className="text-sm text-gray-500 truncate">{entry.username}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-sm text-gray-700">
                          {visibleIds.has(entry.id) ? entry.password : "••••••••••••"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleVisibility(entry.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {visibleIds.has(entry.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleCopy(entry.password)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <Link to={`/password/${entry.id}`}>
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <Settings className="w-4 h-4" />
                      </button>
                    </Link>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
