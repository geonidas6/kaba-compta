# Cahier fonctionnel révisé — Plateforme forum + mise en relation comptables / clients

## Objectif général

Transformer le site actuel en une plateforme principalement orientée **forum communautaire** avec une fonctionnalité de **mise en relation entre clients et comptables/freelances**.

La plateforme ne doit plus gérer l’activité interne des clients ni les paiements de projets. Elle doit permettre aux clients de publier des missions, aux freelances/comptables de postuler avec une proposition commerciale, puis aux deux parties d’échanger directement.

---

## 1. Fonctionnalités à retirer du site actuel

### 1.1 Paiement des projets par les clients

Supprimer la fonctionnalité actuelle qui permet aux clients de payer les projets directement sur la plateforme.

Les paiements liés aux missions se feront désormais **en dehors de la plateforme**, directement entre le client et le prestataire.

La plateforme ne doit donc plus gérer :

* le paiement du client pour une mission ;
* le séquestre ou blocage de fonds ;
* le paiement automatique du freelance ;
* les commissions prélevées sur les projets ;
* les factures liées aux missions ;
* les remboursements ou litiges financiers liés aux projets.

### 1.2 Gestion de l’activité du client

Retirer les fonctionnalités liées à la gestion interne de l’activité du client.

À supprimer notamment :

* gestion de stock ;
* gestion commerciale avancée ;
* gestion comptable interne du client ;
* tableaux de bord métier complexes ;
* outils de suivi d’activité non liés à la publication de missions ;
* modules de gestion opérationnelle destinés au client.

Le client doit uniquement pouvoir utiliser la plateforme pour :

* poser des questions sur le forum ;
* publier une annonce ou une mission ;
* recevoir des candidatures ;
* échanger avec les freelances/comptables ;
* choisir un prestataire ;
* laisser un avis après collaboration.

---

## 2. Fonctionnalités à conserver

### 2.1 Mise en avant des profils freelances

Conserver la fonctionnalité permettant aux freelances/comptables de mettre en avant leur profil.

Cette mise en avant peut rester payante si elle existe déjà.

Elle permet aux freelances d’obtenir plus de visibilité dans :

* les résultats de recherche ;
* les listes de profils ;
* les suggestions de prestataires ;
* les zones mises en avant sur la plateforme.

---

## 3. Positionnement de la nouvelle application

L’application doit être pensée avant tout comme un **forum communautaire orienté comptabilité**, avec un système de mise en relation intégré.

La priorité du produit doit être donnée au forum, tandis que les fonctionnalités de mission et de recrutement doivent rester présentes mais secondaires.

L’application doit donc être pensée comme :

1. un **forum communautaire simple, moderne et intuitif** (fonction principale) ;
2. une plateforme de **mise en relation client ↔ comptable/freelance** (fonction secondaire mais importante) ;
3. un espace où les utilisateurs peuvent poser des questions, obtenir des réponses, publier des missions et entrer en contact.

### 3.1 Mise en avant du forum

Le forum doit être fortement mis en avant dans l’expérience utilisateur.

L’objectif est de créer une plateforme active où les utilisateurs viennent régulièrement poser des questions et échanger, même lorsqu’ils n’ont pas immédiatement besoin d’un prestataire.

Le forum doit servir à :

* attirer du trafic régulier ;
* fidéliser les utilisateurs ;
* construire une communauté ;
* démontrer l’expertise des comptables ;
* générer naturellement des opportunités de mission.

### 3.2 Logique de fonctionnement du forum

Les comptes utilisateurs doivent rester conservés dans le contexte global de la plateforme.

Un utilisateur possède un seul compte qui lui permet :

* de participer au forum ;
* de publier une mission ;
* de répondre à une mission ;
* de discuter avec un client ou un freelance ;
* de recevoir des notifications.

Les profils forum et les profils de mise en relation doivent rester liés au même compte utilisateur.

### 3.3 Navigation et hiérarchie produit

L’interface doit donner plus de visibilité au forum qu’aux missions.

Exemple de hiérarchie recommandée :

* Accueil orienté forum ;
* Questions récentes ;
* Questions populaires ;
* Catégories comptables ;
* Comptables actifs ;
* Section missions/opportunités ;
* Publier une mission.

La logique doit se rapprocher d’un fonctionnement type **Codeur.com** pour la partie mission :

* le client publie une mission ;
* les freelances/comptables postulent ;
* chaque freelance peut proposer un prix ;
* le client compare les offres ;
* le client choisit un prestataire ;
* les échanges se font via une discussion privée ;
* les paiements se font hors plateforme.

---

## 4. Profils utilisateurs

### 4.1 Profil client — partie mise en relation

Le profil client doit contenir :

* nom ;
* numéro de téléphone ;
* adresse e-mail ;
* activité économique ;
* lieu de travail.

### 4.2 Profil client — partie forum

Sur le forum, le profil client doit rester simple et afficher uniquement :

* photo ;
* nom.

### 4.3 Profil comptable / freelance — partie mise en relation

Le comptable/freelance doit pouvoir compléter son profil avec :

* coordonnées ;
* diplômes ;
* expériences professionnelles ;
* certifications ;
* biographie ;
* domaines de compétence ;
* niveau d’expérience : junior, intermédiaire ou senior.

### 4.4 Profil comptable / freelance — partie forum

Sur le forum, le profil du comptable doit afficher simplement :

* nom ;
* photo ;
* qualité ou statut de comptable.

---

## 5. Module forum

Le forum est l’élément central de l’application.

### 5.1 Fonctionnalités du forum

Les utilisateurs doivent pouvoir :

* soumettre une question ;
* ajouter une photo à une question, si nécessaire ;
* répondre aux questions ;
* consulter les questions et réponses publiées ;
* identifier simplement l’auteur de la question ou de la réponse.

### 5.2 Fonctionnalités à limiter sur le forum

Le forum doit rester simple. Il ne faut pas ajouter de fonctionnalités complexes au lancement.

À éviter au démarrage :

* gestion avancée de catégories trop nombreuses ;
* messagerie complexe dans le forum public ;
* système de badges trop poussé ;
* notation publique excessive ;
* fonctionnalités sociales non essentielles.

### 5.3 Design du forum

Le forum doit avoir un design :

* simple ;
* intuitif ;
* moderne ;
* responsive ;
* facile à utiliser sur mobile.

---

## 6. Module de publication de mission

### 6.1 Soumission d’une annonce par un client

Pour publier une mission, le client doit renseigner :

* titre de l’annonce ;
* type de service comptable recherché ;
* description du besoin ;
* fourchette de prix ;
* type de contrat : saisonnier, stage, CDD, CDI, mission ponctuelle ;
* niveau recherché : junior, intermédiaire ou senior ;
* lieu ou possibilité de travail à distance ;
* durée estimée du projet ;
* délai souhaité de démarrage ou de livraison.

### 6.2 Statuts d’une mission

Une mission peut avoir les statuts suivants :

* **ouverte** : la mission vient d’être publiée, les freelances peuvent faire une offre ;
* **en discussion** : le client échange avec un ou plusieurs freelances ayant fait une offre ;
* **en travail** : le client a choisi un freelance, la mission est attribuée et plus aucune nouvelle offre ne peut être envoyée ;
* **terminée** : le client confirme que la mission est terminée ;
* **annulée** : la mission est fermée sans prestataire retenu.

### 6.3 Notification après publication

Lorsqu’une nouvelle mission est publiée, les freelances/comptables concernés doivent recevoir une notification.

La notification peut être envoyée selon les critères de correspondance suivants :

* domaine de compétence ;
* type de service comptable ;
* niveau d’expérience ;
* localisation ou disponibilité à distance.

---

## 7. Candidature des freelances / comptables

### 7.1 Soumission d’une offre

Un freelance/comptable peut postuler à une mission tant que le statut de la mission est **ouverte** ou **en discussion**.

Lors de la candidature, il doit pouvoir renseigner :

* un message de présentation ;
* sa compréhension du besoin ;
* sa proposition de prix ;
* son délai de réalisation ou de disponibilité ;
* éventuellement des références ou expériences similaires.

### 7.2 Une seule offre par freelance et par mission

Pour une même mission, un freelance ne peut soumettre qu’une seule offre.

Il doit cependant pouvoir modifier son offre à tout moment tant que la mission n’est pas encore passée au statut **en travail**.

Il peut modifier :

* son message ;
* son prix ;
* son délai ;
* les informations complémentaires de son offre.

### 7.3 Aide à la rédaction de l’offre

Lorsqu’un freelance soumet sa candidature, la plateforme doit afficher un exemple de texte pour l’aider à formuler son offre.

Exemple :

> Bonjour, j’ai bien pris connaissance de votre besoin. Je peux vous accompagner sur cette mission grâce à mon expérience en comptabilité. Je vous propose une intervention à partir de [montant] pour [délai]. Je reste disponible pour échanger davantage sur vos attentes.

### 7.4 Proposition de prix

Le freelance doit obligatoirement pouvoir proposer un prix lors de sa candidature.

Ce prix sert uniquement d’indication pour la négociation entre le client et le prestataire.

Le paiement final ne se fera pas sur la plateforme.

### 7.5 Notification au client

À chaque nouvelle offre reçue, le client doit recevoir une notification.

Cette notification doit lui permettre d’accéder rapidement :

* à la mission concernée ;
* au profil du freelance ;
* à l’offre reçue ;
* à la conversation dédiée à cette offre.

---

## 8. Discussion entre client et freelance

À chaque fois qu’un freelance soumet une offre, une conversation privée dédiée à cette offre est automatiquement créée entre :

* le client ;
* le freelance/comptable candidat.

Chaque offre possède donc son propre fil de discussion.

Cette discussion permet aux deux parties d’échanger sur :

* le besoin ;
* le prix proposé ;
* les délais ;
* les documents nécessaires ;
* les modalités de collaboration ;
* les moyens de paiement externes.

Le client doit pouvoir lire les offres reçues puis discuter avec chaque freelance directement depuis la conversation associée à son offre.

---

## 9. Attribution, suivi et clôture d’une mission

### 9.1 Choix du freelance

Le client doit pouvoir sélectionner un prestataire parmi les offres reçues.

Lorsqu’un freelance est choisi :

* le statut de la mission passe à **en travail** ;
* aucune nouvelle offre ne peut être envoyée sur cette mission ;
* les autres candidatures peuvent être marquées comme non retenues ;
* le client et le prestataire choisi continuent leur discussion privée.

### 9.2 Fin de mission

Lorsque la mission est terminée, le client doit pouvoir changer le statut de la mission en **terminée**.

La mission terminée permet ensuite :

* au client de laisser un avis sur le freelance ;
* au client de noter le freelance ;
* au freelance d’être notifié de l’avis reçu.

### 9.3 Rappel automatique selon la durée du projet

La durée du projet doit être prise en compte à partir du moment où la mission passe au statut **en travail**.

Si la durée prévue est dépassée et que le client n’a pas encore marqué la mission comme terminée, la plateforme doit lui envoyer une notification.

Cette notification doit lui demander de :

* clôturer la mission si elle est terminée ;
* ou augmenter/prolonger la durée du projet si la mission est toujours en cours.

Le message doit aussi préciser que si le client ne fait aucune action après un certain délai, la mission pourra être automatiquement marquée comme **terminée**.

---

## 10. Avis et notation

### 10.1 Avis sur un prestataire

Le client doit pouvoir laisser un avis sur un prestataire après une collaboration.

L’avis peut contenir :

* une note ;
* un commentaire ;
* la date de l’avis ;
* le projet concerné.

### 10.2 Avis sur un client

Le prestataire doit aussi pouvoir laisser un avis sur un client.

Cela permet d’évaluer le sérieux du client, la clarté de ses besoins et la qualité de la collaboration.

### 10.3 Notification du freelance après avis

Quand le client ajoute un avis et une note après la fin d’une mission, le freelance doit recevoir une notification.

Cette notification l’informe qu’un avis a été laissé sur son travail.

### 10.4 Visibilité conditionnelle des avis prestataires

La visibilité de l’avis sur le profil public du prestataire peut être conditionnée par le paiement d’un montant par le prestataire.

Fonctionnement souhaité :

* le client laisse un avis et une note après la mission ;
* le freelance reçoit une notification ;
* le freelance peut payer une somme pour rendre cet avis visible sur son profil ;
* tant que le paiement n’est pas effectué, l’avis peut rester enregistré mais non affiché publiquement sur le profil.

Cependant, cette fonctionnalité doit être désactivée pendant les premiers mois du lancement de l’application.

Au lancement, les avis peuvent être enregistrés, mais la monétisation de leur visibilité doit rester inactive.

---

## 11. Paiements

La plateforme ne doit pas intégrer de paiement pour les missions entre clients et freelances.

Les paiements de mission se font en dehors de la plateforme.

Seule la fonctionnalité de mise en avant des profils freelances peut rester payante si elle est déjà prévue ou existante.

---

## 12. Résumé du périmètre final

### À garder

* Forum de questions/réponses ;
* publication de missions ;
* candidatures des freelances avec proposition de prix ;
* discussion privée automatique après candidature ;
* choix d’un prestataire ;
* statuts de mission ;
* avis clients/prestataires ;
* mise en avant payante des profils freelances.

### À retirer

* paiement des projets par les clients sur la plateforme ;
* gestion de stock ;
* gestion de l’activité interne du client ;
* modules comptables ou commerciaux complexes destinés aux clients ;
* tout système de commission ou paiement intégré aux missions.

### Orientation produit

L’application doit être simple, centrée sur le forum et la mise en relation, avec une logique proche de Codeur.com mais adaptée au domaine des comptables/freelances.


Tout les notification serons envoyer pas whatsapp

lapi de whatsapp se trouve ici https://openwa.it-sefako.duckdns.org/ 

je pense quil faut retierer le dossier whatsapp-service acctuel et dans backens scindé le code en plusieur fichier et bien structurer dans les dossier.

