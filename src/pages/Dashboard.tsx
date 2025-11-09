import React, { useState, useEffect, useCallback, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Zap,
  Loader2,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertTriangle,
  UserCheck,
  X,
  LogOut, // 1. NOVO: Ícone de Logout
} from "lucide-react";
import { useNavigate } from "react-router-dom"; // 2. NOVO: Para redirecionar no logout

// --- Importações de Componentes ---
// CORREÇÃO: A usar caminhos relativos (../) em vez de aliases (@/)
import { Header } from "../components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

// 3. NOVO: Importar o AuthContext (com caminho relativo)
import { useAuth } from "../components/Auth";

// --- Definição de Tipos (Espelhando o Backend api.py) ---
// ... (O restante do código permanece o mesmo) ...
// ... permanecem as mesmas da nossa versão anterior)

interface DiagnosisSuggestion {
  disease: string;
  probability: number;
}

interface PatientInQueue {
  ticket: string;
  name: string;
  priority: "VERMELHO" | "LARANJA" | "AMARELO" | "VERDE" | "AZUL";
  priority_color: string;
  priority_description: string;
  complaint: string;
  wait_time_minutes: number;
  ai_suggestions: DiagnosisSuggestion[];
  arrival_time: string;
}

interface DashboardStats {
  total_in_queue: number;
  emergency_count: number;
  avg_wait_time_minutes: number;
  last_hour_count: number;
}

interface ResolveData {
  final_diagnosis: string;
}

// Estilos dos Cards de Prioridade
const priorityStyles: {
  [key: string]: { border: string; bg: string; text: string; icon: React.ReactNode };
} = {
  VERMELHO: {
    border: "border-destructive",
    bg: "bg-destructive/10",
    text: "text-destructive",
    icon: <AlertCircle className="h-6 w-6" />,
  },
  LARANJA: {
    border: "border-warning",
    bg: "bg-warning/10",
    text: "text-warning-foreground", // Ajustado para warning-foreground
    icon: <AlertTriangle className="h-6 w-6" />,
  },
  AMARELO: {
    border: "border-yellow-500",
    bg: "bg-yellow-500/10",
    text: "text-yellow-600",
    icon: <Clock className="h-6 w-6" />,
  },
  VERDE: {
    border: "border-success",
    bg: "bg-success/10",
    text: "text-success",
    icon: <CheckCircle2 className="h-6 w-6" />,
  },
  AZUL: {
    border: "border-secondary",
    bg: "bg-secondary/10",
    text: "text-secondary-foreground",
    icon: <Users className="h-6 w-6" />,
  },
};

// URL Base da API
const API_URL = "http://127.0.0.1:8000";

// --- Componente Principal do Dashboard ---

export default function Dashboard() {
  const [patients, setPatients] = useState<PatientInQueue[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total_in_queue: 0,
    emergency_count: 0,
    avg_wait_time_minutes: 0,
    last_hour_count: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Estados do Modal de Diagnóstico ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<PatientInQueue | null>(null);
  const [finalDiagnosis, setFinalDiagnosis] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  // 4. NOVO: Obter o token e a função logout do AuthContext
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  // Função para lidar com erros de autenticação (Token expirado)
  const handleAuthError = () => {
    setError("Sessão expirada. Por favor, faça login novamente.");
    logout();
    navigate("/login");
  };

  // 5. ATUALIZADO: Função para buscar dados (agora envia o token)
  const fetchData = useCallback(async (isInitialLoad = false) => {
    if ((!isInitialLoad && isPolling) || !token) return; // Não faz nada se não houver token
    
    if (isInitialLoad) setIsLoading(true);
    else setIsPolling(true);

    // 6. NOVO: Headers de autorização
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    try {
      const [patientsResponse, statsResponse] = await Promise.all([
        fetch(`${API_URL}/patients`, { headers }), // Envia o header
        fetch(`${API_URL}/stats`, { headers }),    // Envia o header
      ]);

      // 7. NOVO: Tratamento de erro 401 (Token inválido/expirado)
      if (patientsResponse.status === 401 || statsResponse.status === 401) {
        handleAuthError();
        return;
      }

      if (!patientsResponse.ok || !statsResponse.ok) {
        throw new Error("Falha ao buscar dados do servidor. Verifique se o backend (api.py) está a rodar.");
      }

      const patientsData: PatientInQueue[] = await patientsResponse.json();
      const statsData: DashboardStats = await statsResponse.json();

      setPatients(patientsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
      setIsPolling(false);
    }
  }, [isPolling, token, logout, navigate]); // Adicionado 'token', 'logout', 'navigate'

  // Hook para buscar dados periodicamente (polling)
  useEffect(() => {
    fetchData(true); // Busca inicial
    const intervalId = setInterval(() => fetchData(false), 3000); // Atualiza a cada 3 segundos
    return () => clearInterval(intervalId);
  }, [fetchData]); // 'fetchData' já contém todas as dependências

  // --- Funções do Modal de Diagnóstico ---

  const handleOpenModal = (patient: PatientInQueue) => {
    setCurrentPatient(patient);
    setFinalDiagnosis("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentPatient(null);
  };

  // 8. ATUALIZADO: Submissão de diagnóstico (agora envia o token)
  const handleSubmitDiagnosis = async () => {
    if (!finalDiagnosis.trim()) {
      setModalError("O diagnóstico final não pode estar vazio.");
      return;
    }
    if (!currentPatient) return;
    setModalError(null);

    try {
      const response = await fetch(`${API_URL}/resolve/${currentPatient.ticket}`, {
        method: "POST",
        // 9. NOVO: Headers de autorização + Content-Type
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ final_diagnosis: finalDiagnosis } as ResolveData),
      });

      // 10. NOVO: Tratamento de erro 401
      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error("Falha ao submeter o diagnóstico. Tente novamente.");
      }

      setPatients((prevPatients) =>
        prevPatients.filter((p) => p.ticket !== currentPatient.ticket)
      );
      handleCloseModal();
      
    } catch (err) {
      if (err instanceof Error) setModalError(err.message);
    }
  };

  const formatSuggestion = (suggestion: DiagnosisSuggestion) => {
    const probabilityPercent = (suggestion.probability * 100).toFixed(0);
    return `${suggestion.disease} (${probabilityPercent}%)`;
  };

  // 11. NOVO: Função de Logout
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // O 'Header' foi removido daqui porque agora está no App.tsx
  return (
    <div className="min-h-screen bg-gradient-subtle text-foreground">
      {/* O Header é renderizado pelo App.tsx */}
      <div className="container mx-auto px-6 py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* 12. ATUALIZADO: Header da página com botão de Logout */}
          <div className="mb-8 flex flex-wrap justify-between items-start gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-foreground">Dashboard - Fila de Triagem</h1>
              <p className="text-lg text-muted-foreground">
                Monitor em tempo real dos pacientes aguardando atendimento
              </p>
            </div>
            <div className="flex gap-4 items-center">
              {isPolling && !isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Atualizando...</span>
                </div>
              )}
              <Button variant="outline" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>

          {/* Exibição de Erro da API */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <h4 className="font-bold">Erro de Conexão</h4>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Stats Cards (Dados Reais) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total na Fila
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.total_in_queue}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  +{isLoading ? '...' : stats.last_hour_count} na última hora
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Emergências (Verm./Lar.)
                </CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.emergency_count}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Atendimento imediato
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tempo Médio Espera
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${stats.avg_wait_time_minutes.toFixed(0)} min`}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Média de toda a fila
                </p>
              </CardContent>
            </Card>
            
            <Card className="shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Status da IA
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">Online</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Processando triagens
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Fila de Pacientes (Dados Reais) */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Activity className="h-5 w-5 text-primary" />
                Fila de Pacientes - Por Prioridade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <AnimatePresence>
                  {/* Estado de Carregamento Inicial */}
                  {isLoading && patients.length === 0 && !error && (
                     <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-12"
                    >
                      <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-foreground">A carregar pacientes...</h3>
                      <p className="text-muted-foreground mt-2">A ligar ao servidor de triagem.</p>
                    </motion.div>
                  )}

                  {/* Estado de Fila Vazia (Após carregar) */}
                  {!isLoading && patients.length === 0 && !error && (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-center py-12"
                    >
                      <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-foreground">Fila de espera vazia</h3>
                      <p className="text-muted-foreground mt-2">Nenhum paciente aguardando atendimento no momento.</p>
                    </motion.div>
                  )}

                  {/* Lista de Pacientes */}
                  {patients.length > 0 &&
                    patients.map((patient, index) => {
                      const style =
                        priorityStyles[patient.priority] || priorityStyles.AZUL;
                      return (
                        <motion.div
                          key={patient.ticket}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className={`flex flex-col md:flex-row items-start md:items-center gap-4 p-5 rounded-xl border-l-4 ${style.border} ${style.bg} hover:shadow-md transition-shadow`}
                        >
                          {/* Coluna 1: Prioridade e Nome */}
                          <div className="flex-1 min-w-0">
                            <Badge
                              className={`font-bold px-3 py-1 text-sm ${style.text} ${style.border} ${style.bg.replace('/10', '/20')}`}
                            >
                              {patient.priority_description}
                            </Badge>
                            <h4 className="text-xl font-semibold text-foreground mt-2 mb-1">
                              {patient.name} (Senha: {patient.ticket})
                            </h4>
                            <p className="text-sm text-muted-foreground truncate">
                              Queixa: {patient.complaint}
                            </p>
                          </div>

                          {/* Coluna 2: Tempo de Espera */}
                          <div className="flex-shrink-0 w-full md:w-auto md:text-right">
                             <div className={`flex items-center gap-2 text-lg font-semibold ${style.text} mb-1`}>
                              <Clock className="h-5 w-5" />
                              {patient.wait_time_minutes} min na fila
                            </div>
                          </div>
                          
                          {/* Coluna 3: Sugestão da IA */}
                          <div className="flex-shrink-0 w-full md:w-auto md:text-right">
                            <div className="flex items-center gap-2 text-warning-foreground">
                              <Zap className="h-4 w-4" />
                              <span className="text-sm font-medium">Sugestão IA:</span>
                            </div>
                            <ul className="text-sm text-muted-foreground">
                              {patient.ai_suggestions.length > 0 ? (
                                patient.ai_suggestions.map((sug, i) => (
                                  <li key={i}>{formatSuggestion(sug)}</li>
                                ))
                              ) : (
                                <li>N/D</li>
                              )}
                            </ul>
                          </div>

                          {/* Coluna 4: Botão de Ação (Abre o Modal) */}
                          <div className="flex-shrink-0 w-full md:w-auto mt-2 md:mt-0">
                            <Button 
                              variant="default" 
                              className="w-full md:w-auto"
                              onClick={() => handleOpenModal(patient)} // Abre o modal
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Atender e Registrar
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* --- MODAL DE DIAGNÓSTICO FINAL --- */}
      <AnimatePresence>
        {isModalOpen && currentPatient && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={handleCloseModal} // Fecha ao clicar fora
          >
            <motion.div
              key="modal-content"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-card w-full max-w-lg rounded-2xl shadow-xl p-8 border border-border"
              onClick={(e) => e.stopPropagation()} // Impede de fechar ao clicar dentro
            >
              {/* Cabeçalho do Modal */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-foreground">
                    Atender Paciente
                  </h3>
                  <p className="text-muted-foreground">
                    {currentPatient.name} (Ticket: {currentPatient.ticket})
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleCloseModal}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Formulário de Diagnóstico */}
              <div className="space-y-6">
                {/* Erro do Modal */}
                {modalError && (
                  <p className="text-sm text-destructive font-medium">
                    {modalError}
                  </p>
                )}
                
                {/* Campo de Input */}
                <div>
                  <Label htmlFor="diagnosis" className="text-base font-medium">
                    Diagnóstico Final (para treino da IA)
                  </Label>
                  <Input
                    id="diagnosis"
                    value={finalDiagnosis}
                    onChange={(e) => setFinalDiagnosis(e.target.value)}
                    placeholder="Ex: Apendicite, Infarto, Enxaqueca..."
                    className="mt-2 h-12 text-base"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Este dado será usado para treinar o modelo de Machine Learning.
                  </p> 
                  {/* CORREÇÃO: A tag </D> foi corrigida para </p> */}
                </div>
                
                {/* Botões de Ação */}
                <div className="flex justify-end gap-4">
                  <Button variant="outline" onClick={handleCloseModal}>
                    Cancelar
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleSubmitDiagnosis}
                  >
                    Confirmar e Remover da Fila
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}