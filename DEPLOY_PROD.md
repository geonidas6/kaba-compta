# Déploiement en Production (avec Traefik)

Ce guide explique comment déployer Fazgom Togo en production ou sur un serveur de preview.

## Prérequis
- Un serveur équipé de **Docker** et **Docker Compose**.
- Un reverse-proxy **Traefik** configuré et connecté au réseau externe Docker nommé `proxy_net` (requis par le fichier compose).
- Vos noms de domaine (DNS) pointant vers l'IP de votre serveur.

## Configuration des variables d'environnement (.env)
Avant le déploiement, vous devez modifier les variables d'environnement dans le fichier [backend/.env](file:///Users/sefako/Documents/www/fazgom/backend/.env) :

1. **Identifiants de base de données** :
   Configurez les identifiants MongoDB sécurisés :
   ```env
   MONGO_USER=votre_utilisateur_mongo
   MONGO_PASSWORD=votre_mot_de_passe_securise
   MONGO_DB=fazgom
   ```

2. **Domaines de routage** :
   Modifiez les domaines pour correspondre à vos domaines réels de production :
   ```env
   DOMAIN_API=api.fazgom-togo.com
   LANDING_DOMAIN_URL=fazgom-togo.com
   DB_MANAGER_URL=db.fazgom-togo.com
   ```

3. **Sécurité et Authentification** :
   Configurez des clés secrètes solides :
   - `JWT_SECRET` : Clé de signature des jetons JWT.
   - `KYC_ENCRYPTION_KEY_B64` : Clé de chiffrement AES-256 (32 octets encodés en Base64) pour les documents KYC.

4. **Modifier le frontend** :
   Assurez-vous que le fichier [frontend/.env](file:///Users/sefako/Documents/www/fazgom/frontend/.env) pointe vers le bon sous-domaine de l'API :
   ```env
   REACT_APP_BACKEND_URL=https://api.fazgom-togo.com
   ```

## Commande de déploiement

Pour lancer la stack en arrière-plan en construisant les conteneurs optimisés pour la production :

```bash
docker compose up -d --build
```

*(Si vous utilisez une ancienne version de Docker Compose, utilisez `docker-compose up -d --build`)*

## Architecture Déployée

- **fazgom_api** : Serveur FastAPI écoutant en interne sur le port `8000`. Traefik gère automatiquement le routage SSL via le domaine spécifié par `DOMAIN_API`.
- **fazgom_frontend** : Serveur web servant l'application Next.js sur le port `3000`. Traefik gère le routage SSL via le domaine spécifié par `LANDING_DOMAIN_URL`.
- **fazgom_db** : MongoDB, non exposé sur internet (sécurisé dans le réseau privé `fazgom_backend`).
- **fazgom_mongoexpress** : Outil d'administration de la BDD accessible de manière sécurisée sous SSL via `DB_MANAGER_URL`.
