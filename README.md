# Mosquitto Dashboard

A React + FastAPI web dashboard for managing a locally running Eclipse Mosquitto MQTT broker.  
Features: live metrics (`$SYS` topics), listener overview, topic tree, log viewer, user management, ACL editor, TLS certificate manager, and a live config editor with dry-run validation and automatic backups.

---

## Prerequisites

| Dependency | Minimum version |
|---|---|
| Eclipse Mosquitto | 2.0 (required for `--test-config` dry-run) |
| Python | 3.11 |
| Node.js + npm | Node 20 / npm 9 |

---

## 1. Mosquitto Server Configuration

### Enable the WebSocket listener

Add to `/etc/mosquitto/mosquitto.conf` (or a file in `/etc/mosquitto/conf.d/`):

```conf
# Standard MQTT listener
listener 1883
protocol mqtt

# WebSocket listener (required for dashboard real-time features)
listener 9001
protocol websockets

# Log to file (required for the Logs page)
log_dest file /var/log/mosquitto/mosquitto.log
log_type all

# Enable password file authentication
password_file /etc/mosquitto/passwd

# Enable ACL file
acl_file /etc/mosquitto/acl

# Disallow anonymous connections
allow_anonymous false
```

### Create initial password and ACL files (if they don't exist)

```bash
sudo touch /etc/mosquitto/passwd /etc/mosquitto/acl
sudo chmod 660 /etc/mosquitto/passwd /etc/mosquitto/acl
sudo chown root:mosquitto /etc/mosquitto/passwd /etc/mosquitto/acl
```

---

## 2. File System Permissions

The application user (e.g. `ubuntu`, `pi`, or whatever account runs the dashboard) must be able to read and write the Mosquitto config files.

### Add the app user to the `mosquitto` group

```bash
sudo usermod -aG mosquitto $USER
# Log out and back in (or run: newgrp mosquitto) for the group change to take effect
```

### Set ownership and permissions on config files

```bash
# Config directory readable by mosquitto group
sudo chown -R root:mosquitto /etc/mosquitto
sudo chmod -R 750 /etc/mosquitto

# Config files writable by mosquitto group members
sudo chmod 660 /etc/mosquitto/mosquitto.conf
sudo chmod 660 /etc/mosquitto/acl
sudo chmod 660 /etc/mosquitto/passwd

# Certs directory writable by mosquitto group (for TLS upload)
sudo chown root:mosquitto /etc/mosquitto/certs
sudo chmod 770 /etc/mosquitto/certs

# Log directory readable by app user
sudo chown -R mosquitto:mosquitto /var/log/mosquitto
sudo chmod 750 /var/log/mosquitto
sudo chmod 640 /var/log/mosquitto/mosquitto.log
```

> **Note:** After adding the user to the `mosquitto` group, restart the service and re-login before starting the dashboard. Certificate files uploaded via the dashboard are stored with `640` permissions (`root:mosquitto`).

### Allow broker reload without a password

The dashboard sends `SIGHUP` to the Mosquitto process. If that is not available (e.g. running as a different user), it falls back to `sudo systemctl reload mosquitto`.  
Add a sudoers rule to allow passwordless reload:

```bash
sudo visudo -f /etc/sudoers.d/mosquitto-reload
```

Add the line (replace `appuser` with the actual username):

```
appuser ALL=(ALL) NOPASSWD: /bin/systemctl reload mosquitto
```

---

## 3. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Configure environment

```bash
cp ../.env.example ../.env
# Edit .env and adjust paths / MQTT credentials if needed
```

Key variables in `.env`:

| Variable | Default | Description |
|---|---|---|
| `MOSQUITTO_HOST` | `localhost` | Broker host for paho-mqtt |
| `MOSQUITTO_PORT` | `1883` | Broker MQTT port |
| `MOSQUITTO_WS_PORT` | `9001` | WebSocket port |
| `MOSQUITTO_CONFIG_FILE` | `/etc/mosquitto/mosquitto.conf` | Main config path |
| `MOSQUITTO_PASSWD_FILE` | `/etc/mosquitto/passwd` | Password file path |
| `MOSQUITTO_ACL_FILE` | `/etc/mosquitto/acl` | ACL file path |
| `MOSQUITTO_CERTS_DIR` | `/etc/mosquitto/certs` | TLS certificates directory |
| `MOSQUITTO_LOG_FILE` | `/var/log/mosquitto/mosquitto.log` | Log file to tail |
| `MOSQUITTO_PID_FILE` | `/run/mosquitto/mosquitto.pid` | PID file for SIGHUP reload |
| `MQTT_USERNAME` | *(empty)* | Username for dashboard's internal paho-mqtt connection |
| `MQTT_PASSWORD` | *(empty)* | Password for dashboard's internal paho-mqtt connection |

### Run development server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 4. Frontend Setup

### Development (with Vite proxy to backend)

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### Production build (served by FastAPI)

```bash
cd frontend
npm install
npm run build
# Built files go to frontend/dist/
# FastAPI automatically serves them from /
```

After building, the FastAPI server at port `8000` will serve both the API and the SPA.

---

## 5. Production Deployment

### systemd service for the backend

Create `/etc/systemd/system/mosquitto-dashboard.service`:

```ini
[Unit]
Description=Mosquitto Dashboard (FastAPI)
After=network.target mosquitto.service
Requires=mosquitto.service

[Service]
Type=simple
User=appuser
Group=mosquitto
WorkingDirectory=/opt/mosquitto-dashboard/backend
EnvironmentFile=/opt/mosquitto-dashboard/.env
ExecStart=/opt/mosquitto-dashboard/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mosquitto-dashboard
```

### nginx HTTPS reverse proxy

```nginx
server {
    listen 443 ssl;
    server_name dashboard.example.com;

    ssl_certificate     /etc/letsencrypt/live/dashboard.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;

        # WebSocket upgrade support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name dashboard.example.com;
    return 301 https://$host$request_uri;
}
```

---

## 6. Config Backups

Every time the config is saved through the dashboard, the previous file is automatically backed up with a UTC timestamp suffix, e.g.:

```
mosquitto.conf.bak.20250101T120000Z
```

The last **5** backups are retained; older ones are pruned automatically.

Backups are stored in the same directory as `mosquitto.conf` (typically `/etc/mosquitto/`).

### Manual restore

```bash
# List backups
ls -lt /etc/mosquitto/mosquitto.conf.bak.*

# Restore a specific backup
sudo cp /etc/mosquitto/mosquitto.conf.bak.20250101T120000Z /etc/mosquitto/mosquitto.conf
sudo systemctl reload mosquitto
```

Alternatively, use the **Config → Backups** panel in the dashboard UI to restore with one click.

---

## 7. Project Structure

```
.
├── backend/                  FastAPI application
│   ├── main.py               App entry point, lifespan, StaticFiles
│   ├── config.py             Environment variable config
│   ├── requirements.txt
│   ├── services/
│   │   ├── mqtt_client.py    paho-mqtt singleton, $SYS + topic capture
│   │   ├── log_watcher.py    Async log file tail
│   │   └── config_manager.py Dry-run validation + backup/restore
│   └── routers/
│       ├── systree.py        GET /api/v1/systree
│       ├── listeners.py      GET /api/v1/listeners
│       ├── users.py          CRUD /api/v1/users
│       ├── acl.py            GET/PUT /api/v1/acl
│       ├── config.py         GET/PUT/validate/backup /api/v1/config
│       ├── tls.py            GET/POST/DELETE /api/v1/tls
│       ├── broker.py         POST /api/v1/broker/reload
│       └── websocket.py      WS /ws/topics  WS /ws/logs
├── frontend/                 React + Vite SPA
│   ├── src/
│   │   ├── pages/            Dashboard, Listeners, Topics, Logs, Users, ACL, TLS, Config
│   │   ├── components/       Layout, StatCard, Modal
│   │   └── hooks/            useWebSocket, useSysTree
│   └── dist/                 Production build (served by FastAPI)
├── legacy/                   Original vanilla-JS dashboard (reference)
├── .env.example              Environment variable template
└── README.md                 This file
```
