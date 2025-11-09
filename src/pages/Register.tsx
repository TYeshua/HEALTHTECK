import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

// CORREÇÃO: Revertendo para os caminhos de alias (@/) que o seu projeto espera.
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// URL Base da API
const API_URL = "http://127.0.0.1:8000";

// Interface para os dados de registo (corresponde ao UserCreate no api.py)
interface RegisterData {
  username: string; // O email será o username
  password: string;
  full_name: string;
}

const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState(''); // Email
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const payload: RegisterData = {
      username: username,
      password: password,
      full_name: fullName,
    };

    try {
      const response = await fetch(`${API_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Tenta ler a mensagem de erro do FastAPI (ex: "Utilizador já existe")
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Não foi possível criar a conta.');
      }

      // Sucesso! Redireciona para o Login
      navigate('/login');

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
                HealthTriage AI
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Criar Nova Conta
            </h1>
            <p className="text-muted-foreground mt-2">
              Registe-se para aceder ao Dashboard.
            </p>
          </div>

          {/* Formulário de Registo */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Dr. Nome Apelido"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-12 text-base"
              />
            </div>
            
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
                  'Criar Conta'
                )}
              </Button>
            </div>
          </form>

          {/* Link para Login */}
          <div className="text-center mt-6">
            <Button variant="ghost" asChild>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para o Login
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;