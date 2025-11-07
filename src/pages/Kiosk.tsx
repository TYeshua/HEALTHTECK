import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2, // Ícone de carregamento
  Activity, // Ícone do Header
  Zap, // Ícone da IA
  AlertTriangle, // Ícone de Erro
  Clock, // Ícone Amarelo
} from "lucide-react";

// --- Importações Reais dos Componentes UI ---
// Usando caminhos relativos para corrigir erros de compilação de alias
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";

// --- Definição de Tipos (Espelhando o Backend api.py) ---

type Step = 1 | 2 | 3 | 4 | 5; // Passo 4: Loading, Passo 5: Resultado

interface FormData {
  name: string;
  age: string;
  mainComplaint: string;
  symptoms: string;
  medicalHistory: string;
}

interface DiagnosisSuggestion {
  disease: string;
  probability: number;
}

// Interface completa da resposta da API
interface FullTriageResult {
  patient_name: string;
  classification: {
    priority: "VERMELHO" | "LARANJA" | "AMARELO" | "VERDE" | "AZUL";
    color: string;
    description: string;
    ticket: string;
    estimated_wait_time: string;
  };
  ai_suggestions: DiagnosisSuggestion[];
}

// --- Componente Principal do Quiosque ---

const Kiosk: React.FC = () => {
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState(1); // Para controlar a direção da animação
  const [isLoading, setIsLoading] = useState(false);
  const [apiResult, setApiResult] = useState<FullTriageResult | null>(null);
  const [complaintMode, setComplaintMode] = useState<"options" | "text" | null>(
    null
  );
  // Estado para guardar a mensagem de erro da API
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    age: "",
    mainComplaint: "",
    symptoms: "",
    medicalHistory: "",
  });

  // Opções de Queixa Principal
  const complaintOptions = [
    { key: "dor_peito", label: "Dor no Peito" },
    { key: "dificuldade_respirar", label: "Dificuldade para Respirar" },
    { key: "febre", label: "Febre / Calafrios" },
    { key: "ferimento_corte", label: "Ferimento / Corte" },
    { key: "dor_abdominal", label: "Dor Abdominal" },
    { key: "tontura_desmaio", label: "Tontura / Desmaio" },
    { key: "reacao_alergica", label: "Reação Alérgica" },
    { key: "outros", label: "Outros" },
  ];

  // Mapas de Cores e Ícones (cores de status não mudam com o tema)
  const resultConfig = {
    VERMELHO: {
      bgColor: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-700 dark:text-red-400",
      borderColor: "border-red-600/50",
      icon: <AlertCircle />,
    },
    LARANJA: {
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
      textColor: "text-orange-700 dark:text-orange-400",
      borderColor: "border-orange-600/50",
      icon: <AlertTriangle />, // Usando AlertTriangle para Laranja
    },
    AMARELO: {
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
      textColor: "text-yellow-700 dark:text-yellow-400",
      borderColor: "border-yellow-600/50",
      icon: <Clock />, // Ícone de Relógio
    },
    VERDE: {
      bgColor: "bg-green-50 dark:bg-green-900/20",
      textColor: "text-green-700 dark:text-green-400",
      borderColor: "border-green-600/50",
      icon: <CheckCircle2 />,
    },
    AZUL: {
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      textColor: "text-blue-700 dark:text-blue-400",
      borderColor: "border-blue-600/50",
      icon: <CheckCircle2 />,
    },
  };

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Lógica de Submissão
  const handleSubmit = async () => {
    setDirection(1);
    setStep(4); // Vai para a tela de loading
    setIsLoading(true);
    setErrorMessage(null); // Limpa erros antigos

    // --- CORREÇÃO DO PAYLOAD (Erro 422) ---
    // O backend (api.py) espera os campos:
    // name: str
    // age: str
    // mainComplaint: str
    // symptoms: str
    // medicalHistory: str
    const payload = {
      name: formData.name,
      age: formData.age, // Enviado como string
      mainComplaint: formData.mainComplaint,
      symptoms: formData.symptoms,
      medicalHistory: formData.medicalHistory,
    };

    try {
      // Onde o seu backend FastAPI está a rodar
      const API_URL = "http://127.0.0.1:8000/triage";

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorData;
        try {
          // Tenta ler o JSON de erro do FastAPI
          errorData = await response.json();
        } catch (e) {
          // Se o erro não for JSON
          throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }

        // --- CORREÇÃO DO ERRO [object Object] ---
        // Formata o erro de validação do Pydantic (422)
        if (response.status === 422 && errorData.detail) {
          const errorMessages = errorData.detail
            .map(
              (err: any) =>
                `Campo "${err.loc[1]}": ${err.msg.replace("Value error, ", "")}`
            )
            .join(", ");
          throw new Error(`Dados inválidos: ${errorMessages}`);
        } else {
          throw new Error(
            errorData.detail || "Ocorreu um erro desconhecido no servidor."
          );
        }
      }

      const result: FullTriageResult = await response.json();

      setApiResult(result);
      setIsLoading(false);
      setStep(5); // Vai para a tela de resultado
    } catch (error: any) {
      console.error("Erro na API de Triagem:", error);
      // Define a mensagem de erro para ser mostrada ao utilizador
      setErrorMessage(
        error.message || "Não foi possível ligar ao servidor de triagem."
      );
      setIsLoading(false);
      setStep(3); // Volta para o passo 3 para mostrar o erro
    }
  };

  const nextStep = () => {
    setDirection(1);
    if (step === 3) {
      handleSubmit(); // No último passo, submete em vez de só avançar
    } else if (step < 5) {
      setStep((step + 1) as Step);
    }
  };

  const prevStep = () => {
    setDirection(-1);
    if (step === 5) {
      // Se estiver na tela de resultado, volta ao início
      startOver();
    } else if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  // Reseta o formulário
  const startOver = () => {
    // Força a navegação de volta para a página inicial
    window.location.href = "/";
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  // Define os textos e validações para cada passo
  const isNextDisabled = () => {
    switch (step) {
      case 1:
        return formData.name.trim() === "" || formData.age.trim() === "";
      case 2:
        return complaintMode === null || formData.mainComplaint.trim() === "";
      case 3:
        return false; // Campos opcionais
      default:
        return false;
    }
  };

  const currentResultStyle =
    apiResult && resultConfig[apiResult.classification.priority]
      ? resultConfig[apiResult.classification.priority]
      : resultConfig.AZUL; // Fallback

  return (
    // Fundo ATUALIZADO para 'bg-background' e 'text-foreground'
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />

      <div className="container mx-auto px-6 pt-36 pb-24">
        {" "}
        {/* Padding-top aumentado */}
        <div className="max-w-3xl mx-auto">
          {/* Progress bar */}
          {step < 4 && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-medium text-muted-foreground">
                  Etapa {step} de 3
                </span>
                <span className="text-base font-medium text-muted-foreground">
                  {Math.round((step / 3) * 100)}%
                </span>
              </div>
              <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full" // ATUALIZADO: para 'bg-primary'
                  initial={{ width: "0%" }}
                  animate={{ width: `${(step / 3) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              </div>
            </div>
          )}

          {/* Form Steps ATUALIZADO: para 'bg-card' e 'shadow-xl' */}
          <div className="bg-card rounded-2xl shadow-xl p-10 md:p-16 min-h-[600px] relative overflow-hidden">
            {/* Mensagem de Erro da API */}
            {errorMessage && step === 3 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-lg flex items-start gap-3"
              >
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold mb-1">Erro ao Submeter</h4>
                  <p className="text-sm">{errorMessage}</p>
                </div>
              </motion.div>
            )}

            <AnimatePresence mode="wait" custom={direction}>
              {/* --- PASSO 1: INFORMAÇÕES BÁSICAS --- */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                  }}
                  className="space-y-10"
                >
                  <div>
                    <h2 className="text-4xl font-bold text-foreground mb-2">
                      Bem-vindo à Triagem
                    </h2>
                    <p className="text-lg text-muted-foreground">
                      Vamos começar com suas informações básicas.
                    </p>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <Label htmlFor="name">Nome Completo</Label>
                      <Input
                        id="name"
                        placeholder="Digite seu nome completo"
                        value={formData.name}
                        onChange={(e) => updateFormData("name", e.target.value)}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="age">Idade</Label>
                      <Input
                        id="age"
                        type="number"
                        placeholder="Digite sua idade"
                        value={formData.age}
                        onChange={(e) => updateFormData("age", e.target.value)}
                        className="mt-2"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- PASSO 2: ESCOLHA DO MÉTODO DE INSERÇÃO --- */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                  }}
                  className="space-y-10"
                >
                  {/* ETAPA 2.1: ESCOLHA DO MODO */}
                  {complaintMode === null && (
                    <motion.div
                      key="step2-choice"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-10"
                    >
                      <div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">
                          Qual é sua queixa principal?
                        </h2>
                        <p className="text-lg text-muted-foreground">
                          Como você prefere nos informar o que está sentindo?
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                        <Button
                          variant="secondary"
                          onClick={() => setComplaintMode("options")}
                          className="h-40 text-lg py-4 px-6 flex flex-col gap-3 shadow-sm hover:shadow-lg hover:-translate-y-1 transform transition-all duration-200"
                        >
                          <CheckCircle2 className="h-10 w-10 text-primary" />
                          Selecionar em uma lista
                          <br />
                          (Mais rápido)
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            if (
                              complaintOptions.some(
                                (opt) => opt.key === formData.mainComplaint
                              )
                            ) {
                              updateFormData("mainComplaint", "");
                            }
                            setComplaintMode("text");
                          }}
                          className="h-40 text-lg py-4 px-6 flex flex-col gap-3 shadow-sm hover:shadow-lg hover:-translate-y-1 transform transition-all duration-200"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-10 w-10 text-primary"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                          Descrever com minhas palavras
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* ETAPA 2.2: MODO DE OPÇÕES (BOTÕES) */}
                  {complaintMode === "options" && (
                    <motion.div
                      key="step2-options"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-8"
                    >
                      <div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">
                          Qual é sua queixa principal?
                        </h2>
                        <p className="text-lg text-muted-foreground">
                          Selecione o principal motivo de sua visita.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                        {complaintOptions.map((option) => (
                          <Button
                            key={option.key}
                            variant={
                              formData.mainComplaint === option.key
                                ? "default"
                                : "secondary"
                            }
                            onClick={() => {
                              updateFormData("mainComplaint", option.key);
                            }}
                            className="h-24 text-lg py-4 px-2"
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* ETAPA 2.3: MODO DE TEXTO (CONVENCIONAL) */}
                  {complaintMode === "text" && (
                    <motion.div
                      key="step2-text"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-8"
                    >
                      <div>
                        <h2 className="text-4xl font-bold text-foreground mb-2">
                          Qual é sua queixa principal?
                        </h2>
                        <p className="text-lg text-muted-foreground">
                          Descreva o principal motivo de sua visita.
                        </p>
                      </div>
                      <Textarea
                        id="mainComplaintText"
                        placeholder="Ex: Dor no peito forte que começou há 10 minutos..."
                        value={
                          complaintOptions.some(
                            (opt) => opt.key === formData.mainComplaint
                          )
                            ? ""
                            : formData.mainComplaint
                        }
                        onChange={(e) =>
                          updateFormData("mainComplaint", e.target.value)
                        }
                        className="mt-2 min-h-[220px] text-lg"
                      />
                    </motion.div>
                  )}

                  {/* Botão para alterar o modo de inserção */}
                  {complaintMode !== null && (
                    <div className="pt-6">
                      <Button
                        variant="ghost"
                        onClick={() => setComplaintMode(null)}
                        className="text-base text-muted-foreground hover:text-foreground"
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Alterar modo de inserção
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* --- PASSO 3: SINTOMAS ADICIONAIS --- */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                  }}
                  className="space-y-10"
                >
                  <div>
                    <h2 className="text-4xl font-bold text-foreground mb-2">
                      Detalhes Adicionais
                    </h2>
                    <p className="text-lg text-muted-foreground">
                      Descreva melhor o que está sentindo (opcional).
                    </p>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <Label htmlFor="symptoms">
                        Outros sintomas (Ex: náusea, tontura, dor de cabeça...)
                      </Label>
                      <Textarea
                        id="symptoms"
                        placeholder="Descreva outros sintomas..."
                        value={formData.symptoms}
                        onChange={(e) =>
                          updateFormData("symptoms", e.target.value)
                        }
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="medicalHistory">
                        Histórico Médico (Ex: diabetes, hipertensão, alergias...)
                      </Label>
                      <Textarea
                        id="medicalHistory"
                        placeholder="Liste medicamentos em uso, alergias ou doenças..."
                        value={formData.medicalHistory}
                        onChange={(e) =>
                          updateFormData("medicalHistory", e.target.value)
                        }
                        className="mt-2"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- PASSO 4: TELA DE CARREGAMENTO --- */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                  }}
                  className="flex flex-col items-center justify-center text-center space-y-6 absolute inset-0 p-16"
                >
                  <Loader2 className="h-20 w-20 text-primary animate-spin" />
                  <h2 className="text-3xl font-bold text-foreground mb-2">
                    Analisando seus sintomas...
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    Nossos sistemas (IA e Motor de Regras) estão processando
                    suas informações.
                  </p>
                </motion.div>
              )}

              {/* --- PASSO 5: TELA DE RESULTADO (DINÂMICO) --- */}
              {step === 5 && apiResult && (
                <motion.div
                  key="step5"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                  }}
                  className="space-y-8"
                >
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                        delay: 0.1,
                      }}
                      className={`w-20 h-20 rounded-full ${currentResultStyle.bgColor} flex items-center justify-center mx-auto mb-5`}
                    >
                      {React.cloneElement(currentResultStyle.icon, {
                        className: `h-10 w-10 ${currentResultStyle.textColor}`,
                      })}
                    </motion.div>
                    <h2 className="text-4xl font-bold text-foreground mb-2">
                      Triagem Concluída
                    </h2>
                    <p className="text-lg text-muted-foreground mb-8">
                      Olá, {apiResult.patient_name}. Seus dados foram
                      registrados.
                    </p>
                  </div>

                  {/* Card de Resultado Dinâmico */}
                  <div
                    className={`rounded-2xl p-8 space-y-5 ${currentResultStyle.bgColor} border ${currentResultStyle.borderColor} shadow-lg`}
                  >
                    <div className="flex items-start gap-4">
                      {React.cloneElement(currentResultStyle.icon, {
                        className: `h-6 w-6 ${currentResultStyle.textColor} mt-1 flex-shrink-0`,
                      })}
                      <div>
                        <h3
                          className={`text-xl font-semibold mb-1 ${currentResultStyle.textColor}`}
                        >
                          Classificação:{" "}
                          {apiResult.classification.priority}
                        </h3>
                        <p
                          className={`text-base ${currentResultStyle.textColor}/80`}
                        >
                          {apiResult.classification.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-5 border-t border-black/10 dark:border-white/10">
                      <div className="grid grid-cols-2 gap-4 text-base">
                        <div>
                          <span
                            className={`${currentResultStyle.textColor}/70`}
                          >
                            Senha:
                          </span>
                          <p
                            className={`font-bold text-2xl ${currentResultStyle.textColor}`}
                          >
                            {apiResult.classification.ticket}
                          </p>
                        </div>
                        <div>
                          <span
                            className={`${currentResultStyle.textColor}/70`}
                          >
                            Tempo Estimado:
                          </span>
                          <p
                            className={`font-bold text-2xl ${currentResultStyle.textColor}`}
                          >
                            {apiResult.classification.estimated_wait_time}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sugestões da IA */}
                  <div className="pt-4">
                    <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      Análise da IA (Sugestões de Diagnóstico)
                    </h4>
                    <div className="space-y-3">
                      {apiResult.ai_suggestions.map((suggestion) => (
                        <div
                          key={suggestion.disease}
                          className="flex items-center justify-between p-4 rounded-lg bg-secondary/10"
                        >
                          <span className="font-medium text-foreground">
                            {suggestion.disease}
                          </span>
                          <span className="font-bold text-lg text-primary">
                            {(suggestion.probability * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* --- Botões de Navegação --- */}
          <div className="flex items-center justify-between mt-16">
            {/* Botão Anterior */}
            <Button
              variant="outline"
              onClick={prevStep}
              className={`gap-2 ${
                step === 1 || step >= 4 ? "opacity-0 invisible" : ""
              }`}
              disabled={step === 1 || step >= 4}
            >
              <ArrowLeft className="h-4 w-4" />
              Anterior
            </Button>

            {/* Botão Próximo / Finalizar */}
            {step < 3 && (
              <Button
                onClick={nextStep}
                className={`gap-2 ${
                  step === 2 && complaintMode === null
                    ? "opacity-0 invisible"
                    : ""
                }`}
                disabled={isNextDisabled()}
              >
                Próximo
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            {step === 3 && (
              <Button
                onClick={nextStep}
                className="gap-2 text-lg"
                disabled={isNextDisabled() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Concluir Triagem
                    <CheckCircle2 className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}

            {step === 5 && (
              <Button
                onClick={startOver}
                className="w-full gap-2 text-lg"
              >
                Finalizar e Voltar ao Início
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kiosk;