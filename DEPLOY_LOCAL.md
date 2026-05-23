# Déploiement en Développement Local

Ce guide explique comment lancer et développer sur Fazgom Togo sur votre machine locale.

## Prérequis
- [Docker](https://www.docker.com/) et **Docker Compose** installés sur votre machine.

## Configuration des environnements (.env)
- **Backend** : Les configurations se trouvent dans [backend/.env](file:///Users/sefako/Documents/www/fazgom/backend/.env).
  > [!IMPORTANT]
  > Comme la base de données MongoDB tourne dans Docker mais que vous lancez l'application Python directement sur votre machine hôte, assurez-vous que `MONGO_URL` utilise `localhost` au lieu de `mongodb` :
  ```env
  MONGO_URL=mongodb://admin:adminpassword@localhost:27017/fazgom?authSource=admin
  ```
- **Frontend** : L'URL cible de l'API backend est définie dans [frontend/.env](file:///Users/sefako/Documents/www/fazgom/frontend/.env) (`REACT_APP_BACKEND_URL=http://localhost:8000`).

## Lancement des services

### 1. Démarrer MongoDB et Mongo-Express (Docker)
Lancez uniquement la base de données et l'interface d'administration en arrière-plan :
```bash
docker compose -f docker-compose-local.yml up -d
```

### 2. Démarrer le Backend FastAPI (Machine hôte)
Dans un premier terminal, activez l'environnement virtuel et lancez le serveur FastAPI en mode de rechargement automatique :
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### 3. Démarrer le Frontend Next.js (Machine hôte)
Dans un second terminal, installez les dépendances avec l'option pour éviter les conflits de peer-dependencies, puis démarrez le serveur Next.js en mode de développement :
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

## Services disponibles localement

Une fois démarrés, vous pouvez accéder aux services aux adresses suivantes :

| Service | URL locale | Description |
| :--- | :--- | :--- |
| **Frontend (React)** | [http://localhost:3000](http://localhost:3000) | Interface utilisateur web (React) |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | Documentation Swagger de l'API à [http://localhost:8000/docs](http://localhost:8000/docs) |
| **Mongo Express** | [http://localhost:8081](http://localhost:8081) | Interface d'administration MongoDB (Identifiants : `admin` / `adminpassword`) |
| **MongoDB** | `localhost:27017` | Port de la base de données exposé pour vos clients BDD (Compass, Studio 3T) |

