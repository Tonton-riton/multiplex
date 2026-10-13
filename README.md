# ⚽ Multiplex TV - Overlay Live OBS & Panneau de Contrôle

Système complet d'overlay TV style multiplex sportif (Canal+, beIN Sports, RMC Sport) modifiable en direct via une interface web locale pour vos streams OBS Studio, Twitch, YouTube, etc.

---

## 🚀 Démarrage Rapide

### Option 1 : En 1 clic (Recommandé)
Double-cliquez simplement sur le fichier **`demarrer.bat`**.  
Le serveur va démarrer et ouvrir automatiquement le panneau de contrôle dans votre navigateur à l'adresse :  
👉 **`http://localhost:3000/admin`**

### Option 2 : En ligne de commande
```bash
npm install
npm start
```

---

## 📺 Intégration dans OBS Studio / Streamlabs

1. Ouvrez **OBS Studio**.
2. Dans le panneau **Sources**, cliquez sur le bouton **`+`** puis choisissez **Navigateur** (*Browser*).
3. Nommez la source (ex: `Overlay Multiplex`).
4. Dans le champ **URL**, collez :  
   `http://localhost:3000/overlay`
5. Réglez les dimensions :
   - **Largeur :** `1920`
   - **Hauteur :** `1080` (ou `70` si vous préférez une source compacte au ras de l'écran)
6. Laissez le fond transparent et cochez :
   - *« Actualiser le navigateur lorsque la scène devient active »*
7. Cliquez sur **OK**. L'overlay s'affiche instantanément !

---

## 🎛️ Fonctionnalités du Panneau de Contrôle (`/admin`)

- **Aperçu en direct :** Visualisez l'overlay en temps réel directement au-dessus des réglages sans avoir besoin de regarder OBS.
- **Gestion des Matchs :**
  - Modification instantanée des noms d'équipes.
  - Boutons rapides `+` et `-` pour incrémenter les scores en un clic.
  - Statuts configurables : `🔴 En Direct` (avec voyant clignotant comme à la télé), `⏳ À venir`, `⏸️ Mi-temps`, `🏁 Terminé`.
  - Champ minute / info (ex: `45'`, `90+3'`, `MT`, `21h00`).
  - Bouton **⚽ Alerte BUT** : Déclenche une animation visuelle dorée clignotante et une bannière de but sur le match concerné.
  - Visibilité (icône œil) : Affichez ou masquez un match temporairement sans le supprimer.
  - Réorganisation : Boutons monter/descendre pour choisir l'ordre d'affichage.
- **Personnalisation TV complète :**
  - Texte du badge gauche (ex: `EN DIRECT`, `MULTIPLEX L1`, `TOURNOI FIFA`, `LIGUE DES CHAMPIONS`...).
  - Palette de couleurs : Couleur du badge, couleur du bandeau vert/noir, liseré doré, scores et noms d'équipes.
  - 3 Modes d'affichage :
    1. **Défilement continu (Marquee)** : Défilement fluide infini à vitesse réglable (en px/s).
    2. **Carrousel TV** : Affiche les matchs par page de 3 avec transition animée toutes les X secondes.
    3. **Statique** : Affichage fixe centré.
  - Position : Bas de l'écran ou Haut de l'écran.
  - Jingle sonore optionnel lors d'un but.
- **Sauvegarde automatique :** Tous vos matchs et réglages sont automatiquement sauvegardés dans le dossier `data/`. Même après un redémarrage de votre PC, vous ne perdez rien.
- **Accès depuis mobile/tablette :** Vous pouvez aussi ouvrir le panneau de contrôle sur votre téléphone ou tablette connectée au même WiFi en tapant l'adresse IP locale de votre PC (ex: `http://192.168.1.XX:3000/admin`).
