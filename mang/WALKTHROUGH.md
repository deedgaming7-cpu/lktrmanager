# 🚀 Deploy Store Manager to a Fresh Ubuntu VPS — Full Walkthrough

A step-by-step guide that takes you from a brand-new Ubuntu server to a running,
password-protected Store Manager reachable from your phone and computer.

**Good news:** this app needs **no compiler / build tools** (the database runs as
WebAssembly), so installation on Linux is just `npm install` — nothing exotic.

> Replace every placeholder written like `<THIS>` with your real value.
> Example placeholders: `<VPS_IP>`, `<deploy>`, `<your-domain.com>`.

---

## Table of contents
1. [Before you start](#1-before-you-start)
2. [Connect to your VPS](#2-connect-to-your-vps)
3. [Basic server setup & security](#3-basic-server-setup--security)
4. [Install Node.js 20](#4-install-nodejs-20)
5. [Get the app onto the server](#5-get-the-app-onto-the-server)
6. [Install dependencies & test run](#6-install-dependencies--test-run)
7. [Keep it running 24/7 (PM2)](#7-keep-it-running-247-pm2)
8. [Make it reachable](#8-make-it-reachable)
9. [First login — change the admin password](#9-first-login--change-the-admin-password)
10. [Updating the app later](#10-updating-the-app-later)
11. [Backups](#11-backups)
12. [Troubleshooting](#12-troubleshooting)
13. [Command cheat-sheet](#13-command-cheat-sheet)

---

## 1. Before you start

You need:
- **A VPS** running **Ubuntu 22.04 or 24.04** (any cheap provider: Hetzner, DigitalOcean, Vultr, Contabo…). 1 vCPU / 1 GB RAM is plenty for 1–2 users.
- Its **IP address** and the **root password** (or SSH key) — your provider emails these.
- **(Optional but recommended) a domain name** pointed at the VPS, if you want a nice URL + HTTPS. Without one you'll use `http://<VPS_IP>:3000`.

On your Windows PC you already have everything you need: **PowerShell** has `ssh` and `scp` built in.

---

## 2. Connect to your VPS

Open **PowerShell** on your PC and connect (first time, type `yes` to accept the fingerprint):

```bash
ssh root@<VPS_IP>
```

Enter the root password when asked. You're now on the server (the prompt changes to something like `root@ubuntu:~#`).

> Prefer a graphical file transfer later? Install **WinSCP** (free) — covered in Step 5, Option B.

---

## 3. Basic server setup & security

Run these **on the server** (copy-paste block by block).

**3.1 — Update the system:**
```bash
apt update && apt upgrade -y
```

**3.2 — Create a non-root user** (running apps as root is bad practice). We'll call it `deploy`:
```bash
adduser deploy           # set a password when prompted; press Enter through the rest
usermod -aG sudo deploy   # give it admin (sudo) rights
```

**3.3 — Set up the firewall** (allow SSH so you don't lock yourself out, plus web ports):
```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable
```
> If you'll skip the domain/HTTPS step and use the IP directly, also run `ufw allow 3000`.

**3.4 — Switch to the new user** for the rest of the guide:
```bash
su - deploy
```
(From now on, commands run as `deploy`. Anything needing admin rights uses `sudo`.)

---

## 4. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v     # should print v20.x.x
npm -v      # should print a version number
```

---

## 5. Get the app onto the server

Pick **one** option.

### Option A — Git (recommended, makes updates trivial)
First push your project to a **private GitHub repo** from your PC (one-time). In
PowerShell, inside `C:\Users\LENOVO\Desktop\mang`:
```bash
git init
git add .
git commit -m "Store Manager"
# create a PRIVATE repo on github.com, then:
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```
> The included `.gitignore` already keeps `node_modules`, the database, and lock files out of the repo.

Then **on the server**:
```bash
cd ~
git clone https://github.com/<you>/<repo>.git store-manager
cd store-manager
```

### Option B — Drag & drop with WinSCP (no Git needed)
1. Install **WinSCP** on your PC, connect with: host `<VPS_IP>`, user `deploy`, your password.
2. On the **right (server)** side, go to `/home/deploy/` and create a folder `store-manager`.
3. On the **left (PC)** side, open `C:\Users\LENOVO\Desktop\mang`.
4. Drag **everything EXCEPT** these into the server folder:
   - ❌ `node_modules/`  (reinstalled on the server)
   - ❌ `store.db`, `store.db-journal`, `store.db.lock`  (created fresh)
5. Back in your SSH window: `cd ~/store-manager`

---

## 6. Install dependencies & test run

```bash
cd ~/store-manager
npm install
npm start
```
You should see:
```
Database initialized: store.db
  [auth] Default admin created — username: "admin"  password: "admin"
  Store Manager running at http://localhost:3000
```
Press **Ctrl + C** to stop it once you've confirmed it boots. (We'll start it
properly next so it runs in the background and survives reboots.)

> Note the default login: **admin / admin** — you'll change it in Step 9.

---

## 7. Keep it running 24/7 (PM2)

PM2 keeps the app alive, restarts it if it crashes, and starts it on reboot.

```bash
sudo npm install -g pm2
cd ~/store-manager
pm2 start server.js --name store-manager
pm2 save
pm2 startup        # ⚠️ it prints ONE command — copy & run that exact command
```

Handy PM2 commands:
```bash
pm2 status                  # is it running?
pm2 logs store-manager      # live logs (Ctrl+C to exit)
pm2 restart store-manager   # after an update
pm2 stop store-manager
```

At this point the app is running internally on port 3000. Now expose it.

---

## 8. Make it reachable

### Option A — Quick: just use the IP (no domain)
Make sure you opened the port (`sudo ufw allow 3000`), then visit:
```
http://<VPS_IP>:3000
```
That's it — skip to Step 9. (Downside: it's plain HTTP, no padlock. Fine for trying it out; for daily use prefer Option B.)

### Option B — Recommended: your domain + HTTPS (free)
**Prerequisite:** point your domain's **A record** to `<VPS_IP>` (in your domain
registrar's DNS settings). Wait a few minutes for it to take effect.

**8.1 — Install nginx:**
```bash
sudo apt install -y nginx
```

**8.2 — Create the site config:**
```bash
sudo nano /etc/nginx/sites-available/store-manager
```
Paste this (change the domain), then save with **Ctrl+O, Enter, Ctrl+X**:
```nginx
server {
    listen 80;
    server_name <your-domain.com>;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**8.3 — Enable it and reload nginx:**
```bash
sudo ln -s /etc/nginx/sites-available/store-manager /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t          # should say "syntax is ok" / "test is successful"
sudo systemctl reload nginx
```
Now `http://<your-domain.com>` should work.

**8.4 — Add free HTTPS with Let's Encrypt:**
```bash
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d <your-domain.com>
```
Follow the prompts (enter your email, agree, choose to redirect HTTP→HTTPS).
Certbot auto-renews. Your site is now live at **https://<your-domain.com>** 🎉

> After HTTPS is working, ask the assistant to enable the `Secure` cookie flag for extra hardening.

---

## 9. First login — change the admin password

1. Open your URL and sign in with **admin / admin**.
2. Go to **Settings → Administrators**.
3. Under **Change My Password**, set a strong password and click **Update Password**.
4. (Optional) Add a second admin for the other person who'll use the app, then
   remove any account you don't need.

🔒 **Do this before sharing the link with anyone.** The default password is public knowledge.

---

## 10. Updating the app later

**If you used Git (Option A):**
```bash
cd ~/store-manager
git pull
npm install                 # only needed if dependencies changed
pm2 restart store-manager
```

**If you used WinSCP (Option B):** upload the changed files (again, skip
`node_modules` and `store.db*`), then:
```bash
cd ~/store-manager
npm install                 # only if package.json changed
pm2 restart store-manager
```

Your data in `store.db` is **never** touched by updates.

---

## 11. Backups

All your data — orders, customers, products, settings, **and your Shopify token**
— lives in a single file: `~/store-manager/store.db`. Back it up regularly.

**Download a copy to your PC** (run in PowerShell, on your PC):
```bash
scp deploy@<VPS_IP>:/home/deploy/store-manager/store.db ./store-backup.db
```

**Automatic daily backup on the server** (optional):
```bash
mkdir -p ~/backups
( crontab -l 2>/dev/null; echo "0 2 * * * cp ~/store-manager/store.db ~/backups/store-\$(date +\%F).db" ) | crontab -
```
This saves a dated copy every night at 02:00. Delete old ones occasionally.

---

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| **Site won't load** | `pm2 status` (is it `online`?), then `pm2 logs store-manager` to see errors. |
| **"database is locked" on start** | The app auto-clears stale locks on boot. If it persists: `pm2 stop store-manager`, then `rm -f ~/store-manager/store.db.lock ~/store-manager/store.db-journal`, then `pm2 start store-manager`. |
| **Port 3000 not reachable (IP option)** | `sudo ufw allow 3000`. |
| **nginx: 502 Bad Gateway** | The app isn't running — `pm2 restart store-manager` and check `pm2 logs`. |
| **`node: command not found`** | Re-run Step 4. Confirm with `node -v`. |
| **Forgot the admin password** | Reset it directly in the DB — ask the assistant for the one-line SQL command, or delete `store.db` to start fresh (⚠️ erases all data). |
| **Changes not showing in browser** | Hard-refresh: **Ctrl + Shift + R** (the service worker caches the old version). |
| **App stops after you close SSH** | You skipped PM2 — do Step 7. Never run with plain `npm start` for production. |

---

## 13. Command cheat-sheet

```bash
# Connect
ssh deploy@<VPS_IP>

# App control
pm2 status
pm2 logs store-manager
pm2 restart store-manager

# Update (Git)
cd ~/store-manager && git pull && npm install && pm2 restart store-manager

# Backup to your PC (run on PC)
scp deploy@<VPS_IP>:/home/deploy/store-manager/store.db ./store-backup.db

# nginx
sudo nginx -t && sudo systemctl reload nginx
```

---

### 📱 Install it like an app
Once it's live over HTTPS, open the URL on your phone → browser menu →
**"Add to Home Screen."** It installs as a full-screen Progressive Web App.

You're done. Enjoy your store manager! 🛒
