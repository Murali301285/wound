# Windows VPS Deployment Guide (PM2 Hosting)

This guide walks you through deploying the **WoundCare** full-stack application on a **Windows VPS** with PM2.

---

## Port Allocation

| Component | Internal / External | Port | Description |
| :--- | :--- | :--- | :--- |
| **Backend (Python / Flask / Waitress)** | Internal (`127.0.0.1`) | **`3365`** | GNN inference, simulation, SOAP note API |
| **Frontend (Node.js / Express)** | Public / External | **`3367`** | Serves React UI & reverse-proxies `/api` to `3365` |

> **Important**: You only need to open **Port 3367** in your Windows Firewall. All API calls from client browsers go to `http://<YOUR_VPS_IP>:3367/api/*` and are proxied locally to port `3365`.

---

## 1. Prerequisites on Windows VPS

1. **Install Node.js (v18 or v20 LTS)**:
   - Download & install from [nodejs.org](https://nodejs.org/).
2. **Install Python (3.10 or 3.11)**:
   - Download & install from [python.org](https://www.python.org/).
   - ⚠️ Check the box **"Add Python to PATH"** during installation.
3. **Install PM2 globally**:
   ```powershell
   npm install -g pm2
   ```

---

## 2. Configure Environment Variables

1. Open or create `backend/.env`:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   PORT=3365
   HOST=127.0.0.1
   USE_WAITRESS=1
   ```

---

## 3. Deploy and Start with One Click

Run the included deployment script:

```powershell
.\deploy.bat
```

This script will automatically:
1. Create and activate the Python virtual environment (`backend/venv`).
2. Install/update all Python dependencies from `backend/requirements.txt`.
3. Install frontend dependencies and build the optimized production package (`npm run build`).
4. Start both backend (Port 3365) and frontend (Port 3367) under PM2.
5. Save the PM2 process list.

---

## 4. Open Windows Firewall for Port 3367

Run this command in PowerShell as **Administrator**:

```powershell
New-NetFirewallRule -DisplayName "WoundCare Web (Port 3367)" -Direction Inbound -LocalPort 3367 -Protocol TCP -Action Allow
```

---

## 5. Enable PM2 Auto-Start on Windows Reboot (Optional but Recommended)

To ensure the application starts automatically whenever your Windows VPS restarts:

```powershell
npm install -g pm2-windows-service
pm2-service-install -n PM2
pm2 save
```

---

## 6. PM2 Useful Commands

| Command | Action |
| :--- | :--- |
| `pm2 status` | Check status of backend and frontend processes |
| `pm2 logs` | View real-time output and error logs |
| `pm2 logs woundcare-backend` | View only backend logs |
| `pm2 logs woundcare-frontend` | View only frontend logs |
| `pm2 restart all` | Restart both services |
| `pm2 stop all` | Stop both services |
| `.\stop.bat` | Stop all processes using script |
