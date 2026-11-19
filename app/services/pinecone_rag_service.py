"""AgriConnect Pinecone + Groq Agricultural RAG Service.

Multi-tiered, enterprise-grade RAG architecture:
1. Pinecone Serverless Vector Search (Index: 'market-forecaster', Namespace: 'agricultural-rag')
2. Groq High-Speed LPU Inference ('openai/gpt-oss-120b')
3. Resilient Fallback to In-Memory Curated Knowledge Base & CropDiseaseAI Local Bridge
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.request
from typing import Any, Dict, List, Optional

try:
    from pinecone import Pinecone
    HAS_PINECONE = True
except ImportError:
    HAS_PINECONE = False

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "cropdisease-rag")
PINECONE_NAMESPACE = os.getenv("PINECONE_NAMESPACE", "agricultural-rag")
EMBEDDING_MODEL_NAME = "llama-text-embed-v2"
EMBEDDING_DIM = 384

GROQ_PRIMARY_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_FALLBACK_MODELS = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b", "allam-2-7b"]

DISCLAIMER_TEXT = (
    "Answers are synthesized strictly from indexed verified government, ICAR, and university extension publications. "
    "For complex local pest emergencies, call Kisan Call Centre (Toll-Free 1800-180-1551)."
)

# Built-in verified extension documents for resilient fallback
FALLBACK_DOCUMENTS = [
    {
        "id": "ANGRAU-GN-2024",
        "crop": "groundnut",
        "title": "Acharya N.G. Ranga Agricultural University - Groundnut Package of Practices",
        "source": "ANGRAU Extension Directorate, Guntur (AP)",
        "keywords": ["groundnut", "spacing", "gypsum", "seed treatment", "tikka", "yield", "pod", "pegging"],
        "content": (
            "Recommended seed rate for Spanish bunch groundnut is 45-50 kg/acre. Treat seeds with Trichoderma viride @ 4 g/kg "
            "or Imidacloprid 600 FS @ 2 ml/kg to guard against root rot and stem borer. Apply Gypsum at 200 kg/acre at 40-45 "
            "days after sowing (pegging stage) to ensure calcium availability for shell formation, avoid pop pods, and ensure bold kernel development. "
            "Critical irrigation stages are flowering (25-30 DAS) and pod development (50-70 DAS)."
        ),
    },
    {
        "id": "ICAR-IPM-PADDY",
        "crop": "paddy",
        "title": "ICAR-IIRR Integrated Pest Management Protocols for South Indian Paddy",
        "source": "ICAR - Indian Institute of Rice Research, Rajendranagar, Hyderabad",
        "keywords": ["paddy", "rice", "stem borer", "blast", "bph", "brown plant hopper", "leaf folder"],
        "content": (
            "For yellow stem borer in paddy, clip seedling tips before transplanting to remove egg masses. Install pheromone traps "
            "@ 8/acre for monitoring. If dead hearts exceed 10%, apply Cartap Hydrochloride 4G @ 10 kg/acre or Chlorantraniliprole 18.5 SC "
            "@ 60 ml/acre in 200L water. For Brown Plant Hopper (BPH), create 30 cm alleyways every 2 metres and drain water "
            "for 2-3 days; avoid synthetic pyrethroids which cause BPH resurgence."
        ),
    },
    {
        "id": "ICAR-NRCB-BANANA-SIGATOKA",
        "crop": "banana",
        "title": "ICAR-NRCB Banana Sigatoka & Pestalotiopsis Leaf Spot Advisory",
        "source": "ICAR - National Research Centre for Banana (NRCB), Tiruchirappalli",
        "keywords": ["banana", "sigatoka", "cordana", "pestalotiopsis", "leaf spot", "propiconazole", "mineral oil"],
        "content": (
            "For Banana Sigatoka Leaf Spot (Pseudocercospora musae), prune and burn severely infected leaves to reduce spore inoculum. "
            "Spray Propiconazole 25% EC @ 1.0 ml/L or Difenoconazole 25% EC @ 1.0 ml/L or Azoxystrobin 23% SC @ 1.0 ml/L. "
            "Mixing with 1% mineral horticultural oil (10 ml/L) enhances fungicide adherence and penetration. Rotate with Mancozeb 75% WP @ 2.0 g/L "
            "to prevent resistance. Observe a 30-day Pre-Harvest Interval (PHI)."
        ),
    },
    {
        "id": "ICAR-IIWBR-WHEAT-RUST",
        "crop": "wheat",
        "title": "ICAR-IIWBR Wheat Rust & Nutrient Deficiency Management",
        "source": "ICAR - Indian Institute of Wheat and Barley Research, Karnal (Haryana)",
        "keywords": ["wheat", "rust", "brown rust", "leaf rust", "propiconazole", "nitrogen", "deficiency", "yellow"],
        "content": (
            "For Wheat Leaf / Brown Rust (Puccinia triticina), spray Propiconazole 25% EC @ 1.0 ml/L (500 ml/ha in 500L water) "
            "or Tebuconazole 25.9% EC @ 1.0 ml/L at first appearance of brown pustules. Pre-harvest interval is 30 days. "
            "For Nitrogen deficiency in wheat, broadcast Urea @ 25 kg/acre before first irrigation (CRI stage) or apply 2% foliar Urea spray "
            "(20 g Urea in 1 Liter water) during active tillering to rapidly correct leaf yellowing."
        ),
    },
    {
        "id": "ICAR-IIHR-CHILLI-ANTHRACNOSE",
        "crop": "chilli",
        "title": "ICAR-IIHR Chilli Anthracnose, Dieback & Leaf Curl Advisory",
        "source": "ICAR - Indian Institute of Horticultural Research, Bengaluru",
        "keywords": ["chilli", "anthracnose", "dieback", "fruit rot", "thrips", "leaf curl", "azoxystrobin"],
        "content": (
            "For Chilli Anthracnose & Dieback (Colletotrichum capsici), spray Azoxystrobin 23% SC @ 1.0 ml/L or "
            "Difenoconazole 25% EC @ 1.0 ml/L or Copper Oxychloride 50% WP @ 3.0 g/L at 15-day intervals during flowering and fruit set. "
            "For Chilli Leaf Curl Virus transmitted by whiteflies and thrips, spray Diafenthiuron 50% WP @ 1.2 g/L or "
            "Fipronil 5% SC @ 2.0 ml/L; maintain border crops of maize or sorghum to impede vector migration."
        ),
    },
    {
        "id": "ICAR-IIMR-MAIZE-IPM",
        "crop": "maize",
        "title": "ICAR-IIMR Maize Fall Armyworm & Common Rust Management",
        "source": "ICAR - Indian Institute of Maize Research, Ludhiana",
        "keywords": ["maize", "fall armyworm", "faw", "rust", "corn", "chlorantraniliprole", "spinetoram"],
        "content": (
            "For Fall Armyworm (FAW) in maize, inspect whorls early. Apply bio-control Metarhizium rileyi or Bacillus thuringiensis @ 2 g/L. "
            "If infestation exceeds 10%, apply Chlorantraniliprole 18.5 SC @ 0.4 ml/L or Spinetoram 11.7 SC @ 0.5 ml/L directed into the central whorl. "
            "For Maize Common Rust (Puccinia sorghi), spray Mancozeb 75% WP @ 2.5 g/L or Azoxystrobin 18.2% + Difenoconazole 11.4% SC @ 1.0 ml/L."
        ),
    },
    {
        "id": "GOI-PM-KISAN",
        "crop": "general",
        "title": "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN) Guidelines",
        "source": "Ministry of Agriculture & Farmers Welfare, Government of India",
        "keywords": ["pm-kisan", "scheme", "subsidy", "financial", "aadhaar", "direct benefit", "ekyc"],
        "content": (
            "PM-KISAN provides income support of ₹6,000 per year in three equal 4-monthly installments of ₹2,000 directly to "
            "bank accounts of eligible landholding farmer families via Direct Benefit Transfer (DBT). Mandatory requirements "
            "include Aadhaar-seeded active bank account, e-KYC verification through OTP or biometric CSC, and land registry (RoR/1B) "
            "linking with state revenue portals."
        ),
    },
    {
        "id": "GOI-PMFBY-INS",
        "crop": "general",
        "title": "Pradhan Mantri Fasal Bima Yojana (PMFBY) Crop Insurance",
        "source": "National Crop Insurance Portal, GoI",
        "keywords": ["insurance", "pmfby", "claim", "drought", "flood", "loss", "compensation", "unseasonal"],
        "content": (
            "Under PMFBY, farmers pay a uniform maximum premium of 2.0% for Kharif food crops, 1.5% for Rabi food crops, and 5% "
            "for commercial/horticultural crops. In event of localized natural calamities (hailstorm, inundation, post-harvest unseasonal rain), "
            "individual intimation must be submitted within 72 hours via the Crop Insurance App, toll-free helpline (14447), or local bank branch."
        ),
    },
    {
        "id": "KVK-SOIL-FERT",
        "crop": "general",
        "title": "Krishi Vigyan Kendra Soil Nutrient & Fertilizer Management Handout",
        "source": "District Agricultural Advisory Committee (Rayalaseema Zone)",
        "keywords": ["soil", "fertilizer", "urea", "dap", "potash", "zinc", "micronutrient", "boron", "ph"],
        "content": (
            "Always apply chemical fertilizers based on Soil Health Card recommendations. For red sandy loam soils, apply 1/3 Nitrogen "
            "and entire Phosphorus & Potash as basal at sowing. Top dress remaining Nitrogen at 30 and 50 days after weeding. For soils deficient "
            "in micronutrients, apply Zinc Sulphate (ZnSO4) @ 20 kg/acre once in 3 seasons. Never mix zinc sulphate directly with DAP."
        ),
    },
]


class AgriConnectRAGBot:
    """Enterprise RAG Bot supporting Pinecone Vector DB, Groq LLM, and resilient fallbacks."""

    _instance: Optional["AgriConnectRAGBot"] = None

    def __init__(self) -> None:
        self.pinecone_api_key = PINECONE_API_KEY
        self.groq_api_key = GROQ_API_KEY
        self.pc = None
        self.index = None
        if HAS_PINECONE and self.pinecone_api_key:
            try:
                self.pc = Pinecone(api_key=self.pinecone_api_key)
                self.index = self.pc.Index(PINECONE_INDEX_NAME)
            except Exception as e:
                print(f"[AgriConnect RAG] Pinecone init notice: {e}")

    @classmethod
    def get_instance(cls) -> "AgriConnectRAGBot":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _call_groq_llm(self, system_prompt: str, user_prompt: str) -> Optional[str]:
        """Execute high-speed inference on Groq with fallback models."""
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json",
            "User-Agent": "AgriConnect-CropDiseaseAI/2.0",
        }

        candidate_models = [GROQ_PRIMARY_MODEL] + GROQ_FALLBACK_MODELS

        for model in candidate_models:
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 1200,
            }
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers)

            try:
                with urllib.request.urlopen(req, timeout=12) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    content = res["choices"][0]["message"]["content"]
                    if content and len(content.strip()) > 10:
                        return content
            except Exception:
                continue
        return None

    def ask(self, question: str, crop: Optional[str] = None) -> Dict[str, Any]:
        """Query Pinecone vector database and synthesize answer via Groq."""
        start_time = time.time()
        context_chunks: List[str] = []
        sources: List[Dict[str, Any]] = []
        max_score = 0.0

        # Tier 1: Pinecone Hosted Inference & Retrieval
        if self.pc and self.index:
            try:
                embed_res = self.pc.inference.embed(
                    model=EMBEDDING_MODEL_NAME,
                    inputs=[question],
                    parameters={"input_type": "query", "dimension": EMBEDDING_DIM},
                )
                query_vec = embed_res[0].values

                filter_dict = None
                if crop and crop.lower() not in ("all", "general", ""):
                    filter_dict = {"crop": crop.lower()}

                search_res = self.index.query(
                    vector=query_vec,
                    top_k=3,
                    namespace=PINECONE_NAMESPACE,
                    include_metadata=True,
                    filter=filter_dict,
                )
                matches = search_res.get("matches", [])
                if not matches and filter_dict:
                    search_res = self.index.query(
                        vector=query_vec,
                        top_k=3,
                        namespace=PINECONE_NAMESPACE,
                        include_metadata=True,
                    )
                    matches = search_res.get("matches", [])

                for m in matches:
                    meta = m.get("metadata", {})
                    doc_text = meta.get("text", "")
                    if doc_text:
                        context_chunks.append(doc_text)
                    score = round(float(m.get("score", 0.0)), 4)
                    if score > max_score:
                        max_score = score
                    sources.append({
                        "title": meta.get("display_name", "Agronomic Record"),
                        "source": meta.get("source", "Agricultural Extension Manual"),
                        "relevance_score": score,
                        "excerpt": (doc_text[:240] + "...") if len(doc_text) > 240 else doc_text,
                    })
            except Exception as e:
                print(f"[AgriConnect RAG] Pinecone query fallback: {e}")

        # Tier 2: In-Memory Curated Knowledge Base Fallback if needed
        if not context_chunks:
            q_clean = question.lower()
            words = [w for w in re.sub(r"[^\w\s]", "", q_clean).split() if len(w) > 2]
            scored_docs = []

            for doc in FALLBACK_DOCUMENTS:
                score = 0.0
                doc_text = (doc["title"] + " " + doc["content"]).lower()
                for kw in doc.get("keywords", []):
                    if kw in q_clean:
                        score += 2.5
                for word in words:
                    if word in doc_text:
                        score += 1.0

                if crop and doc.get("crop", "").lower() == crop.lower():
                    score += 2.0

                if score > 1.5:
                    scored_docs.append((score, doc))

            scored_docs.sort(key=lambda x: x[0], reverse=True)
            for sc, doc in scored_docs[:3]:
                context_chunks.append(doc["content"])
                norm_score = round(min(1.0, sc / 8.0), 2)
                if norm_score > max_score:
                    max_score = norm_score
                sources.append({
                    "title": doc["title"],
                    "source": doc["source"],
                    "relevance_score": norm_score,
                    "excerpt": doc["content"][:240] + "...",
                })

        # If zero relevant context
        if not context_chunks:
            return {
                "question": question,
                "answer": (
                    "I could not locate verified agronomic extension guidance for this specific query. "
                    "To prevent crop damage or chemical misuse, unsupported advice is not generated. "
                    "Please contact your nearest Mandal Agricultural Officer or call the toll-free Kisan Call Centre at 1800-180-1551."
                ),
                "grounded": False,
                "confidence": 0.0,
                "sources": [],
                "disclaimer": DISCLAIMER_TEXT,
            }

        # Synthesize with Groq LLM
        context_str = "\n\n---\n\n".join(context_chunks)
        system_prompt = f"""You are AgriConnect AI, a senior agricultural extension scientist and plant pathologist.
Your goal is to answer the farmer's question with practical, scientifically verified guidance.

CRITICAL SAFETY & AGRONOMIC RULES:
1. Base your answer strictly on the VERIFIED AGRONOMIC CONTEXT below.
2. If chemicals (fungicides, insecticides, fertilizers) are needed:
   - Provide exact active ingredients and formulations (e.g. EC, WP, SC, FS, WG).
   - Specify precise certified dosages in ml or g per Liter of water (or kg per acre).
   - State the Pre-Harvest Interval (PHI) and safety precautions.
3. Always include sustainable organic/biological alternatives (e.g. Neem seed kernel extract, Trichoderma viride, bio-fertilizers).
4. For government schemes (PM-Kisan, PMFBY), summarize eligibility and timelines accurately.
5. Format with clear Markdown headings, bullet points, and tables.

VERIFIED AGRONOMIC CONTEXT:
{context_str}
"""

        groq_answer = self._call_groq_llm(system_prompt=system_prompt, user_prompt=question)
        if not groq_answer:
            # Fallback formatted string from top source
            groq_answer = f"Based on authoritative guidance from {sources[0]['source']}:\n\n" + "\n\n".join(context_chunks[:2])

        confidence = round(min(0.98, max(0.65, max_score * 1.4)), 2)

        return {
            "question": question,
            "answer": groq_answer,
            "grounded": True,
            "sources": sources,
            "confidence": confidence,
            "disclaimer": DISCLAIMER_TEXT,
        }

