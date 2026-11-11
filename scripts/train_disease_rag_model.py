"""AgriConnect Crop Disease AI - Training & RAG Vector Knowledge Pipeline CLI.

Builds and trains a multi-feature vision embedding classifier and semantic RAG
knowledge store for automated crop pathology identification and extension guidance.
"""

import sys
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from app.services.crop_vision_rag import train_and_export_model, get_model_metadata


def main():
    print("=" * 65)
    print("AgriConnect AI Vision & RAG Model Training Pipeline")
    print("=" * 65)
    print("[*] Generating augmented field camera feature vectors...")
    print("[*] Computing class centroids across multi-dimensional pathology space...")
    print("[*] Validating cross-validation accuracy on test split...")
    
    artifact = train_and_export_model(samples_per_class=200)
    meta = artifact["metadata"]
    
    print("\n" + "-" * 65)
    print(f"[OK] Model Name:             {meta['model_name']}")
    print(f"[OK] Version:                {meta['version']}")
    print(f"[OK] Total Training Samples: {meta['training_samples']}")
    print(f"[OK] Classes Trained:        {len(artifact['classes'])}")
    print(f"[OK] Cross-Val Accuracy:     {meta['evaluation_accuracy_percent']}%")
    print(f"[OK] Timestamp:              {meta['trained_at']}")
    print("-" * 65)
    print("\nTrained Crop Disease Classes:")
    for c_id, c_data in artifact["classes"].items():
        print(f"  * {c_id:20} -> {c_data['disease_name']} ({c_data['crop']})")

    print("\n[OK] Training completed and model artifact exported successfully!")


if __name__ == "__main__":
    main()
