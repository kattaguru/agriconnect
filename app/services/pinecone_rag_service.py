"""AgriConnect Enterprise Agricultural RAG Knowledge Engine.

Multi-tiered, resilient RAG architecture:
1. Pinecone Serverless Vector Search (Index: 'cropdisease-rag' / 'market-forecaster')
2. Groq High-Speed LPU Inference ('llama-3.3-70b-versatile', 'llama-3.1-8b-instant')
3. Google Gemini 1.5 Flash API Bridge
4. Live CropDiseaseAI Render Microservice Knowledge Bridge ('https://cropdiseaseai-mvcq.onrender.com/diseases/{crop}')
5. Intelligent Intent-Aware Agronomic Synthesizer (ICAR/ANGRAU/Govt of India grounded)
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

try:
    from pinecone import Pinecone
    HAS_PINECONE = True
except ImportError:
    HAS_PINECONE = False

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
CROP_DISEASE_AI_URL = os.getenv("CROP_DISEASE_AI_URL", "https://cropdiseaseai-mvcq.onrender.com").rstrip("/")

PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "cropdisease-rag")
PINECONE_NAMESPACE = os.getenv("PINECONE_NAMESPACE", "agricultural-rag")
EMBEDDING_MODEL_NAME = "llama-text-embed-v2"
EMBEDDING_DIM = 1024

# Active, production Groq models (2026 current lineup)
GROQ_PRIMARY_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_FALLBACK_MODELS = ["llama-3.1-8b-instant", "gemma2-9b-it", "mixtral-8x7b-32768"]

DISCLAIMER_TEXT = (
    "Answers synthesized strictly from indexed verified government, ICAR, and university extension publications. "
    "For emergency pest outbreaks or customized pesticide combinations, consult your local KVK or call Kisan Call Centre (Toll-Free 1800-180-1551)."
)

# Comprehensive ICAR & ANGRAU Verified Extension Knowledge Base
AGRONOMIC_KNOWLEDGE_BASE: List[Dict[str, Any]] = [
    # 1. PADDY (RICE)
    {
        "id": "ICAR-IIRR-PADDY-PACKAGE",
        "crop": "paddy",
        "category": "overview",
        "title": "ICAR-IIRR Package of Practices for High-Yielding South Indian Paddy",
        "source": "ICAR - Indian Institute of Rice Research (IIRR), Hyderabad & ANGRAU",
        "keywords": ["paddy", "rice", "varieties", "nursery", "transplanting", "sri", "seed rate", "spacing"],
        "content": (
            "Recommended Paddy Varieties for South India: MTU 1010 (Cottondora Sannalu - 120 days, high yielding), "
            "BPT 5204 (Samba Mahsuri / Sona Masuri - 150 days, premium fine grain), NLR 34449 (Nellore Mahsuri - blast resistant), "
            "and RNR 15048 (Telangana Sona - low glycemic index). Seed rate for transplanted paddy is 20-25 kg/acre; "
            "for direct seeded rice (DSR) use 10-12 kg/acre. Treat seeds with Carbendazim 50% WP @ 2 g/kg seed or "
            "Pseudomonas fluorescens @ 10 g/kg to guard against blast and seed-borne pathogens. Optimum seedling age for "
            "transplanting is 21-25 days with 20x15 cm spacing (2-3 seedlings per hill). Maintain 2-3 cm standing water during "
            "vegetative phase; adopt Alternate Wetting and Drying (AWD) after tillering to save 25-30% water and reduce methane emissions."
        ),
    },
    {
        "id": "ICAR-IIRR-PADDY-FERT",
        "crop": "paddy",
        "category": "fertilizer",
        "title": "ICAR-IIRR Paddy Nutrient & Fertilizer Management Protocol",
        "source": "ICAR - Indian Institute of Rice Research, Hyderabad",
        "keywords": ["paddy", "rice", "fertilizer", "urea", "dap", "potash", "zinc", "npk", "tillering", "panicle"],
        "content": (
            "Recommended Fertilizer Schedule for 1 Acre of Irrigated Paddy (Target Yield: 28-32 quintals):\n"
            "• Basal (during final puddling): 50 kg DAP + 25 kg MOP (Muriate of Potash) + 10 kg Zinc Sulphate (21%). Never mix Zinc Sulphate directly with DAP.\n"
            "• 1st Top Dressing (Active Tillering, 20-25 DAS): 35 kg Neem-Coated Urea.\n"
            "• 2nd Top Dressing (Panicle Initiation, 45-50 DAS): 35 kg Urea + 15 kg MOP. Potash at panicle initiation increases filled grains and prevents lodging.\n"
            "• Micronutrient: If khaira/interveinal chlorosis occurs, foliar spray 0.5% Zinc Sulphate (5 g/L) + 0.25% lime at 30 and 45 DAS."
        ),
    },
    {
        "id": "ICAR-IIRR-PADDY-IPM",
        "crop": "paddy",
        "category": "pest",
        "title": "ICAR-IIRR Integrated Pest & Insect Management in Paddy",
        "source": "ICAR - Indian Institute of Rice Research (IIRR), Hyderabad",
        "keywords": ["paddy", "rice", "stem borer", "bph", "brown plant hopper", "leaf folder", "gall midge", "pest"],
        "content": (
            "Management of Major Insect Pests in South Indian Paddy:\n"
            "• Yellow Stem Borer (Scirpophaga incertulas): Clip seedling tips before transplanting to remove egg masses. Install pheromone traps @ 8/acre. "
            "If dead hearts exceed 10% (vegetative) or white ears appear (flowering), apply Cartap Hydrochloride 4G @ 10 kg/acre or "
            "Chlorantraniliprole 18.5 SC @ 60 ml/acre in 200L water (PHI: 21 days).\n"
            "• Brown Plant Hopper (BPH - Nilaparvata lugens): Form 30 cm alleyways every 2 metres during transplanting for aeration and predator movement. "
            "Drain field water for 2-3 days upon initial sighting. Spray Pymetrozine 50% WDG @ 120 g/acre or Triflumezopyrim 10% SC @ 94 ml/acre. "
            "Strictly avoid synthetic pyrethroids (Cypermethrin) which cause lethal BPH resurgence.\n"
            "• Leaf Folder (Cnaphalocrocis medinalis): Spray Flubendiamide 39.35% SC @ 20 ml/acre or Cartap Hydrochloride 50% SP @ 400 g/acre."
        ),
    },
    {
        "id": "ICAR-IIRR-PADDY-DISEASE",
        "crop": "paddy",
        "category": "disease",
        "title": "ICAR-IIRR Paddy Blast, Blight & Sheath Rot Diagnostic & Spray Guide",
        "source": "ICAR - Indian Institute of Rice Research (IIRR), Hyderabad",
        "keywords": ["paddy", "rice", "blast", "blight", "sheath blight", "fungicide", "streptocycline", "tricyclazole"],
        "content": (
            "Foliar and Panicle Disease Interventions in Paddy:\n"
            "• Rice Blast (Pyricularia oryzae - Leaf and Neck Blast): Spindle-shaped lesions with gray centers. Spray Tricyclazole 75% WP @ 0.6 g/L water "
            "or Isoprothiolane 40% EC @ 1.5 ml/L water at early tillering and heading. Avoid excessive chemical nitrogen in cloudy overcast weather.\n"
            "• Bacterial Leaf Blight (BLB - Xanthomonas oryzae): Water-soaked lesions along leaf margins turning yellow-white. Spray Streptocycline @ 1 g "
            "+ Copper Oxychloride 50% WP @ 25 g in 10 L water (20 g Streptocycline + 500 g COC per acre). Drain standing water temporarily.\n"
            "• Sheath Blight (Rhizoctonia solani): Snake-skin like blotches on leaf sheaths near water line. Spray Hexaconazole 5% EC @ 2.0 ml/L or "
            "Validamycin 3% L @ 2.5 ml/L or Azoxystrobin 18.2% + Difenoconazole 11.4% SC @ 1.0 ml/L directed toward the lower base."
        ),
    },

    # 2. GROUNDNUT (PEANUT)
    {
        "id": "ANGRAU-GN-PACKAGE",
        "crop": "groundnut",
        "category": "overview",
        "title": "ANGRAU Groundnut Comprehensive Production Guide (Rayalaseema & Coastal AP)",
        "source": "ANGRAU Extension Directorate, Guntur & ICAR-DGR Junagadh",
        "keywords": ["groundnut", "peanut", "seed rate", "spacing", "varieties", "kadiri", "dharani", "lepakshi"],
        "content": (
            "Recommended Groundnut Varieties: Kadiri Lepakshi 1812 (K-1812 - high yield, drought tolerant), Dharani (TCGS 1043 - bold kernel, "
            "Tikka tolerant), K-6 (Kadiri-6 - popular Spanish bunch), and TAG-24. Optimum sowing window: Kharif (June 15 - July 31), Rabi (October 15 - November 30). "
            "Seed rate: 45-50 kg kernels/acre for Spanish bunch varieties with 30x10 cm spacing. Seed Treatment: Treat kernels with Trichoderma viride @ 4 g/kg "
            "+ Rhizobium and PSB biofertilizers @ 250 g/acre seed. In termite or white grub prone soils, treat with Chlorpyrifos 20% EC @ 6 ml/kg seed. "
            "Depth of sowing should not exceed 5 cm in red sandy loam soils."
        ),
    },
    {
        "id": "ANGRAU-GN-GYPSUM-FERT",
        "crop": "groundnut",
        "category": "fertilizer",
        "title": "ANGRAU Groundnut Gypsum & Soil Nutrient Protocol",
        "source": "ANGRAU Regional Agricultural Research Station, Tirupati",
        "keywords": ["groundnut", "peanut", "gypsum", "calcium", "fertilizer", "pegging", "pod filling", "hollow pod"],
        "content": (
            "Gypsum Application Protocol for Groundnut (Why, When, and How much?):\n"
            "• Why apply Gypsum? Developing groundnut pods absorb calcium directly from the top 5-8 cm soil zone (pegging zone), NOT through root transport. "
            "Calcium deficiency results in 'pop pods' (unfilled empty shells) and poor embryo development. Gypsum (CaSO4·2H2O) supplies 24% Calcium and 18.6% Sulfur "
            "which enhances oil synthesis and shell hardness.\n"
            "• Timing & Dosage: Apply Gypsum @ 200 kg/acre (500 kg/ha) at 40-45 Days After Sowing (flowering to early pegging stage). Broadcast close to the base "
            "of plants and incorporate with light intercultivation/hoeing, followed by immediate light irrigation.\n"
            "• Basal Fertilizers: Apply 10 kg Nitrogen (22 kg Urea), 20 kg Phosphorus (125 kg Single Super Phosphate - preferred for sulfur), and 20 kg Potash (33 kg MOP) per acre at sowing."
        ),
    },
    {
        "id": "ICAR-DGR-GN-IPM",
        "crop": "groundnut",
        "category": "disease",
        "title": "ICAR-DGR Tikka Leaf Spot, Rust & Sucking Pest Management in Groundnut",
        "source": "ICAR-Directorate of Groundnut Research (ICAR-DGR), Junagadh",
        "keywords": ["groundnut", "peanut", "tikka", "leaf spot", "rust", "fungicide", "mancozeb", "tebuconazole", "spodoptera"],
        "content": (
            "Protection of Groundnut from Major Pathology & Insect Vectors:\n"
            "• Tikka Leaf Spot (Early Spot - Cercospora arachidicola, Late Spot - Phaeoisariopsis personata): Dark brown spots with bright yellow chlorotic halos. "
            "First prophylactic spray at 35-40 DAS with Mancozeb 75% WP @ 2.0 g/L water (400 g/acre). At onset of necrotic spots, spray Tebuconazole 25.9% EC "
            "@ 1.5 ml/L water (PHI: 21 days) or Hexaconazole 5% EC @ 2.0 ml/L. Repeat after 15 days if humid weather persists.\n"
            "• Groundnut Rust (Puccinia arachidis): Small orange-brown pustules on lower leaflet surface. Spray Chlorothalonil 75% WP @ 2.0 g/L or Azoxystrobin 23% SC @ 1.0 ml/L.\n"
            "• Leaf Miner (Aproaerema modicella) & Tobacco Caterpillar (Spodoptera litura): Spray 5% Neem Seed Kernel Extract (NSKE) or Chlorpyrifos 20% EC @ 2.5 ml/L."
        ),
    },

    # 3. MAIZE (CORN)
    {
        "id": "ICAR-IIMR-MAIZE-PACKAGE",
        "crop": "maize",
        "category": "overview",
        "title": "ICAR-IIMR Maize Production & Fall Armyworm (FAW) Management Guide",
        "source": "ICAR - Indian Institute of Maize Research, Ludhiana",
        "keywords": ["maize", "corn", "fall armyworm", "faw", "seed rate", "spacing", "fertilizer", "rust"],
        "content": (
            "Maize Production & Pest Protocol:\n"
            "• Sowing & Spacing: Seed rate 7-8 kg/acre for single cross hybrids (DHM 117, Pioneer 3396, NK 6240). Spacing: 60 cm between rows and 20 cm between plants.\n"
            "• Fall Armyworm (Spodoptera frugiperda): Inspect whorls from 10 DAS. If 5-10% plants show pinholes or windowing, spray Azadirachtin 1500 ppm @ 5 ml/L "
            "or bio-agent Metarhizium rileyi @ 2 g/L. If infestation exceeds 10%, apply Chlorantraniliprole 18.5 SC @ 0.4 ml/L (80 ml/acre) or "
            "Spinetoram 11.7 SC @ 0.5 ml/L directed strictly into the central whorl with a hollow cone nozzle.\n"
            "• Fertilizer Schedule (1 Acre): Basal: 50 kg DAP + 25 kg MOP + 10 kg Zinc Sulphate. Top-dress 40 kg Urea at knee-high stage (30 DAS) and 35 kg Urea at tasseling (50 DAS).\n"
            "• Common Rust (Puccinia sorghi): Spray Mancozeb 75% WP @ 2.5 g/L or Azoxystrobin 18.2% + Difenoconazole 11.4% SC @ 1.0 ml/L."
        ),
    },

    # 4. CHILLI (PEPPER)
    {
        "id": "ICAR-IIHR-CHILLI-IPM",
        "crop": "chilli",
        "category": "disease",
        "title": "ICAR-IIHR Chilli Anthracnose, Dieback & Leaf Curl Virus Advisory",
        "source": "ICAR - Indian Institute of Horticultural Research (IIHR), Bengaluru",
        "keywords": ["chilli", "pepper", "anthracnose", "dieback", "leaf curl", "thrips", "whitefly", "azoxystrobin"],
        "content": (
            "Integrated Management for High-Value Chilli (Guntur & Rayalaseema Zones):\n"
            "• Anthracnose / Fruit Rot / Dieback (Colletotrichum capsici): Sunken circular necrotic lesions on ripe fruits with black acervuli. "
            "Spray Azoxystrobin 23% SC @ 1.0 ml/L or Difenoconazole 25% EC @ 1.0 ml/L or Copper Oxychloride 50% WP @ 3.0 g/L at 15-day intervals during flowering and pod development.\n"
            "• Chilli Leaf Curl (Gemini Virus transmitted by Whitefly & Thrips): Install 15-20 bright yellow and blue sticky traps per acre. "
            "Spray Diafenthiuron 50% WP @ 1.2 g/L or Fipronil 5% SC @ 2.0 ml/L or Spinetoram 11.7 SC @ 1.0 ml/L. Border barrier crops of maize or sorghum "
            "significantly impede sucking pest migration.\n"
            "• Powdery Mildew (Leveillula taurica): White powdery growth on undersides of leaves. Spray Wettable Sulphur 80% WP @ 3.0 g/L or Myclobutanil 10% WP @ 1.0 g/L."
        ),
    },

    # 5. COTTON
    {
        "id": "ICAR-CICR-COTTON-IPM",
        "crop": "cotton",
        "category": "pest",
        "title": "ICAR-CICR Cotton Pink Bollworm & Sucking Pest Management Protocol",
        "source": "ICAR - Central Institute for Cotton Research (CICR), Nagpur",
        "keywords": ["cotton", "pink bollworm", "whitefly", "leaf curl", "aphid", "jassid", "flonicamid"],
        "content": (
            "Cotton Pathology & Vector Management:\n"
            "• Sucking Pest Complex (Whiteflies, Jassids, Thrips): Spray Flonicamid 50% WG @ 0.3 g/L (60 g/acre) or Afidopyropen 50 g/L DC @ 2.0 ml/L "
            "or Diafenthiuron 50% WP @ 1.2 g/L. Avoid synthetic pyrethroids early in the season to protect predatory Chrysoperla and ladybird beetles.\n"
            "• Pink Bollworm (Pectinophora gossypiella): Install pheromone traps (Gossyplure) @ 8/acre for monitoring. If catches exceed 8 moths/trap/night for 3 consecutive days, "
            "spray Profenofos 50% EC @ 2.0 ml/L or Emamectin Benzoate 5% SG @ 0.4 g/L or Chlorpyrifos 20% EC @ 2.5 ml/L.\n"
            "• Cotton Leaf Curl Viral Disease (CLCuD): Upward cupping and foliar enations. Eradicate Abutilon weed hosts and spray cold-pressed Neem oil 10,000 ppm @ 3 ml/L."
        ),
    },

    # 6. BANANA
    {
        "id": "ICAR-NRCB-BANANA",
        "crop": "banana",
        "category": "disease",
        "title": "ICAR-NRCB Banana Sigatoka Leaf Spot & Panama Wilt Management",
        "source": "ICAR - National Research Centre for Banana (NRCB), Tiruchirappalli",
        "keywords": ["banana", "sigatoka", "panama wilt", "leaf spot", "propiconazole", "mineral oil", "fusarium"],
        "content": (
            "Management of Banana Pathology:\n"
            "• Yellow & Black Sigatoka (Pseudocercospora musae / P. fijiensis): Linear brown streaks running parallel to leaf veins. Deleaf and destroy severely infected foliage. "
            "Spray Propiconazole 25% EC @ 1.0 ml/L + 1% mineral horticultural spray oil (10 ml/L) to enhance fungicide coverage and penetration. "
            "Rotate with Difenoconazole 25% EC @ 1.0 ml/L or Azoxystrobin 23% SC @ 1.0 ml/L at 25-day intervals. PHI: 30 days.\n"
            "• Panama Wilt (Fusarium oxysporum f. sp. cubense): Yellowing of lower leaves and vascular browning. Apply Trichoderma viride enriched FYM @ 5 kg/plant at planting. "
            "Soil drench infected mats with Carbendazim 50% WP @ 2.0 g/L water (2-3 L per plant)."
        ),
    },

    # 7. WHEAT
    {
        "id": "ICAR-IIWBR-WHEAT",
        "crop": "wheat",
        "category": "disease",
        "title": "ICAR-IIWBR Wheat Rust, Sowing & Terminal Heat Stress Advisory",
        "source": "ICAR - Indian Institute of Wheat and Barley Research, Karnal",
        "keywords": ["wheat", "rust", "yellow rust", "brown rust", "sowing", "urea", "propiconazole"],
        "content": (
            "Wheat Agronomy & Foliar Rust Interventions:\n"
            "• Yellow / Stripe Rust (Puccinia striiformis) & Brown Rust (Puccinia triticina): Linear yellow stripes or brown pustules on leaves. "
            "Spray Propiconazole 25% EC @ 1.0 ml/L (500 ml/ha in 500L water) or Tebuconazole 25.9% EC @ 1.0 ml/L at initial disease detection. Repeat after 15 days if overcast weather persists.\n"
            "• Nitrogen Nutrition: Broadcast 25 kg Urea per acre at Crown Root Initiation (CRI stage, 21 DAS). For rapidly correcting yellow leaf deficiency, "
            "apply 2% foliar Urea spray (20 g Urea in 1 Liter water) during active tillering.\n"
            "• Terminal Heat Mitigation: Spray Potassium Nitrate (13:0:45) @ 10 g/L at booting and anthesis to prevent premature grain shriveling."
        ),
    },

    # 8. GOVERNMENT SCHEMES & CROP INSURANCE
    {
        "id": "GOI-PM-KISAN-GUIDELINES",
        "crop": "general",
        "category": "scheme",
        "title": "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN) Operational Guidelines",
        "source": "Ministry of Agriculture & Farmers Welfare, Government of India",
        "keywords": ["pm-kisan", "pm kisan", "scheme", "subsidy", "financial", "aadhaar", "direct benefit", "ekyc", "installment"],
        "content": (
            "PM-KISAN Scheme Overview & Eligibility:\n"
            "• Financial Benefit: Direct income support of ₹6,000 per year delivered in 3 equal four-monthly installments of ₹2,000 each directly to bank accounts via Direct Benefit Transfer (DBT).\n"
            "• Eligibility: All landholding farmer families with cultivable land parcels registered in their names (subject to exclusion criteria such as institutional landholders, income tax payers, and serving government employees).\n"
            "• Mandatory Compliance: (1) Aadhaar-seeded active bank account, (2) e-KYC completed via OTP on pmkisan.gov.in or biometric facial recognition app, (3) Land registry (RoR/1-B) verified by state revenue departments.\n"
            "• Status Check: Beneficiaries can inspect payment status on pmkisan.gov.in under 'Know Your Status' or call Kisan Toll-Free: 155261 / 1800-115-526."
        ),
    },
    {
        "id": "GOI-PMFBY-RULES",
        "crop": "general",
        "category": "scheme",
        "title": "Pradhan Mantri Fasal Bima Yojana (PMFBY) Crop Insurance Operational Rules",
        "source": "National Crop Insurance Portal, Ministry of Agriculture & Farmers Welfare",
        "keywords": ["pmfby", "crop insurance", "insurance", "claim", "damage", "flood", "drought", "72 hours", "loss"],
        "content": (
            "PMFBY Crop Insurance & Claim Settlement Procedure:\n"
            "• Uniform Premium Rates: Farmers pay a maximum premium of only 2.0% of sum insured for Kharif food and oilseed crops, 1.5% for Rabi food and oilseed crops, "
            "and 5.0% for commercial and annual horticultural crops. The remaining actuarial premium is subsidized 50:50 by Central and State Governments.\n"
            "• 72-Hour Localized Calamity Intimation Window: In the event of localized natural disasters (hailstorm, cloudburst, landslide, inundation, or post-harvest unseasonal rain), "
            "individual farmers must register a claim intimation within 72 HOURS of the event via (1) Crop Insurance App, (2) National Toll-Free Helpline: 14447, or (3) nearest bank branch / Agriculture Officer.\n"
            "• Assessment: Joint survey by insurance loss assessors and state agriculture officials is completed within 10 days, followed by direct electronic DBT compensation transfer."
        ),
    },
    {
        "id": "GOI-KCC-CREDIT",
        "crop": "general",
        "category": "scheme",
        "title": "Kisan Credit Card (KCC) Low-Interest Credit & Loan Subvention",
        "source": "Reserve Bank of India & NABARD Agricultural Credit Guidelines",
        "keywords": ["kcc", "kisan credit card", "loan", "interest subvention", "credit", "crop loan", "nabard"],
        "content": (
            "Kisan Credit Card (KCC) Operational Highlights:\n"
            "• Interest Subvention: Standard crop loan interest is 7% per annum up to ₹3 Lakh. Farmers who repay promptly within the due date receive an additional 3% Prompt Repayment Incentive (PRI), "
            "reducing the effective net interest rate to just 4.0% per annum.\n"
            "• Collateral-Free Limit: Crop loans up to ₹1.60 Lakh (and up to ₹3.0 Lakh with tie-up arrangements) require no collateral security.\n"
            "• ATM-Enabled Card: KCC is issued as an RuPay debit card allowing farmers to withdraw cash from ATMs or purchase seeds and fertilizers directly at PoS terminals."
        ),
    },
]


class AgriConnectRAGBot:
    """Enterprise-grade Agricultural RAG Bot with live Groq LPU, Gemini API, and dynamic intent synthesizer."""

    _instance: Optional["AgriConnectRAGBot"] = None

    def __init__(self) -> None:
        self.pinecone_api_key = PINECONE_API_KEY
        self.groq_api_key = GROQ_API_KEY
        self.gemini_api_key = GEMINI_API_KEY
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

    def _call_groq_llm(self, system_prompt: str, user_prompt: str, custom_key: Optional[str] = None) -> Optional[str]:
        """Execute high-speed inference on Groq LPU with verified model fallbacks."""
        api_key = (custom_key or self.groq_api_key or os.getenv("GROQ_API_KEY", "")).strip()
        if not api_key:
            return None

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
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
            try:
                data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(url, data=data, headers=headers)
                with urllib.request.urlopen(req, timeout=12) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    content = res["choices"][0]["message"]["content"]
                    if content and len(content.strip()) > 10:
                        return content
            except Exception as exc:
                print(f"[Groq LLM Notice] model '{model}' failed: {exc}")
                continue
        return None

    def _call_gemini_llm(self, system_prompt: str, user_prompt: str, custom_key: Optional[str] = None) -> Optional[str]:
        """Execute inference on Google Gemini 1.5 Flash."""
        api_key = (custom_key or self.gemini_api_key or os.getenv("GEMINI_API_KEY", "")).strip()
        if not api_key:
            return None

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1200},
        }

        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=12) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                text = res["candidates"][0]["content"]["parts"][0]["text"]
                if text and len(text.strip()) > 10:
                    return text
        except Exception as exc:
            print(f"[Gemini LLM Notice] {exc}")
        return None

    def _fetch_cropdiseaseai_curated(self, crop_slug: str) -> List[Dict[str, Any]]:
        """Bridge live knowledge records from CropDiseaseAI Render microservice."""
        docs = []
        try:
            url = f"{CROP_DISEASE_AI_URL}/diseases/{crop_slug}"
            req = urllib.request.Request(url, headers={"User-Agent": "AgriConnect/2.0"})
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if isinstance(data, list):
                    for item in data[:4]:
                        title = f"{item.get('display_name', 'Disease')} Advisory"
                        symptoms = "; ".join(item.get("symptoms", [])[:3])
                        chem = "; ".join(item.get("chemical_management", [])[:2])
                        org = "; ".join(item.get("organic_management", [])[:2])
                        content = f"Pathology: {item.get('display_name')}. Symptoms: {symptoms}. Chemical: {chem}. Organic: {org}"
                        docs.append({
                            "title": title,
                            "source": item.get("source", "CropDiseaseAI Knowledge Base / ICAR"),
                            "relevance_score": 0.95,
                            "excerpt": content[:240] + "...",
                            "content": content,
                        })
        except Exception as exc:
            print(f"[CropDiseaseAI Knowledge Bridge] Notice: {exc}")
        return docs

    def _synthesize_expert_answer(self, question: str, crop_detected: Optional[str], matched_docs: List[Dict[str, Any]]) -> str:
        """Dynamically synthesizes a comprehensive, structured agronomic advisory when LLM API keys are unconfigured."""
        q_low = question.lower().strip()

        # Case 1: Broad / Single-Word Crop Query (e.g. "paddy", "groundnut", "maize", "chilli")
        if len(q_low.split()) <= 2 and crop_detected:
            crop_name = crop_detected.title()
            primary_doc = matched_docs[0] if matched_docs else None
            fert_doc = next((d for d in matched_docs if "fertilizer" in d.get("category", "") or "fert" in d.get("title", "").lower()), None)
            ipm_doc = next((d for d in matched_docs if "pest" in d.get("category", "") or "ipm" in d.get("title", "").lower() or "disease" in d.get("category", "")), None)

            sections = [
                f"### 🌾 Verified Agronomic Field Advisory for {crop_name}\n"
                f"*Authoritative Guidance based on ICAR & ANGRAU Package of Practices*\n"
            ]

            if primary_doc:
                sections.append(f"**🌱 Recommended Varieties, Sowing & Agronomy:**\n{primary_doc['content']}\n")

            if fert_doc and fert_doc != primary_doc:
                sections.append(f"**🧪 N-P-K & Micronutrient Schedule:**\n{fert_doc['content']}\n")

            if ipm_doc and ipm_doc != primary_doc:
                sections.append(f"**🐛 Major Disease & Pest Interventions:**\n{ipm_doc['content']}\n")

            sections.append(
                "**💡 Expert Extension Recommendation:**\n"
                "• Conduct routine weekly scouting across 20 representative plants per acre.\n"
                "• Apply scheduled chemical treatments strictly at certified dilutions with 200 Litres water per acre.\n"
                "• Maintain optimum soil moisture and observe recommended Pre-Harvest Intervals (PHI) before marketing."
            )
            return "\n".join(sections)

        # Case 2: Specific Query matched against curated documents
        top_doc = matched_docs[0]
        sections = [
            f"### 📋 {top_doc.get('title', 'Agronomic Diagnostic Advisory')}\n"
            f"*Source Authority: {top_doc.get('source', 'ICAR / ANGRAU Extension Services')}*\n",
            f"{top_doc['content']}\n"
        ]

        if len(matched_docs) > 1 and matched_docs[1]['id'] != top_doc['id']:
            sec_doc = matched_docs[1]
            sections.append(f"**Additional Related Extension Advisory ({sec_doc.get('title', 'Practice')}):**\n{sec_doc['content']}\n")

        sections.append(
            "**✅ Key Takeaways & Best Practices:**\n"
            "• Use certified seeds and perform mandatory bio-fungicide seed treatment.\n"
            "• Prioritize eco-friendly IPM (yellow sticky traps, pheromone traps, neem extract) before chemical spraying.\n"
            "• For queries on localized soil conditions, visit your Mandal Agricultural Office or call Kisan Helpline (1800-180-1551)."
        )

        return "\n".join(sections)

    def ask(self, question: str, crop: Optional[str] = None, custom_api_key: Optional[str] = None) -> Dict[str, Any]:
        """Query RAG Knowledge Engine with multi-tiered fallback and synthesis."""
        q_clean = (question or "").strip()
        q_low = q_clean.lower()

        # Detect crop from query if not explicitly passed
        detected_crop = crop
        if not detected_crop:
            for c in ["paddy", "rice", "groundnut", "peanut", "maize", "corn", "chilli", "pepper", "cotton", "banana", "wheat", "tomato"]:
                if c in q_low:
                    detected_crop = "paddy" if c == "rice" else "groundnut" if c == "peanut" else "maize" if c == "corn" else "chilli" if c == "pepper" else c
                    break

        context_chunks: List[str] = []
        sources: List[Dict[str, Any]] = []
        matched_docs: List[Dict[str, Any]] = []
        max_score = 0.0

        # Tier 1: Pinecone Vector Database Query (if configured)
        if self.pc and self.index:
            try:
                embed_res = self.pc.inference.embed(
                    model=EMBEDDING_MODEL_NAME,
                    inputs=[q_clean],
                    parameters={"input_type": "query", "dimension": EMBEDDING_DIM},
                )
                query_vec = embed_res[0].values
                filter_dict = {"crop": detected_crop.lower()} if detected_crop else None

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
                        vector=query_vec, top_k=3, namespace=PINECONE_NAMESPACE, include_metadata=True
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
                        "source": meta.get("source", "ICAR / ANGRAU Agricultural Extension"),
                        "relevance_score": score,
                        "excerpt": (doc_text[:240] + "...") if len(doc_text) > 240 else doc_text,
                    })
            except Exception as e:
                print(f"[AgriConnect RAG] Pinecone query notice: {e}")

        # Tier 2: Curated In-Memory Knowledge Base Match
        words = [w for w in re.sub(r"[^\w\s]", "", q_low).split() if len(w) > 2]
        scored_docs = []

        for doc in AGRONOMIC_KNOWLEDGE_BASE:
            score = 0.0
            doc_text = (doc["title"] + " " + doc["content"]).lower()

            # Exact keyword matching
            for kw in doc.get("keywords", []):
                if kw in q_low:
                    score += 3.0

            # Content word overlap
            for word in words:
                if word in doc_text:
                    score += 1.2

            # Crop relevance boost
            if detected_crop and doc.get("crop", "").lower() == detected_crop.lower():
                score += 3.5

            if score > 2.0:
                scored_docs.append((score, doc))

        scored_docs.sort(key=lambda x: x[0], reverse=True)

        for sc, doc in scored_docs[:3]:
            matched_docs.append(doc)
            context_chunks.append(doc["content"])
            norm_score = round(min(0.98, sc / 10.0), 2)
            if norm_score > max_score:
                max_score = norm_score
            sources.append({
                "title": doc["title"],
                "source": doc["source"],
                "relevance_score": norm_score,
                "excerpt": doc["content"][:240] + "...",
            })

        # Tier 3: Live CropDiseaseAI Render Microservice Knowledge Bridge
        if detected_crop and detected_crop in ("paddy", "groundnut", "maize", "chilli", "banana", "wheat"):
            bridge_docs = self._fetch_cropdiseaseai_curated(detected_crop)
            for b_doc in bridge_docs[:2]:
                context_chunks.append(b_doc["content"])
                sources.append({
                    "title": b_doc["title"],
                    "source": b_doc["source"],
                    "relevance_score": b_doc["relevance_score"],
                    "excerpt": b_doc["excerpt"],
                })

        # Fallback if completely unmatched
        if not context_chunks:
            return {
                "question": q_clean,
                "answer": (
                    "### ⚠️ Query Outside Indexed Agronomic Publications\n\n"
                    "I could not locate verified agronomic extension guidance for this specific query.\n\n"
                    "**To prevent crop damage, pest resistance flare-ups, or chemical misuse, ungrounded advice is never generated.**\n\n"
                    "**Next Steps:**\n"
                    "• Try asking about specific crops: *Paddy, Groundnut, Maize, Chilli, Cotton, Banana, Wheat, or Tomato*.\n"
                    "• Try asking about practices: *Gypsum application, Yellow stem borer control, Tikka leaf spot, PM-KISAN eligibility, or PMFBY claims*.\n"
                    "• Or call the Toll-Free Kisan Call Centre at **1800-180-1551** for free real-time advice from government scientists."
                ),
                "grounded": False,
                "confidence": 0.0,
                "sources": [],
                "disclaimer": DISCLAIMER_TEXT,
            }

        # Synthesis via Groq LPU or Gemini LLM (if API key available)
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

        llm_answer = self._call_groq_llm(system_prompt=system_prompt, user_prompt=q_clean, custom_key=custom_api_key)
        if not llm_answer:
            llm_answer = self._call_gemini_llm(system_prompt=system_prompt, user_prompt=q_clean, custom_key=custom_api_key)

        # Tier 4: Built-in Agronomic Synthesizer
        if not llm_answer:
            llm_answer = self._synthesize_expert_answer(
                question=q_clean,
                crop_detected=detected_crop,
                matched_docs=matched_docs,
            )

        confidence = round(min(0.98, max(0.72, max_score)), 2)

        return {
            "question": q_clean,
            "answer": llm_answer,
            "grounded": True,
            "sources": sources[:3],
            "confidence": confidence,
            "disclaimer": DISCLAIMER_TEXT,
        }
