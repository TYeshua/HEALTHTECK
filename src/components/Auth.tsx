import React, { createContext, useState, useContext, ReactNode, useMemo } from 'react';
import { Navigate } from 'react-router-dom';

// 1. Definir a Interface para o Contexto de Autenticação
interface AuthContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

// 2. Criar o Contexto
// Usamos '!' para garantir ao TypeScript que o valor será fornecido pelo Provider
const AuthContext = createContext<AuthContextType>(null!);

// 3. Criar o Provedor (Provider)
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Tenta buscar o token do localStorage ao carregar
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));

  /**
   * Função para efetuar o login. Guarda o token no estado e no localStorage.
   * @param newToken O token JWT recebido da API.
   */
  const login = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('authToken', newToken);
  };

  /**
   * Função para efetuar o logout. Remove o token do estado e do localStorage.
   */
  const logout = () => {
    setToken(null);
    localStorage.removeItem('authToken');
  };

  // Usamos useMemo para otimizar o contexto, evitando recálculos desnecessários
  const value = useMemo(
    () => ({
      token,
      login,
      logout,
      isAuthenticated: !!token, // Converte o token (string ou null) para um booleano
    }),
    [token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 4. Criar o Hook 'useAuth'
/**
 * Hook personalizado para aceder facilmente ao contexto de autenticação
 * em qualquer componente "filho" do AuthProvider.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

// 5. Criar o Componente de Rota Protegida
/**
 * Este componente verifica se o utilizador está autenticado.
 * Se estiver, renderiza os componentes "filhos" (ex: o Dashboard).
 * Se não estiver, redireciona o utilizador para a página de login.
 */
interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    // Utilizador não está logado, redireciona para /login
    return <Navigate to="/login" replace />;
  }

  // Utilizador está logado, permite o acesso
  return <>{children}</>;
};