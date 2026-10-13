# 🌍 Héberger Multiplex TV en ligne

Une fois hébergé, tu pilotes l'overlay depuis n'importe où, et OBS affiche l'overlay depuis l'adresse en ligne.

- 📺 **OBS** : `https://TON-SITE/overlay` (public, lecture seule)
- 💻 **Panneau de contrôle** : `https://TON-SITE/admin` (protégé par mot de passe)

## 🔒 Sécurité (important)

Le projet lit la variable d'environnement **`ADMIN_PASSWORD`** :

- Définie → `/admin` demande un mot de passe, et **toute modification** (scores, matchs, son, réglages) est refusée sans connexion. L'overlay reste public pour OBS mais il ne peut rien modifier.
- En production (`NODE_ENV=production`, déjà réglé dans le `Dockerfile`), le serveur **refuse de démarrer** sans `ADMIN_PASSWORD`.
- Pour te déconnecter : `https://TON-SITE/logout`.

Choisis un vrai mot de passe long.

## 💾 Données persistantes

Les matchs, réglages et ton fichier son sont enregistrés dans le dossier indiqué par **`DATA_DIR`** (`/data` dans Docker).
Sans disque/volume persistant chez l'hébergeur, **tout est effacé à chaque redémarrage ou mise à jour**. Monte donc un volume sur `/data`.

---

## Option A : Render (le plus simple)

1. Mets le projet sur **GitHub** (dépôt privé conseillé) :
   ```bash
   git init
   git add .
   git commit -m "Multiplex TV"
   git branch -M main
   git remote add origin https://github.com/TON-COMPTE/multiplex.git
   git push -u origin main
   ```
   (`node_modules/` et `data/` sont ignorés automatiquement.)
2. Sur [render.com](https://render.com) : **New → Blueprint** → choisis ton dépôt. Le fichier `render.yaml` configure tout (Docker + disque `/data`).
3. Renseigne la variable **`ADMIN_PASSWORD`** quand Render la demande.
4. Attends le déploiement : tu obtiens une adresse du type `https://multiplex-overlay.onrender.com`.

> ⚠️ Le **disque persistant** demande le plan payant *Starter* (~7 $/mois). En gratuit, le service s'endort après 15 min d'inactivité et les données ne sont pas conservées.

## Option B : Railway

1. **New Project → Deploy from GitHub repo**.
2. Onglet **Variables** : ajoute `ADMIN_PASSWORD`.
3. Onglet **Settings → Volumes** : ajoute un volume monté sur **`/data`**.
4. **Settings → Networking → Generate Domain** pour obtenir l'adresse publique.

## Option C : Petit serveur VPS (~4 €/mois, ex: Hetzner, OVH)

Avec Docker installé sur le serveur :

```bash
docker build -t multiplex .
docker run -d --name multiplex --restart unless-stopped \
  -p 3000:3000 \
  -e ADMIN_PASSWORD="ton-mot-de-passe" \
  -v multiplex-data:/data \
  multiplex
```

Mets ensuite un reverse proxy HTTPS devant (Caddy est le plus simple) :

```
ton-domaine.fr {
    reverse_proxy localhost:3000
}
```

## Option D : Gratuit depuis ton PC (Cloudflare Tunnel)

Ton PC doit rester allumé avec le serveur lancé (`demarrer.bat`), mais tu obtiens une adresse publique HTTPS gratuite :

```bash
cloudflared tunnel --url http://localhost:3000
```

Pense à définir `ADMIN_PASSWORD` avant de lancer le serveur :

```powershell
$env:ADMIN_PASSWORD = "ton-mot-de-passe"
node server.js
```

---

## Dans OBS après hébergement

1. Source **Navigateur** → URL : `https://TON-SITE/overlay`
2. Largeur **1920**, Hauteur **1080**, **FPS personnalisé 60**.
3. Coche **« Contrôler l'audio via OBS »**.
4. Connecte-toi sur `https://TON-SITE/admin`, envoie ton son de but depuis la carte « 🔊 Son de but ».
