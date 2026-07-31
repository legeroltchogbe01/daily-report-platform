# 📊 Daily Report Platform (Plateforme de Gestion de Rapports & Projets)

Bienvenue sur la plateforme **Daily Report**, un outil moderne, rapide et intuitif conçu pour faciliter le suivi des projets d'équipe et la soumission de rapports journaliers. 

L'application arbore une interface **Cyber-Obsidian & Émeraude** à fort contraste, entièrement réactive (responsive) et installable comme une application mobile native (PWA).

---

## 📖 Guide d'Utilisation de la Plateforme

### 1. Rôles et Connexion
L'application propose deux profils d'utilisateurs distincts. Les identifiants par défaut après installation sont :
* **Manager (Chef d'équipe)** : 
  * Identifiant : `boss`
  * Mot de passe : `1234`
* **Employé** : 
  * Identifiants : `employee1` ou `employee2`
  * Mot de passe : `1234`

*Note : Les utilisateurs peuvent s'inscrire d'eux-mêmes comme Employés via le lien "Créer un compte" sur l'écran de connexion.*

### 2. Sécurité du Compte (Changement de mot de passe)
Pour modifier votre mot de passe à tout moment :
1. Dans le tableau de bord, cliquez sur votre **badge de profil** (qui indique votre nom et rôle) en haut à droite.
2. Saisissez votre ancien mot de passe, puis définissez et confirmez le nouveau (minimum 4 caractères).
3. Cliquez sur **Mettre à jour**. Le changement est immédiat et sécurisé.

---

### 💻 Pour les Managers (Rôle Boss)
Le tableau de bord Manager permet d'orchestrer le travail et de suivre l'avancement :

* **Créer un Projet** :
  * Cliquez sur le bouton **Nouveau Projet** en haut à droite.
  * Saisissez le nom, le cahier des charges initial et sélectionnez les employés à assigner.
* **Gérer le Cahier des Charges** :
  * Dans l'onglet **Cahier des charges** d'un projet, cliquez sur **Modifier** pour mettre à jour la direction ou les objectifs du projet.
* **Suivre les Rapports & Soumissions** :
  * Allez dans l'onglet **Rapports** pour voir la liste des rapports journaliers déposés par l'équipe.
  * Les soumissions des employés apparaissent avec leurs pièces jointes téléchargeables.
* **Communiquer & Échanger** :
  * Dans l'onglet **Messagerie**, discutez en temps réel avec les membres du projet et ajoutez des pièces jointes (documents PDF, ZIP, images).
* **Partager des Fichiers** :
  * Dans l'onglet **Fichiers**, déposez des pièces jointes globales ou téléchargez les documents fournis par l'équipe.
* **Archiver un Projet** :
  * Une fois terminé, cliquez sur **Archiver le projet** pour le ranger dans l'onglet **Archives** (accessible depuis la barre latérale).

---

### 🛠️ Pour les Employés (Rôle Employee)
L'espace employé est centré sur la soumission de rapports et la collaboration :

* **Consulter ses Projets** :
  * La page d'accueil affiche la liste des projets sur lesquels vous êtes actuellement assigné.
* **Déposer un Rapport Journalier** :
  * Cliquez sur le bouton **Soumettre un rapport** sur le projet concerné.
  * Décrivez votre travail de la journée et joignez un document (PDF, Word, Excel, image, ZIP) si nécessaire.
* **Discuter sur le Projet** :
  * Échangez des messages avec votre Manager et vos collègues via l'onglet **Messagerie**.
* **Partager des Livrables** :
  * Téléversez directement vos fichiers et rapports d'étape dans l'onglet **Fichiers**.

---

### 📱 Installation comme Application Mobile (PWA)
Cette plateforme est compatible **PWA (Progressive Web App)** :
* **Sur Android / Chrome** : Cliquez sur le bandeau d'installation qui apparaît en bas de l'écran, ou cliquez sur les 3 points verticaux en haut à droite du navigateur puis sélectionnez **Installer l'application**.
* **Sur iOS / Safari** : Cliquez sur le bouton de **Partage** de Safari (icône de flèche sortant d'un carré), faites défiler vers le bas et sélectionnez **Sur l'écran d'accueil**.

*L'application sera lancée en plein écran avec sa propre icône, sans barre d'adresse de navigateur.*

---

## 🚀 Guide de Déploiement sur Render

Le projet est préconfiguré pour un déploiement instantané sur **Render** via le fichier `render.yaml` :

1. Poussez votre projet sur un dépôt **GitHub**.
2. Allez sur [Render.com](https://render.com/) et connectez votre compte GitHub.
3. Cliquez sur **New +** -> **Blueprint**.
4. Sélectionnez votre dépôt GitHub.
5. Dans les configurations demandées, entrez la valeur de votre variable de stockage Cloudinary dans le champ **`CLOUDINARY_URL`** (sur une seule ligne continue) :
   * Valeur : `cloudinary://833147519118339:GlK0cS5HsyqrfrFA97wBpYKTIqA@inslpken`
6. Cliquez sur **Apply** (ou **Approve**).

Render va configurer :
* Une base de données PostgreSQL gratuite (`daily-report-db`).
* Un service web Node.js gratuit (`daily-report-platform`).
* L'initialisation automatique des tables de la base de données et des utilisateurs par défaut au premier démarrage !

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
