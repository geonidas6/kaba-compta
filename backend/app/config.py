import os
import base64
import logging
from pathlib import Path
from dotenv import load_dotenv

# Since config.py is in backend/app/, the directory containing .env is backend/
BACKEND_DIR = Path(__file__).parent.parent
load_dotenv(BACKEND_DIR / '.env')

# ===== MongoDB Config =====
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

# ===== JWT Config =====
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRE_DAYS = int(os.environ.get('JWT_EXPIRE_DAYS', '30'))

# ===== KYC Crypto Config =====
KYC_KEY = base64.b64decode(os.environ['KYC_ENCRYPTION_KEY_B64'])

# ===== Logging =====
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("fazgom")
