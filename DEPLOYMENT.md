# Deployment Checklist

## Quick Start (Development)

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
python run.py
```
Backend will start on **http://localhost:5013**

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend will start on **http://localhost:5173**

### 3. Login
- Username: `admin@mail.com`
- Password: `Alchohol@123`

---

## Production Deployment

### Backend Setup

1. **Install dependencies:**
   ```bash
   cd /home/mqtt-dashboard/backend
   python3 -m venv /home/mqtt-dashboard/venv
   source /home/mqtt-dashboard/venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Create .env file** (optional):
   ```bash
   nano /home/mqtt-dashboard/backend/.env
   ```
   ```env
   JWT_SECRET_KEY=your-super-secret-random-key-here
   MQTT_HOST=localhost
   MQTT_PORT=1883
   ```

3. **Install systemd service:**
   ```bash
   sudo cp mosquitto-dashboard.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable mosquitto-dashboard
   sudo systemctl start mosquitto-dashboard
   ```

4. **Check status:**
   ```bash
   sudo systemctl status mosquitto-dashboard
   ```

### Frontend Setup

1. **Build frontend:**
   ```bash
   cd /home/mqtt-dashboard/frontend
   npm install
   npm run build
   ```
   Static files will be in `dist/` directory

2. **Install nginx config:**
   ```bash
   sudo cp mqtt.zvolta.com.conf /etc/nginx/sites-available/
   sudo ln -s /etc/nginx/sites-available/mqtt.zvolta.com /etc/nginx/sites-enabled/
   ```

3. **Setup SSL (Let's Encrypt):**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d mqtt.zvolta.com
   ```

4. **Test and reload nginx:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## Troubleshooting

### "Unexpected token '<'" Error on Login

**Problem:** Frontend receiving HTML instead of JSON from API

**Solutions:**

1. **Backend not running:**
   ```bash
   # Check if backend is running
   sudo systemctl status mosquitto-dashboard
   
   # Or check the process
   ps aux | grep python | grep run.py
   
   # Test backend directly
   curl http://localhost:5013/api/auth/login
   ```

2. **Wrong port in development:**
   - Backend should run on port **5013**
   - Check `vite.config.js` proxy is set to `http://localhost:5013`
   - Check `backend/run.py` has `port=5013`

3. **CORS issues:**
   - Check `backend/main.py` has your domain in `allow_origins`
   - For development, should include `http://localhost:5173`

4. **Nginx misconfiguration (production):**
   ```bash
   # Check nginx config
   sudo nginx -t
   
   # Check nginx logs
   sudo tail -f /var/log/nginx/mqtt-dashboard-error.log
   ```

### Default Credentials Not Showing

If you don't see default credentials on login page:
- Clear browser cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check browser console for errors

### Database Initialization Issues

```bash
# Check if database exists
ls -la /home/mqtt-dashboard/backend/services/dashboard.db

# If needed, delete and recreate
rm /home/mqtt-dashboard/backend/services/dashboard.db
sudo systemctl restart mosquitto-dashboard
```

### Backend Logs

```bash
# View systemd logs
sudo journalctl -u mosquitto-dashboard -f

# Or if running directly
cd backend
python run.py
# Watch console output
```

### Port Already in Use

```bash
# Check what's using port 5013
sudo lsof -i :5013

# Kill the process if needed
sudo kill <PID>
```

---

## Health Checks

### Backend Health
```bash
# Should return 200 OK
curl http://localhost:5013/api/v1/systree

# Login endpoint (should return 422 for empty body)
curl -X POST http://localhost:5013/api/auth/login
```

### Frontend (Production)
```bash
# Should return HTML
curl https://mqtt.zvolta.com

# API should proxy correctly
curl https://mqtt.zvolta.com/api/v1/systree
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Backend won't start | Check Python version (3.8+), reinstall dependencies |
| Frontend build fails | Delete `node_modules`, run `npm install` again |
| Login fails | Check backend is running on port 5013 |
| 502 Bad Gateway | Backend not running, check systemd status |
| 401 Unauthorized | Token expired, logout and login again |
| Can't access as admin | Check user role in database |

---

## Important Files

### Backend
- `backend/run.py` - Server startup script
- `backend/main.py` - FastAPI app configuration
- `backend/services/database.py` - Database models
- `backend/services/dashboard.db` - SQLite database (created on first run)
- `backend/.env` - Environment variables (optional)

### Frontend
- `frontend/vite.config.js` - Dev server proxy configuration
- `frontend/src/contexts/AuthContext.jsx` - Authentication logic
- `frontend/dist/` - Built static files (after `npm run build`)

### Configuration
- `backend/mosquitto-dashboard.service` - Systemd service
- `frontend/mqtt.zvolta.com.conf` - Nginx configuration
