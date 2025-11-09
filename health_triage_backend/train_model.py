import sqlite3
import pandas as pd
import joblib  # Para salvar/carregar o modelo e o vetorizador
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report
import nltk
from nltk.corpus import stopwords
import string

# --- Configuração de NLP (Processamento de Linguagem Natural) ---
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    print("A baixar 'stopwords' do NLTK (necessário na primeira execução)...")
    nltk.download('stopwords')

# Carrega as stopwords em português
# Removemos pontuação e palavras comuns (ex: 'de', 'para', 'o', 'a')
stop_words_pt = list(stopwords.words('portuguese'))
translator_punctuation = str.maketrans('', '', string.punctuation)

def preprocess_text(text: str) -> str:
    """Limpa e normaliza o texto para o modelo de ML."""
    if not isinstance(text, str):
        return ""
    text = text.lower()  # Caixa baixa
    text = text.translate(translator_punctuation)  # Remove pontuação
    # Remove stopwords
    text = " ".join([word for word in text.split() if word not in stop_words_pt])
    return text

# --- Funções de Treino ---

def load_data(db_file="triage.db") -> pd.DataFrame:
    """Carrega os dados etiquetados (labelled) do banco de dados SQLite."""
    print(f"A ler dados de treino de '{db_file}'...")
    try:
        with sqlite3.connect(db_file) as conn:
            # Seleciona apenas pacientes atendidos E que tenham um diagnóstico final
            df = pd.read_sql_query(
                "SELECT mainComplaint, symptoms, medicalHistory, age, final_diagnosis FROM triage_log WHERE attended = 1 AND final_diagnosis IS NOT NULL",
                conn
            )
        print(f"Encontrados {len(df)} registos de treino etiquetados.")
        if len(df) == 0:
            print("AVISO: Não há dados de treino suficientes no banco de dados.")
            return pd.DataFrame()
        return df
    except Exception as e:
        print(f"Erro ao ler o banco de dados: {e}")
        return pd.DataFrame()

def train_model(df: pd.DataFrame):
    """Processa os dados, treina o pipeline de ML e salva os artefactos."""
    
    # 1. Pré-processamento e Combinação de Features
    # Combinamos todos os inputs de texto numa única "feature" de texto
    print("A processar e limpar o texto (NLP)...")
    df['text_features'] = (
        df['mainComplaint'].apply(preprocess_text) + " " +
        df['symptoms'].apply(preprocess_text) + " " +
        df['medicalHistory'].apply(preprocess_text)
    )
    
    # Adicionamos a idade como uma feature de texto para o TF-IDF capturar
    # (Uma técnica simples; engenharia de features mais complexa pode ser feita aqui)
    df['text_features'] = df['text_features'] + " idade_" + df['age'].astype(str)

    X = df['text_features']
    y = df['final_diagnosis'] # O que queremos prever

    if len(df) < 10:
        print("Erro: Não há dados suficientes para treinar. Precisa de mais pacientes etiquetados.")
        return

    # 2. Divisão dos Dados (Treino e Teste)
    # Usamos 20% dos dados para validar o nosso próprio modelo
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    print(f"A dividir dados: {len(X_train)} para treino, {len(X_test)} para teste.")

    # 3. Definição do Pipeline de ML
    # O Pipeline faz tudo:
    # 1. 'tfidf': Converte o texto em números (vetorização TF-IDF)
    # 2. 'clf': Treina o classificador (Regressão Logística)
    
    # Baseado nos artigos que você enviou, Regressão Logística é uma excelente escolha,
    # robusta e interpretável.
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=1000, ngram_range=(1, 2))), # max_features limita o vocabulário
        ('clf', LogisticRegression(multi_class='ovr', solver='liblinear', random_state=42)) # 'ovr' = One-vs-Rest
    ])

    # 4. Treinar o Modelo
    print("A treinar o modelo de Regressão Logística...")
    pipeline.fit(X_train, y_train)

    # 5. Avaliar o Modelo
    print("\n--- Avaliação do Modelo (nos dados de teste) ---")
    y_pred = pipeline.predict(X_test)
    print(classification_report(y_test, y_pred, zero_division=0))
    print("-------------------------------------------------")

    # 6. Salvar o Pipeline (O "Cérebro" da IA)
    # Salvamos o pipeline inteiro (que contém o TF-IDF e o Modelo) num único ficheiro.
    model_filename = 'ia_triage_model.pkl'
    joblib.dump(pipeline, model_filename)
    print(f"Sucesso! Modelo de IA e Vetorizador salvos em '{model_filename}'")


# --- Ponto de Entrada Principal ---
if __name__ == "__main__":
    df_data = load_data()
    if not df_data.empty:
        train_model(df_data)
    else:
        print("Treino cancelado.")