import uvicorn
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List, Dict, Optional
import random
import uuid
from datetime import datetime, timedelta, timezone
import sqlite3
import json
import joblib
import os.path
import nltk
from nltk.corpus import stopwords
import string

# --- Importações de Segurança ---
from jose import JWTError, jwt
from passlib.context import CryptContext

# Importar o CORSMiddleware
from fastapi.middleware.cors import CORSMiddleware

# --- Configuração de NLP (para a função de predição) ---
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    print("A baixar 'stopwords' do NLTK (necessário para a API)...")
    nltk.download('stopwords')

# --- Modelos Pydantic (O "Contrato" da API) ---
# (Modelos existentes)
class PatientData(BaseModel):
    name: str
    age: str
    mainComplaint: str
    symptoms: str
    medicalHistory: str

class DiagnosisSuggestion(BaseModel):
    disease: str
    probability: float

class TriageClassification(BaseModel):
    priority: str
    color: str
    description: str
    ticket: str
    estimated_wait_time: str

class FullTriageResponse(BaseModel):
    patient_name: str
    classification: TriageClassification
    ai_suggestions: List[DiagnosisSuggestion]

class PatientInQueue(BaseModel):
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
    total_in_queue: int
    emergency_count: int
    avg_wait_time_minutes: float
    last_hour_count: int

class ResolveData(BaseModel):
    final_diagnosis: str

# --- Modelos Pydantic para Segurança ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    username: str # Este será o email
    full_name: Optional[str] = None

class UserInDB(User):
    hashed_password: str

# NOVO: Modelo para criar um novo utilizador
class UserCreate(BaseModel):
    username: str # Email
    password: str
    full_name: str

# --- Configuração de Segurança (JWT e Hashing) ---
SECRET_KEY = "c7a8b2f9d1e0c3a7b5f6d4e2c1a0b9d8e7f6a5c4b3a2d1e0f"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8 # 8 Horas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# --- Funções de Segurança ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_user_from_db(username: str, conn: sqlite3.Connection) -> Optional[UserInDB]:
    cursor = conn.execute(
        "SELECT username, full_name, hashed_password FROM users WHERE username = ?",
        (username,)
    )
    user_row = cursor.fetchone()
    if user_row:
        return UserInDB(
            username=user_row["username"],
            full_name=user_row["full_name"],
            hashed_password=user_row["hashed_password"]
        )
    return None

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    with get_db_connection() as conn:
        user = get_user_from_db(username=token_data.username, conn=conn)
    
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    return current_user

# --- Configuração do Aplicativo FastAPI ---
app = FastAPI(
    title="HealthTriage AI API",
    description="Backend para triagem de pacientes e gestão de fila de espera.",
    version="1.2.0 (Com Registo de Utilizadores)",
)

# --- Configuração do CORS ---
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Configuração do BD SQLite ---
DATABASE_FILE = "triage.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS triage_log (
                ticket TEXT PRIMARY KEY, name TEXT NOT NULL, age TEXT NOT NULL, 
                mainComplaint TEXT, symptoms TEXT, medicalHistory TEXT,
                arrival_time TEXT NOT NULL, priority TEXT NOT NULL, priority_color TEXT NOT NULL, 
                priority_description TEXT NOT NULL, priority_level INTEGER NOT NULL,
                ai_suggestions_json TEXT, attended INTEGER NOT NULL DEFAULT 0,
                final_diagnosis TEXT 
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                full_name TEXT,
                hashed_password TEXT NOT NULL
            );
        """)
        
        default_user = "medico"
        default_pass = "senha123"
        hashed_pass = get_password_hash(default_pass)
        
        conn.execute(
            "INSERT OR IGNORE INTO users (username, full_name, hashed_password) VALUES (?, ?, ?)",
            (default_user, "Dr. Médico Padrão", hashed_pass)
        )
        conn.commit()

# --- Lógica de Classificação (IA HÍBRIDA) ---
PRIORITY_MAP = {
    "VERMELHO": {"color": "#EF4444", "description": "Emergência (Risco Imediato)", "wait": "Imediato", "level": 5},
    "LARANJA": {"color": "#F97316", "description": "Muito Urgente", "wait": "10 min", "level": 4},
    "AMARELO": {"color": "#EAB308", "description": "Urgente", "wait": "30 min", "level": 3},
    "VERDE": {"color": "#22C55E", "description": "Pouco Urgente", "wait": "60 min", "level": 2},
    "AZUL": {"color": "#3B82F6", "description": "Não Urgente", "wait": "120 min", "level": 1},
}
MODEL_FILE = 'ia_triage_model.pkl'
pipeline_ia = None 
stop_words_pt_api = list(stopwords.words('portuguese'))
translator_punc_api = str.maketrans('', '', string.punctuation)

def load_ia_model():
    global pipeline_ia
    if os.path.exists(MODEL_FILE):
        try:
            pipeline_ia = joblib.load(MODEL_FILE)
            print(f"Sucesso: Modelo de IA '{MODEL_FILE}' carregado.")
            print(f"Classes que o modelo pode prever: {pipeline_ia.classes_}")
        except Exception as e:
            print(f"AVISO: Ficheiro do modelo '{MODEL_FILE}' encontrado, mas falhou ao carregar: {e}")
            pipeline_ia = None
    else:
        print(f"AVISO: Ficheiro do modelo '{MODEL_FILE}' não encontrado.")
        print("A API vai arrancar em MODO DE SIMULAÇÃO para as sugestões de IA.")
        pipeline_ia = None

def rule_based_triage(data: PatientData) -> TriageClassification:
    priority = "VERDE"
    age = int(data.age) if data.age.isdigit() else 30
    if data.mainComplaint in ["dor_peito", "dificuldade_respirar", "perda_controle_facial"]:
        priority = "VERMELHO"
    elif data.mainComplaint in ["febre_alta", "dor_abdominal", "tontura_desmaio"]:
        priority = "LARANJA"
    elif data.mainComplaint in ["ferimento_corte", "reacao_alergica"] or "fratura" in data.symptoms.lower():
        priority = "AMARELO"
    elif data.mainComplaint == "outros":
        priority = "AZUL"
    if age > 75 and PRIORITY_MAP[priority]["level"] < 4:
        priority = "LARANJA"
    elif age > 60 and PRIORITY_MAP[priority]["level"] < 3:
        priority = "AMARELO"
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

def preprocess_text_api(text: str) -> str:
    if not isinstance(text, str): return ""
    text = text.lower().translate(translator_punc_api)
    return " ".join([word for word in text.split() if word not in stop_words_pt_api])

def predict_diagnosis(data: PatientData) -> List[DiagnosisSuggestion]:
    global pipeline_ia
    if pipeline_ia:
        try:
            text_input = (
                preprocess_text_api(data.mainComplaint) + " " +
                preprocess_text_api(data.symptoms) + " " +
                preprocess_text_api(data.medicalHistory) + " " +
                "idade_" + str(data.age)
            )
            probabilities = pipeline_ia.predict_proba([text_input])[0]
            classes = pipeline_ia.classes_
            suggestions = [
                DiagnosisSuggestion(disease=classes[i], probability=probabilities[i])
                for i in range(len(classes))
            ]
            return sorted(suggestions, key=lambda x: x.probability, reverse=True)[:3]
        except Exception as e:
            print(f"ERRO: O modelo de IA real falhou na predição: {e}")
            return predict_diagnosis_simulated(data)
    else:
        return predict_diagnosis_simulated(data)

def predict_diagnosis_simulated(data: PatientData) -> List[DiagnosisSuggestion]:
    # (A lógica de simulação if/elif permanece a mesma)
    suggestions = []
    complaint = data.mainComplaint
    if complaint == "dor_peito":
        suggestions = [
            DiagnosisSuggestion(disease="Infarto Agudo do Miocárdio (IAM)", probability=0.88),
            DiagnosisSuggestion(disease="Embolia Pulmonar (TEP)", probability=0.42),
        ]
    # ... (restante da lógica simulada)
    elif complaint == "dificuldade_respirar":
        suggestions = [
            DiagnosisSuggestion(disease="Pneumonia", probability=0.72),
            DiagnosisSuggestion(disease="Asma (Crise)", probability=0.55),
        ]
    elif complaint == "febre":
        suggestions = [
            DiagnosisSuggestion(disease="Infecção Viral (Gripe)", probability=0.92),
            DiagnosisSuggestion(disease="Dengue", probability=0.65),
        ]
    elif complaint == "dor_abdominal":
        suggestions = [
            DiagnosisSuggestion(disease="Apendicite", probability=0.65),
            DiagnosisSuggestion(disease="Gastroenterite", probability=0.40),
        ]
    else:
        suggestions = [DiagnosisSuggestion(disease="A ser avaliado", probability=0.99)]
    return sorted(suggestions, key=lambda x: x.probability, reverse=True)[:3]

# --- Endpoints da API ---

@app.on_event("startup")
async def startup_event():
    init_db()
    load_ia_model()

# --- ENDPOINTS DE AUTENTICAÇÃO (PÚBLICOS) ---
@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """Endpoint de login que recebe um formulário e retorna um Token JWT."""
    with get_db_connection() as conn:
        user = get_user_from_db(form_data.username, conn)
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Utilizador ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# NOVO ENDPOINT: Registo de Utilizador (Público)
@app.post("/users/register", response_model=User, status_code=201)
async def register_user(user: UserCreate):
    """Cria um novo utilizador no banco de dados."""
    with get_db_connection() as conn:
        db_user = get_user_from_db(user.username, conn)
        if db_user:
            raise HTTPException(
                status_code=400, 
                detail="Este email (utilizador) já está registado."
            )
        
        hashed_password = get_password_hash(user.password)
        
        try:
            conn.execute(
                "INSERT INTO users (username, full_name, hashed_password) VALUES (?, ?, ?)",
                (user.username, user.full_name, hashed_password)
            )
            conn.commit()
        except sqlite3.IntegrityError as e:
             raise HTTPException(status_code=500, detail=f"Erro de base de dados: {e}")

    return User(username=user.username, full_name=user.full_name)


# --- ENDPOINT DE TRIAGEM (PÚBLICO) ---
@app.post("/triage", response_model=FullTriageResponse)
async def triage_patient(data: PatientData):
    # (Esta função permanece exatamente igual à anterior)
    try:
        classification = rule_based_triage(data)
        suggestions = predict_diagnosis(data) 
        arrival_time_str = datetime.utcnow().isoformat()
        priority_level = PRIORITY_MAP[classification.priority]["level"]
        suggestions_json = json.dumps([s.model_dump() for s in suggestions])

        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO triage_log (
                    ticket, name, age, mainComplaint, symptoms, medicalHistory, 
                    arrival_time, priority, priority_color, priority_description, 
                    priority_level, ai_suggestions_json, attended, final_diagnosis
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
                """,
                (
                    classification.ticket, data.name, data.age, data.mainComplaint,
                    data.symptoms, data.medicalHistory, arrival_time_str,
                    classification.priority, classification.color,
                    classification.description, priority_level, suggestions_json
                )
            )
            conn.commit()

        return FullTriageResponse(
            patient_name=data.name,
            classification=classification,
            ai_suggestions=suggestions
        )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=500, detail="Erro ao gerar ticket único. Tente novamente.")
    except Exception as e:
        print(f"Erro detalhado no /triage: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno no servidor: {str(e)}")

# --- ENDPOINTS DO DASHBOARD (PROTEGIDOS) ---

@app.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Rota protegida para verificar quem está logado."""
    return current_user

@app.get("/patients", response_model=List[PatientInQueue])
async def get_patients_in_queue(current_user: User = Depends(get_current_active_user)):
    """Retorna a fila de espera (protegido)."""
    now = datetime.utcnow()
    patients_list = []
    with get_db_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM triage_log WHERE attended = 0 ORDER BY priority_level DESC, arrival_time ASC"
        )
        rows = cursor.fetchall()
    for row in rows:
        arrival_time = datetime.fromisoformat(row["arrival_time"])
        wait_delta = now - arrival_time
        suggestions_list = []
        if row["ai_suggestions_json"]:
            suggestions_list = json.loads(row["ai_suggestions_json"])
        ai_suggestions = [DiagnosisSuggestion(**s) for s in suggestions_list]
        patients_list.append(
            PatientInQueue(
                ticket=row["ticket"],
                name=row["name"],
                priority=row["priority"],
                priority_color=row["priority_color"],
                priority_description=row["priority_description"],
                complaint=row["mainComplaint"].replace("_", " ").capitalize(),
                wait_time_minutes=int(wait_delta.total_seconds() / 60),
                ai_suggestions=ai_suggestions,
                arrival_time=arrival_time
            )
        )
    return patients_list

@app.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: User = Depends(get_current_active_user)):
    """Retorna as estatísticas da fila (protegido)."""
    now = datetime.utcnow()
    one_hour_ago_str = (now - timedelta(hours=1)).isoformat()
    with get_db_connection() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM triage_log WHERE attended = 0"
        ).fetchone()[0]
        emergencies = conn.execute(
            "SELECT COUNT(*) FROM triage_log WHERE attended = 0 AND (priority = 'VERMELHO' OR priority = 'LARANJA')"
        ).fetchone()[0]
        last_hour = conn.execute(
            "SELECT COUNT(*) FROM triage_log WHERE attended = 0 AND arrival_time >= ?",
            (one_hour_ago_str,)
        ).fetchone()[0]
        avg_wait = 0.0
        if total > 0:
            cursor = conn.execute(
                "SELECT arrival_time FROM triage_log WHERE attended = 0"
            ).fetchall()
            total_wait_seconds = 0
            for row in cursor:
                arrival_time = datetime.fromisoformat(row["arrival_time"])
                total_wait_seconds += (now - arrival_time).total_seconds()
            avg_wait = (total_wait_seconds / 60) / total
    return DashboardStats(
        total_in_queue=total,
        emergency_count=emergencies,
        avg_wait_time_minutes=round(avg_wait, 1),
        last_hour_count=last_hour
    )

@app.post("/resolve/{ticket}", status_code=204)
async def resolve_patient(ticket: str, data: ResolveData, current_user: User = Depends(get_current_active_user)):
    """Etiqueta um paciente com diagnóstico final (protegido)."""
    with get_db_connection() as conn:
        cursor = conn.execute(
            "UPDATE triage_log SET attended = 1, final_diagnosis = ? WHERE ticket = ? AND attended = 0",
            (data.final_diagnosis, ticket)
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404, detail="Paciente não encontrado na fila.")
    return

# --- Rota Raiz (Pública) ---
@app.get("/")
def read_root():
    status = "Modo de Simulação"
    if pipeline_ia:
        status = f"Modelo {MODEL_FILE} carregado"
    return {"status": "HealthTriage AI API está online", "ia_mode": status, "docs_url": "/docs"}

# --- Ponto de Entrada para Execução ---
if __name__ == "__main__":
    print("Inicializando o banco de dados 'triage.db'...")
    init_db()
    print("Iniciando o servidor FastAPI em http://127.0.0.1:8000")
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)