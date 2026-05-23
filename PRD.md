# Fazgom Togo — PRD

## Problème
Plateforme mobile-first qui connecte les commerçants informels du Togo avec de jeunes diplômés Licence Comptabilité, pour des micro-missions de gestion. Garantit l'anonymat fiscal et offre des outils de gestion simplifiés (caisse, stocks, crédits, rapports).

## Personas
1. **Commerçant informel** (marchés d'Assigamé, Hedzranawoé) — smartphone-only, peur de l'OTR, besoin d'outils simples.
2. **Assistant comptable junior** (Licence) — cherche revenus et expérience.

## Architecture
- FastAPI backend + MongoDB + JWT auth
- React (CRA) frontend mobile-first
- AES-256-GCM pour chiffrement KYC
- FedaPay payment (intégré, mocké tant qu'aucune clé)
- WhatsApp OTP en mode dev (interface modulaire prête pour OpenWA/Twilio en prod)

## Implémenté (Feb 2026)
- Auth: register/login JWT par téléphone Togo (normalisation +228), OTP WhatsApp dev mode
- Profils Commerçant/Assistant + KYC chiffré (AES-256-GCM)
- Journal de caisse (entrées/sorties + résumés jour/semaine/mois)
- Gestion stocks (CRUD, ajustements, alertes rupture)
- Suivi crédits clients (CRUD, paiements partiels, statut auto)
- Rapports flash (synthèses + série quotidienne 14j, charts Recharts)
- Marketplace missions (publish, browse, apply, accept) avec tri Premium + rating
- Paiement escrow mock (FedaPay-ready) avec commission 7%
- Messagerie interne par mission
- Système de notation réciproque 1-5 étoiles
- Premium pour assistants (mise en avant)
- 34/34 tests backend e2e ✅

## Tâches en backlog (P1/P2)
- P1: Intégration FedaPay réelle (clés API à fournir par le client)
- P1: Déploiement OpenWA séparé pour vrai envoi WhatsApp OTP
- P1: Rate limiting sur OTP send
- P2: Splitter server.py en routers (auth, missions, payments, etc.)
- P2: Workflow "submit_work" assistant avant validation merchant
- P2: Validation phone +228 stricte
- P2: Rotation KYC encryption key
- P2: Dispute window (24-48h)
- P2: Frontend testing complet
- P3: Notifications push
- P3: Mode hors-ligne (PWA)
- P3: i18n Ewe/Mina
- P3: Export PDF des rapports (utile pour micro-crédit CECA/WAGES)
