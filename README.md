# 📊 Daily Report Platform (Plateforme de Gestion de Rapports & Projets)

Bienvenue sur la plateforme **Daily Report**, un outil moderne, rapide et intuitif conçu pour faciliter le suivi des projets d'équipe et la soumission de rapports journaliers.

L'application arbore une interface **Cyber-Obsidian & Émeraude** à fort contraste, entièrement réactive (responsive) et installable comme une application mobile native (PWA).

---

## 📖 Guide d'Utilisation de la Plateforme

### 1. Rôles et Connexion

L'application propose deux profils d'utilisateurs distincts :

* **Manager (Chef d'équipe)** : Gère le cahier des charges, crée les projets, assigne des employés, suit les rapports de l'équipe et archive les projets clos.
* **Employé** : Rédige et soumet ses rapports journaliers, dialogue sur la messagerie projet, et verse les pièces jointes des livrables.

> **Note :** Les employés s'inscrivent via le lien **"Créer un compte"** sur l'écran de connexion. Seuls les employés à qui un Manager a attribué une tâche (via leur matricule) apparaissent dans la liste d'employés d'un projet.

---

### 2. Mon Profil & Sécurité

Cliquez sur votre **badge de profil** (nom + initiales) en haut à droite du tableau de bord pour ouvrir le panneau de profil.

#### 👤 Changer de nom d'utilisateur
1. Dans la section **Changer de nom d'utilisateur**, le champ est pré-rempli avec votre nom actuel.
2. Effacez et saisissez votre nouveau nom (minimum 2 caractères).
3. Cliquez sur **Mettre à jour le nom**.
4. Le changement est immédiat et se propage à tous vos messages, rapports, et projets.

> Si le nom est déjà pris, un message d'erreur s'affiche.

#### 🔒 Changer de mot de passe
1. Dans la section **Changer de mot de passe**, saisissez votre ancien mot de passe.
2. Définissez et confirmez le nouveau (minimum 4 caractères).
3. Cliquez sur **Mettre à jour le mot de passe**.

---

### 💻 Pour les Managers (Rôle Boss)

Le tableau de bord Manager permet d'orchestrer le travail et de suivre l'avancement :

* **Créer un Projet** :
  * Cliquez sur **Nouveau Projet**, saisissez le nom, le cahier des charges initial, et sélectionnez les employés à assigner via leur matricule.
* **Gérer le Cahier des Charges** :
  * Dans l'onglet **Cahier des charges** d'un projet, cliquez sur **Modifier** pour mettre à jour les objectifs.
* **Suivre les Rapports & Soumissions** :
  * Allez dans l'onglet **Rapports** pour voir tous les rapports journaliers déposés par l'équipe, avec leurs pièces jointes téléchargeables.
* **Communiquer via la Messagerie** :
  * Dans l'onglet **Messagerie**, discutez avec les membres du projet.
  * Fonctionnalités disponibles :
    * ✍️ **Texte multi-lignes** : le champ de saisie s'agrandit automatiquement, touche Retour = nouvelle ligne.
    * 📎 **Pièces jointes** : joignez un ou plusieurs fichiers (PDF, ZIP, images, etc.).
    * 📷 **Photo** : prenez une photo directement depuis la caméra de votre appareil.
    * 🎤 **Message vocal** : enregistrez un audio, puis cliquez **Terminer** pour l'envoyer ou **Annuler** pour effacer.
    * ↩️ **Répondre à un message** : cliquez sur ↩️ sur n'importe quel message pour y répondre avec une citation.
    * 💾 **Historique sauvegardé** : tous les messages sont conservés en base de données de façon permanente.
* **Partager des Fichiers** :
  * Dans l'onglet **Fichiers**, déposez des pièces jointes globales ou téléchargez les documents fournis par l'équipe.
* **Archiver un Projet** :
  * Une fois terminé, cliquez sur **Archiver le projet** pour le ranger dans l'onglet **Archives**.

---

### 🛠️ Pour les Employés (Rôle Employé)

L'espace employé est centré sur la soumission de rapports et la collaboration :

* **Consulter ses Projets** :
  * La page d'accueil affiche uniquement les projets sur lesquels vous êtes assigné.
* **Déposer un Rapport Journalier** :
  * Cliquez sur **Soumettre un rapport** sur le projet concerné.
  * Décrivez votre travail de la journée et joignez un document (PDF, Word, Excel, image, ZIP) si nécessaire.
* **Discuter sur le Projet** :
  * Échangez des messages avec votre Manager et vos collègues via l'onglet **Messagerie** (même fonctionnalités que le Manager : pièces jointes, photos, vocal, réponses).
* **Partager des Livrables** :
  * Téléversez directement vos fichiers et rapports d'étape dans l'onglet **Fichiers**.

---

### 📱 Installation comme Application Mobile (PWA)

Cette plateforme est compatible **PWA (Progressive Web App)** :
* **Sur Android / Chrome** : Cliquez sur le bandeau d'installation qui apparaît en bas de l'écran, ou ouvrez le menu (3 points verticaux) → **Installer l'application**.
* **Sur iOS / Safari** : Cliquez sur le bouton **Partage** (flèche ↑ dans un carré) → **Sur l'écran d'accueil**.

*L'application sera lancée en plein écran avec sa propre icône, sans barre d'adresse de navigateur.*

---

### 🔄 Remise à Zéro (Admin)

Pour réinitialiser complètement la base de données (effacer tous les projets, messages et comptes) :

1. Attendez que le serveur soit démarré et déployé.
2. Naviguez vers l'URL suivante dans votre navigateur :
   ```
   https://votre-site.onrender.com/api/admin/reset-db
   ```
3. La page affiche une confirmation et un lien de retour vers l'accueil.
4. Les comptes par défaut (`boss` / `1234`) sont automatiquement recréés.

> ⚠️ **Attention** : cette opération est irréversible. Toutes les données seront effacées.

---

## 🚀 Guide de Déploiement sur Render

Le projet est préconfiguré pour un déploiement instantané sur **Render** via le fichier `render.yaml` :

1. Poussez votre projet sur un dépôt **GitHub**.
2. Allez sur [Render.com](https://render.com/) et connectez votre compte GitHub.
3. Cliquez sur **New +** → **Blueprint**.
4. Sélectionnez votre dépôt GitHub.
5. Dans les configurations demandées, entrez la valeur de votre variable Cloudinary dans le champ **`CLOUDINARY_URL`** :
   * Valeur : `cloudinary://833147519118339:GlK0cS5HsyqrfrFA97wBpYKTIqA@inslpken`
6. Cliquez sur **Apply** (ou **Approve**).

Render va configurer automatiquement :
* Une base de données PostgreSQL gratuite (`daily-report-db`).
* Un service web Node.js gratuit (`daily-report-platform`).
* L'initialisation automatique des tables et des comptes par défaut au premier démarrage.

---

## 🛠️ Exécuter Localement

Pour démarrer et tester l'application sur votre propre machine :

1. Installez les dépendances :
   ```bash
   npm install
   ```
2. Créez un fichier `.env` à la racine et renseignez vos identifiants Cloudinary :
   ```env
   STORAGE_PROVIDER=cloudinary
   CLOUDINARY_URL=cloudinary://833147519118339:GlK0cS5HsyqrfrFA97wBpYKTIqA@inslpken
   ```
3. Démarrez le serveur local :
   ```bash
   npm start
   ```
4. Accédez à l'application via : `http://localhost:3000`

---

## 📋 Comptes par Défaut

| Nom d'utilisateur | Mot de passe | Rôle    |
|-------------------|--------------|---------|
| `boss`            | `1234`       | Manager |

> Les Employés créent leur propre compte via le formulaire d'inscription sur la page de connexion.
