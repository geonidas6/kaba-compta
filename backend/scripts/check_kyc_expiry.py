import sys
import os
import asyncio

# S'assurer que le dossier racine du backend est dans le path Python
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.helpers import check_and_expire_kyc

async def main():
    print("Démarrage de la tâche de vérification KYC...")
    try:
        await check_and_expire_kyc()
        print("Tâche KYC terminée avec succès.")
    except Exception as e:
        print(f"Erreur lors de l'exécution de la tâche KYC : {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
