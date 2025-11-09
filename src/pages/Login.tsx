import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Loader2, AlertTriangle } from 'lucide-react';

// CORREÇÃO: A usar caminhos relativos (../) em vez de aliases (@/)
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../components/Auth'; // 1. Importa o nosso hook de autenticação

// URL Base da API (deve ser o mesmo do kiosk e dashboard)
const API_URL = "http://127.0.0.1:8000";

// Interface para os dados de login (corresponde ao OAuth2PasswordRequestForm)
// O FastAPI espera 'username' e 'password' num formulário
interface LoginData {
  username: string;
  password: string;
}

const Login: React.FC = () => {
  const [username, setUsername] = useState(''); // O email será o username
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const auth = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // O FastAPI com OAuth2PasswordRequestForm espera dados de formulário,
    // não JSON.
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await fetch(`${API_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        // Tenta ler a mensagem de erro do FastAPI (ex: "Utilizador ou senha incorretos")
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Falha no login. Verifique as suas credenciais.');
      }

      const data = await response.json();
      
      // Usa a função login do AuthContext para guardar o token
      // CORREÇÃO: A função auth.login() não retorna um valor (é void).
      // Removemos o 'if/else' e apenas chamamos a função,
      // pois o 'catch' já trataria qualquer falha no fetch.
      auth.login(data.access_token);
        
      // Redireciona para o dashboard SÓ DEPOIS do login ser bem-sucedido
      navigate('/dashboard');

    } catch (err: any) {
      setError(err.message || 'Não foi possível ligar ao servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-card p-8 md:p-12 rounded-2xl shadow-xl border border-border">
          {/* Cabeçalho */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Activity className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                HealthTech
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Acesso ao Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Insira as suas credenciais de médico/admin.
            </p>
          </div>

          {/* Formulário de Login */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Email (Utilizador)</Label>
              <Input
                id="username"
                type="email"
                placeholder="medico@hospital.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 text-base"
              />
            </div>

            {/* Mensagem de Erro */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive font-medium">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div>
              <Button
                type="submit"
                className="w-full text-lg h-12 gap-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Entrar'
                )}
              </Button>
            </div>
          </form>

          {/* --- Link para a página de Registo --- */}
          <div className="text-center mt-6">
            <Button variant="ghost" asChild>
              <Link to="/register" className="text-sm text-muted-foreground hover:text-primary">
                Ainda não tem conta? Crie uma agora
              </Link>
            </Button>
          </div>
          {/* --- Fim da Adição --- */}

        </div>
      </motion.div>
    </div>
  );
};

export default Login;