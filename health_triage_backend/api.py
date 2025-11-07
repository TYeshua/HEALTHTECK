import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import random
import uuid
from datetime import datetime, timedelta

# Importar o CORSMiddleware
from fastapi.middleware.cors import CORSMiddleware

# --- Modelos Pydantic (O "Contrato" da API) ---
# Estes modelos garantem que os dados trocados com o frontend (React)
# tenham a estrutura correta.

class PatientData(BaseModel):
    """Dados de entrada recebidos do Kiosk (frontend)."""
    name: str
    age: str
    mainComplaint: str
    symptoms: str
    medicalHistory: str

class DiagnosisSuggestion(BaseModel):
    """Uma única sugestão de diagnóstico da IA."""
    disease: str
    probability: float

class TriageClassification(BaseModel):
    """A classificação de prioridade gerada pelo Motor de Regras."""
    priority: str
    color: str
    description: str
    ticket: str
    estimated_wait_time: str

class FullTriageResponse(BaseModel):
    """A resposta completa enviada de volta ao Kiosk."""
    patient_name: str
    classification: TriageClassification
    ai_suggestions: List[DiagnosisSuggestion]

class PatientInQueue(BaseModel):
    """Representação de um paciente na fila de espera (para o Dashboard)."""
    ticket: str
    name: str
    priority: str
    priority_color: str
    priority_description: str
    complaint: str
    wait_time_minutes: int
    ai_suggestions: List[DiagnosisSuggestion]
    arrival_time: datetime

class DashboardStats(BaseModel):
    """Estatísticas agregadas para o Dashboard."""
    total_in_queue: int
    emergency_count: int
    avg_wait_time_minutes: float
    last_hour_count: int

# --- Configuração do Aplicativo FastAPI ---

app = FastAPI(
    title="HealthTriage AI API",
    description="Backend para triagem de pacientes e gestão de fila de espera.",
    version="1.0.0",
)

# --- Configuração do CORS (Cross-Origin Resource Sharing) ---
# ISTO É ESSENCIAL para permitir que o seu frontend (ex: http://localhost:8080)
# comunique com o seu backend (http://127.0.0.1:8000).

origins = [
    "http://localhost:3000",    # React (dev padrão)
    "http://localhost:5173",    # Vite (dev padrão)
    "http://localhost:8080",    # A porta que você está usando
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # Permite estas origens
    allow_credentials=True,
    allow_methods=["*"],         # Permite todos os métodos (GET, POST, etc.)
    allow_headers=["*"],         # Permite todos os cabeçalhos
)

# --- Base de Dados Falsa (Simulação da Sala de Espera) ---
# Em produção, isto seria substituído por um banco de dados (ex: PostgreSQL, Firestore).
waiting_room: List[PatientInQueue] = []

# --- Lógica de Classificação (Motores de Regras e IA) ---

# Mapeamento de Prioridades
PRIORITY_MAP = {
    "VERMELHO": {"color": "#EF4444", "description": "Emergência (Risco Imediato)", "wait": "Imediato", "level": 5},
    "LARANJA": {"color": "#F97316", "description": "Muito Urgente", "wait": "10 min", "level": 4},
    "AMARELO": {"color": "#EAB308", "description": "Urgente", "wait": "30 min", "level": 3},
    "VERDE": {"color": "#22C55E", "description": "Pouco Urgente", "wait": "60 min", "level": 2},
    "AZUL": {"color": "#3B82F6", "description": "Não Urgente", "wait": "120 min", "level": 1},
}

def rule_based_triage(data: PatientData) -> TriageClassification:
    """
    MOTOR DE REGRAS (Simulado)
    Define a prioridade (cor, ticket) baseado nos dados do paciente.
    Baseado nos artigos (idade, funcionalidade/sintomas graves).
    """
    priority = "VERDE" # Padrão
    age = int(data.age) if data.age.isdigit() else 30

    # Lógica de priorização (baseada nas suas regras e nos artigos)
    if data.mainComplaint in ["dor_peito", "dificuldade_respirar", "perda_controle_facial"]:
        priority = "VERMELHO"
    elif data.mainComplaint in ["febre_alta", "dor_abdominal", "tontura_desmaio"]:
        priority = "LARANJA"
    elif data.mainComplaint in ["ferimento_corte", "reacao_alergica"] or "fratura" in data.symptoms.lower():
        priority = "AMARELO"
    elif data.mainComplaint == "outros":
        priority = "AZUL"

    # Ajuste de risco pela idade (baseado no Artigo 1 - SABE)
    if age > 75 and PRIORITY_MAP[priority]["level"] < 4:
        priority = "LARANJA" # Aumenta o risco para idosos
    elif age > 60 and PRIORITY_MAP[priority]["level"] < 3:
        priority = "AMARELO"

    # Ajuste de risco pelo histórico (baseado no Artigo 1)
    if "diabetes" in data.medicalHistory.lower() or "hipertensao" in data.medicalHistory.lower():
         if PRIORITY_MAP[priority]["level"] < 3:
            priority = "AMARELO"

    info = PRIORITY_MAP[priority]
    ticket = f"{priority[0]}-{random.randint(100, 999)}"

    return TriageClassification(
        priority=priority,
        color=info["color"],
        description=info["description"],
        ticket=ticket,
        estimated_wait_time=info["wait"]
    )

def predict_diagnosis(data: PatientData) -> List[DiagnosisSuggestion]:
    """
    MOTOR DE ML (Simulado)
    Prevê possíveis diagnósticos com base nos sintomas.
    """
    suggestions = []
    complaint = data.mainComplaint
    
    if complaint == "dor_peito":
        suggestions = [
            DiagnosisSuggestion(disease="Infarto Agudo do Miocárdio (IAM)", probability=0.88),
            DiagnosisSuggestion(disease="Embolia Pulmonar (TEP)", probability=0.42),
            DiagnosisSuggestion(disease="Ansiedade", probability=0.15),
        ]
    elif complaint == "dificuldade_respirar":
         suggestions = [
            DiagnosisSuggestion(disease="Pneumonia", probability=0.72),
            DiagnosisSuggestion(disease="Asma (Crise)", probability=0.55),
            DiagnosisSuggestion(disease="COVID-19", probability=0.30),
        ]
    elif complaint == "febre":
        suggestions = [
            DiagnosisSuggestion(disease="Infecção Viral (Gripe)", probability=0.92),
            DiagnosisSuggestion(disease="Dengue", probability=0.65),
            DiagnosisSuggestion(disease="Infecção Urinária", probability=0.25),
        ]
    elif complaint == "dor_abdominal":
         suggestions = [
            DiagnosisSuggestion(disease="Apendicite", probability=0.65),
            DiagnosisSuggestion(disease="Gastroenterite", probability=0.40),
            DiagnosisSuggestion(disease="Cálculo Renal", probability=0.22),
        ]
    else:
        suggestions = [DiagnosisSuggestion(disease="A ser avaliado", probability=0.99)]

    # Ordena pela probabilidade mais alta
    return sorted(suggestions, key=lambda x: x.probability, reverse=True)[:3]

# --- Endpoints da API ---

@app.post("/triage", response_model=FullTriageResponse)
async def triage_patient(data: PatientData):
    """
    Endpoint principal para o KIOSK.
    Recebe os dados do paciente, processa em ambos os motores (Regras e ML)
    e adiciona o paciente à fila de espera.
    """
    try:
        classification = rule_based_triage(data)
        suggestions = predict_diagnosis(data)

        # Cria o objeto do paciente para a fila de espera
        patient_in_queue = PatientInQueue(
            ticket=classification.ticket,
            name=data.name,
            priority=classification.priority,
            priority_color=classification.color,
            priority_description=classification.description,
            complaint=data.mainComplaint.replace("_", " ").capitalize(),
            wait_time_minutes=0, # O tempo de espera será calculado dinamicamente
            ai_suggestions=suggestions,
            arrival_time=datetime.utcnow()
        )

        # Adiciona o paciente à "base de dados" (fila de espera)
        waiting_room.append(patient_in_queue)
        
        # Ordena a fila de espera pela prioridade (nível)
        waiting_room.sort(key=lambda p: PRIORITY_MAP[p.priority]["level"], reverse=True)

        # Retorna a resposta completa para o Kiosk
        return FullTriageResponse(
            patient_name=data.name,
            classification=classification,
            ai_suggestions=suggestions
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno no servidor: {str(e)}")

# --- NOVOS ENDPOINTS PARA O DASHBOARD ---

@app.get("/patients", response_model=List[PatientInQueue])
async def get_patients_in_queue():
    """
    Endpoint para o DASHBOARD.
    Retorna a lista de pacientes na fila, calculando o tempo de espera atual.
    """
    now = datetime.utcnow()
    
    # Atualiza o tempo de espera de todos os pacientes na fila
    for patient in waiting_room:
        wait_delta = now - patient.arrival_time
        patient.wait_time_minutes = int(wait_delta.total_seconds() / 60)
        
    return waiting_room

@app.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    """
    Endpoint para o DASHBOARD.
    Retorna as estatísticas agregadas da fila.
    """
    now = datetime.utcnow()
    one_hour_ago = now - timedelta(hours=1)
    
    total = len(waiting_room)
    emergencies = sum(1 for p in waiting_room if p.priority in ["VERMELHO", "LARANJA"])
    last_hour = sum(1 for p in waiting_room if p.arrival_time > one_hour_ago)
    
    avg_wait = 0.0
    if total > 0:
        total_wait = sum(int((now - p.arrival_time).total_seconds() / 60) for p in waiting_room)
        avg_wait = total_wait / total

    return DashboardStats(
        total_in_queue=total,
        emergency_count=emergencies,
        avg_wait_time_minutes=avg_wait,
        last_hour_count=last_hour
    )

@app.post("/attend/{ticket}", status_code=204)
async def attend_patient(ticket: str):
    """
    Endpoint para o DASHBOARD.
    Remove um paciente da fila de espera (simula o atendimento).
    """
    global waiting_room
    patient_found = False
    
    # Filtra a lista, removendo o paciente com o ticket correspondente
    new_waiting_room = []
    for patient in waiting_room:
        if patient.ticket == ticket:
            patient_found = True
        else:
            new_waiting_room.append(patient)
            
    if not patient_found:
        raise HTTPException(status_code=404, detail="Paciente não encontrado na fila.")
    
    waiting_room = new_waiting_room
    return
