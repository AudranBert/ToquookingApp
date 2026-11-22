# Cloud optionnel et partage par lien

Le frontend reste un site statique GitHub Pages. Les fonctions locales et les
sauvegardes ZIP restent disponibles sans base de données. L'import par URL passe
par le serveur configuré ; l'import de texte et de fichiers reste local.

## Service commun Toquooking

Le service gratuit `toquooking` est créé sur Render à Francfort :
`https://toquooking.onrender.com`. L'adresse est déjà renseignée dans
`public/online-config.json` et proposée par défaut aux nouvelles installations.
Chaque appareil reçoit sa propre clé ; fournir la même clé sur un autre appareil
retrouve le même espace. Aucune adresse serveur n'est à saisir pour ce service.

Le service déploie automatiquement la branche `codex/cloud-backup` du dépôt.
Une base PostgreSQL persistante doit encore être raccordée avec `DATABASE_URL`
avant de rendre la sauvegarde commune opérationnelle. L'offre gratuite du serveur
ne fournit pas, à elle seule, ce stockage. Ne pas utiliser la base Render gratuite
à durée limitée comme sauvegarde durable. Les quotas gratuits du fournisseur de
base et de Render sont partagés entre tous les utilisateurs du service commun.

Suivi : [service Render](https://dashboard.render.com/web/srv-dc0ajsk9v7es73b5dgs0).

## Déployer

1. Créer une base PostgreSQL persistante (par exemple Supabase). Garder sa chaîne
   de connexion uniquement côté serveur. Avec Supabase, choisir le Session
   pooler compatible IPv4 si nécessaire et conserver les paramètres TLS fournis.
2. Créer un Blueprint Render à partir du `render.yaml` du dépôt. Renseigner
   `DATABASE_URL` dans les variables secrètes Render. Le serveur utilise Node 22
   et `npm run start:cloud`. Les tables préfixées `toque_` sont créées au démarrage.
   Utiliser une base ou un schéma dédié avec des droits limités à cette application.
3. Régler `ALLOWED_ORIGINS` sur l'origine GitHub Pages, sans chemin ni slash final
   (`https://audranbert.github.io`). Plusieurs origines sont séparées par des
   virgules. Ajouter explicitement les origines locales pour tester en local.
4. Facultatif : renseigner l'URL publique du serveur dans
   `public/online-config.json`, puis reconstruire et publier le frontend.
   Ce fichier ne contient jamais de clé privée ni de mot de passe PostgreSQL.
   Cette adresse est le **Cloud Toquooking** commun : les utilisateurs n'ont
   aucune URL à saisir et chaque clé définit un espace privé distinct. Le choix
   d'un **Serveur personnel** ou de **Cet appareil uniquement** est accessible
   dans **Sauvegarde → Réglages avancés**. Les préférences des serveurs personnels
   et les clés existantes ne sont jamais écrasées par les valeurs de déploiement.
5. Le frontend génère une clé privée dès la première ouverture, même sans
   sauvegarde automatique. Une clé saisie est conservée ; un champ vide à
   l'enregistrement génère une nouvelle clé aléatoire de 256 bits (64 caractères
   hexadécimaux). Dans **Sauvegarde**, activer **Sauvegarde automatique** pour les
   futurs enregistrements. La même URL et la même clé donnent
   accès au même espace depuis un autre appareil. La clé est enregistrée seulement
   dans le navigateur ; conserver une copie en lieu sûr. Sans elle, aucune
   récupération de cet espace n'est prévue. La synchronisation ou le partage
   manuel génèrent aussi une clé si nécessaire, sans activer la sauvegarde auto.

La clé privée permet de lire, écrire et supprimer les recettes de l'espace.
Elle est transmise en en-tête Authorization sur HTTPS, jamais dans un lien.
Le serveur utilise son empreinte SHA-256 pour isoler les espaces. Il n'y a pas de
compte utilisateur ni de récupération de mot de passe. Une autre clé ouvre un
autre espace (elle ne produit pas une erreur d'authentification).

Sans `DATABASE_URL`, le serveur démarre mais les opérations cloud répondent 503.
`GET /health` indique séparément si le serveur et la base sont accessibles.
`POST /import` reste disponible sans base : il reçoit `{ "url": "https://…" }`,
récupère la page et renvoie `{ "recipe": { … } }`. Cette route ne demande pas
la clé privée, mais applique la limite de débit générale et refuse les adresses
du réseau privé.
Les indicateurs se mettent à jour toutes les dix secondes uniquement quand le
menu Sauvegarde est ouvert, indépendamment des transferts et sans vérifications
simultanées. La file de sauvegarde conserve sa propre reprise toutes les 30 s.
Render peut se mettre en veille : les opérations attendent jusqu'à 90 secondes.
Les fichiers locaux du serveur ne servent jamais de stockage de production.

## Comportement des sauvegardes

- Chaque création, validation, duplication, import local ou modification via la
  gestion des tags/ingrédients écrit dans IndexedDB. Si l'option automatique est
  active, la dernière version de chaque recette est ajoutée dans `cloudQueue`
  **dans la même transaction**. Les recettes existantes ne sont pas toutes
  envoyées à l'activation : utiliser **Sauvegarder sur le cloud** pour cela.
- Les mises à jour sont regroupées (750 ms), puis envoyées par lots de 25 et
  d'environ 16 Mo maximum. Seule la première image (la couverture visible) est envoyée une seule fois,
  sans galerie ni images d'origine. Les URL distantes restent des liens et ne sont
  jamais téléchargées par la sauvegarde. Les autres photos restent locales ; un
  chargement cloud sur une recette existante les conserve.
- Les nouvelles photos ajoutées depuis l'appareil sont optimisées localement en
  WebP (grand côté 1600 px maximum, qualité 80 %). L'original est conservé s'il
  pèse moins que la version encodée. Les GIF restent animés et ne sont pas
  recompressés. Repli JPEG si l'encodage WebP n'est pas disponible. Les images
  fournies par URL et les anciennes sauvegardes ZIP ne sont pas reconverties.
  Les exports ZIP locaux continuent à inclure toutes les images.
  Limite serveur : 12 Mo par recette, 24 Mo par requête. Une erreur conserve la
  file ; pour une recette trop volumineuse, réduire ses photos et enregistrer.
- La file persiste après fermeture, se réduit à une entrée par recette et se
  rejoue au lancement, au retour réseau et toutes les 30 secondes pendant que
  l'app est ouverte. Aucun envoi n'est garanti après fermeture de l'app.
- Une nouvelle modification pendant l'envoi ne peut pas être effacée par
  l'accusé de réception de l'ancienne version. Les tentatives répétées ont un
  identifiant idempotent côté serveur. Web Locks sérialise les envois entre
  onglets lorsque le navigateur le permet.
- Désactiver l'option met en pause les envois automatiques déjà en attente.
  Les transferts manuels demandés et les suppressions continuent à se rejouer.
  Choisir **Cet appareil uniquement** désactive tout accès cloud. Changer d'espace conserve la file
  de l'ancien espace sans l'envoyer vers le nouveau.
- **Sauvegarder sur le cloud** ajoute les recettes locales manquantes et met
  à jour celles du même identifiant. Hors connexion, cette demande est conservée.
- **Charger depuis le cloud** fusionne par identifiant, sans effacer la
  bibliothèque locale. Les modifications locales en attente, les suppressions
  en attente et les versions locales plus récentes sont protégées. Le chargement
  ne déclenche pas de nouvel upload. Les noms des tags sont inclus dans chaque
  recette ; les catégories/couleurs des tags restent locales.
- Il ne s'agit pas d'une synchronisation collaborative en temps réel : entre
  appareils, la version dont `updatedAt` est la plus récente est conservée,
  y compris lors de la création d’un lien public. À date égale, le dernier envoi
  gagne pour rester compatible avec les anciens clients. Cette politique dépend
  des horloges des appareils ; elle ne fusionne pas les modifications champ par champ.
  Les recettes cloud sont chargées explicitement avec le bouton de chargement.
  Deux recettes d'identifiants différents restent distinctes même si leur nom
  est identique.

## Partage et corbeille

**Partager la recette par lien** enregistre la recette côté serveur puis crée
un lien court `#share=<uuid>&server=<url-publique>`. Le destinataire n'a besoin
ni de clé privée ni d'une configuration cloud. Il confirme l'ajout d'une copie
à sa bibliothèque locale. Les anciens liens `#toqueRecipe=` restent lisibles.
Le partage nécessite une connexion ; aucune recette n'est encodée dans les
nouveaux liens et aucun ZIP de remplacement n'est généré.

Le lien reste stable pour la même recette et le même espace. Les sauvegardes
ultérieures mettent à jour son contenu. Toute personne ayant le lien peut lire
cette recette uniquement ; le lien n'autorise aucune écriture ni lecture des
autres recettes. Supprimer la recette invalide immédiatement son lien public.

Une suppression locale est mise en file même si la sauvegarde automatique est
désactivée, dès lors qu'un espace est configuré. Le serveur conserve le contenu
dans la corbeille pendant sept jours à partir de la réception de la suppression.
Une tentative répétée ne prolonge pas ce délai. La purge s'exécute au démarrage
et toutes les minutes lorsque le serveur tourne ; s'il dort, elle s'exécute à son
réveil. Après sept jours le contenu est supprimé définitivement ; une trace
minimale (espace, identifiant, date) reste pour empêcher un appareil ancien de
réintroduire une recette supprimée.

Dans **Sauvegarde → Corbeille cloud**, l'utilisateur peut :

- consulter les recettes supprimées et leur date d'expiration ;
- restaurer une recette dans le cloud et sur l'appareil, sous son identifiant
  d'origine (les anciennes images supplémentaires locales sont conservées) ;
- supprimer définitivement une recette ou vider la corbeille, après confirmation.

La restauration réactive aussi les liens publics de la recette. Elle ne modifie
pas les changements locaux en attente ou effectués pendant la requête. Les
suppressions précédentes sont terminées avant la restauration ; leurs anciennes
requêtes répétées ne suppriment pas à nouveau la recette restaurée. La version
restaurée porte une nouvelle date de modification pour les autres appareils.
Un nouvel enregistrement utilisateur peut ensuite modifier la recette normalement.

Les recettes expirées ne sont ni listées ni restaurables, même avant le passage
de la purge périodique. Une suppression définitive retire les données et les
liens, en conservant seulement la trace qui bloque les anciens envois. Vider la
corbeille ne supprime aucune recette active ni aucun autre espace privé.
Ces actions nécessitent une connexion et ne sont pas mises en attente hors ligne.

API authentifiée avec la même clé privée : `GET /trash`,
`POST /trash/:id/restore`, `POST /trash/:id/purge`, `POST /trash/empty`.
Les réponses de liste ne contiennent que les noms, identifiants et dates ; les
photos et le contenu complet sont récupérés uniquement à la restauration.

## Structure et vérification

- `src/cloud/settings.ts` : configuration locale et valeurs de déploiement.
- `src/data/recipeRepository.ts` : écritures locales et file atomique.
- `src/cloud/queue.ts` : lots, reprise et acquittements.
- `src/cloud/transfers.ts` : sauvegarde manuelle et fusion au chargement.
- `src/cloud/apiClient.ts`, `sharing.ts` : appels réseau et liens publics.
- `src/cloud/validation.ts` : validation des réponses et filtrage des URL publiques.
- `src/hooks/useCloudBackup.ts` : cycle de vie React, état et tentatives.
- `src/cloud/trash.ts`, `src/hooks/useCloudTrash.ts` et `src/components/CloudTrash.tsx` : corbeille cloud, restauration et confirmations.
- `src/components/CloudBackupSettings.tsx` : interface de configuration.
- `backend/server.mjs` : HTTP, contrôle d'origine, clé et limite de requêtes.
- `backend/validation.mjs` : validation et liste explicite des champs acceptés.
- `backend/postgres-store.mjs` : persistance, idempotence, partage et corbeille.

```powershell
npm run build
npm test
```

Les tests cloud utilisent IndexedDB simulé côté navigateur et un véritable
moteur PostgreSQL embarqué (PGlite) pour les requêtes SQL du serveur. Les routes
HTTP sont testées en mémoire ; pour ajouter le transport réseau réel, lancer
`$env:TEST_HTTP="1"; npm run test:cloud` dans PowerShell (ou
`TEST_HTTP=1 npm run test:cloud` sous Linux). Pour tester
une instance PostgreSQL externe, définir `TEST_DATABASE_URL` vers une **base de
test dédiée et vide** ; ne jamais utiliser une base de production.

En local : définir `DATABASE_URL` côté serveur, lancer `npm run start:cloud`,
laisser `npm run dev` servir le frontend, puis saisir
`http://127.0.0.1:3001` dans Sauvegarde. HTTP n'est accepté que pour localhost.
La limite HTTP est appliquée par adresse de connexion (120 requêtes/minute) ;
derrière un proxy partagé elle peut être commune à plusieurs utilisateurs.

Les délais et tailles de lots du navigateur sont regroupés dans `src/cloud/config.ts`.
Les limites de validation, la rétention de la corbeille et les réglages de maintenance du serveur sont dans `backend/config.mjs`. Les secrets restent dans les variables d’environnement. Les limites du serveur font autorité ; les lots du navigateur doivent rester compatibles avec elles.
