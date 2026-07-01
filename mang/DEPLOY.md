# Deploying Store Manager to a VPS (Ubuntu/Debian)

The app is a plain Node.js + Express server with a file-based SQLite database.
No build step, no native compilation (SQLite runs as WASM), so it deploys as-is.

## What to upload
Copy the whole project **except** these (they're recreated on the server):
- `node_modules/`  → reinstalled with `npm install`
- `store.db`, `store.db-*`, `store.db.lock`  → created fresh on first run

(The included `.gitignore` already excludes them.)

---

## 1. Get the files onto the server

**Option A — Git (best for updates)**
```bash
# on your PC (once):
cd /c/Users/LENOVO/Desktop/mang
git init && git add . && git commit -m "initial"
# push to a private GitHub repo, then on the server:
git clone https://github.com/<you>/<repo>.git store-manager
```
To update later: `git pull` on the server.

**Option B — Drag & drop (simplest)**
Use **WinSCP** (Windows) or **FileZilla**: connect via SFTP to the VPS and
upload the folder to `/home/<user>/store-manager` — but delete `node_modules`
and `store.db*` locally first (or just don't upload them).

**Option C — scp from a terminal**
```bash
scp -r ./mang <user>@<VPS_IP>:/home/<user>/store-manager
```

---

## 2. Install Node.js (once, on the server)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should print v20.x
```

## 3. Install deps & test-run
```bash
cd ~/store-manager
npm install
npm start          # should print: Store Manager running at http://localhost:3000
# Ctrl+C to stop after you confirm it boots
```

## 4. Keep it running 24/7 with pm2
```bash
sudo npm install -g pm2
pm2 start server.js --name store-manager
pm2 save
pm2 startup        # run the command it prints, so it survives reboots
```
Useful: `pm2 logs store-manager`, `pm2 restart store-manager`, `pm2 status`.

---

## 5. Make it reachable

**Quick (test):** open the port and visit `http://<VPS_IP>:3000`
```bash
sudo ufw allow 3000
```

**Proper (recommended): nginx reverse proxy + HTTPS** (needs a domain)
```bash
sudo apt-get install -y nginx
# /etc/nginx/sites-available/store-manager:
#   server {
#     server_name your-domain.com;
#     location / { proxy_pass http://localhost:3000; proxy_set_header Host $host; }
#   }
sudo ln -s /etc/nginx/sites-available/store-manager /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo snap install --classic certbot && sudo certbot --nginx   # free HTTPS
```

---

## ⚠️ Security — read this
The app currently has **NO login**. Anyone who can open the URL can view and
change all your data (orders, customers, **and your Shopify API token**).
Before exposing it publicly, do at least one of:
- **nginx Basic Auth** (a username/password gate — quickest), or
- **firewall allow-list** (only your home/office IP can reach it), or
- ask to add an **app-level password login** (more convenient, works anywhere).

## Updating after changes
```bash
cd ~/store-manager
git pull            # or re-upload changed files
npm install         # only if dependencies changed
pm2 restart store-manager
```
Your `store.db` is never overwritten by updates, so data is safe.
