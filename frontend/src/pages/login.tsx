import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { setupDevMode } from "@/lib/dev-setup";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = (userKey: "chef" | "owner" | "admin") => {
    if (setupDevMode(userKey)) {
      // Reload to apply dev mode
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full space-y-6 md:space-y-8 p-6 md:p-8 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900">FreshFlow</h2>
          <p className="mt-3 text-center text-base md:text-sm text-gray-600">
            Pedidos B2B de Hortifruti
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-base font-medium text-gray-700 mb-2">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base"
                placeholder="chef@chefstable.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-base font-medium text-gray-700 mb-2">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-4 px-6 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {import.meta.env.PROD && (
            <div className="text-sm text-center text-gray-600 pt-2">
              <p className="font-medium">Credenciais de teste:</p>
              <p className="font-mono text-xs mt-1">chef@chefstable.com</p>
            </div>
          )}
        </form>

        {/* Login rápido modo desenvolvimento */}
        {import.meta.env.DEV && (
          <div className="border-t border-gray-200 pt-6">
            <p className="text-sm font-medium text-gray-700 mb-3 text-center">
              🔧 Modo Desenvolvimento - Login Rápido
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleDevLogin("chef")}
                className="w-full py-3 px-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                Entrar como Chef (ACCOUNT_OWNER)
              </button>
              <button
                onClick={() => handleDevLogin("owner")}
                className="w-full py-3 px-4 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors text-sm font-medium"
              >
                Entrar como Dono do Tenant (TENANT_OWNER)
              </button>
              <button
                onClick={() => handleDevLogin("admin")}
                className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                Entrar como Admin da Plataforma
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Senha não necessária no modo desenvolvimento
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
