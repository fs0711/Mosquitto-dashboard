# Nginx Configuration Setup

## Prerequisites
1. Nginx installed on your server
2. Frontend built and ready to deploy
3. SSL certificate (Let's Encrypt recommended)

## Installation Steps

### 1. Build the Frontend
```bash
cd /home/mqtt-dashboard/frontend
npm install
npm run build
```

### 2. Install SSL Certificate (Let's Encrypt)
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d mqtt.zvolta.com
```

### 3. Copy Nginx Configuration
```bash
sudo cp mqtt.zvolta.com.conf /etc/nginx/sites-available/mqtt.zvolta.com
```

### 4. Create Symbolic Link
```bash
sudo ln -s /etc/nginx/sites-available/mqtt.zvolta.com /etc/nginx/sites-enabled/
```

### 5. Test Nginx Configuration
```bash
sudo nginx -t
```

### 6. Reload Nginx
```bash
sudo systemctl reload nginx
```

## SSL Certificate Auto-Renewal

Certbot automatically sets up certificate renewal. Verify it's enabled:
```bash
sudo systemctl status certbot.timer
```

Test renewal process:
```bash
sudo certbot renew --dry-run
```

## Managing Nginx

### Check status
```bash
sudo systemctl status nginx
```

### View access logs
```bash
sudo tail -f /var/log/nginx/mqtt-dashboard-access.log
```

### View error logs
```bash
sudo tail -f /var/log/nginx/mqtt-dashboard-error.log
```

### Reload configuration (no downtime)
```bash
sudo systemctl reload nginx
```

### Restart Nginx
```bash
sudo systemctl restart nginx
```

## Configuration Details

The nginx configuration includes:
- **HTTP to HTTPS redirect** - All traffic redirected to secure connection
- **SSL/TLS** - Modern encryption protocols (TLSv1.2, TLSv1.3)
- **Static file serving** - Frontend served from `/home/mqtt-dashboard/frontend/dist`
- **API proxy** - Backend requests proxied to `localhost:5013`
- **WebSocket support** - Proper headers for WebSocket connections
- **Caching** - Static assets cached for 1 year
- **Gzip compression** - Reduced bandwidth usage
- **Security headers** - XSS, frame, and content-type protection

## Troubleshooting

### Port 80/443 already in use
```bash
sudo netstat -tlnp | grep -E ':(80|443)'
```

### Permission denied errors
Ensure nginx user has read permissions:
```bash
sudo chown -R www-data:www-data /home/mqtt-dashboard/frontend/dist
sudo chmod -R 755 /home/mqtt-dashboard/frontend/dist
```

### Backend connection refused
Verify backend is running:
```bash
sudo systemctl status mosquitto-dashboard
curl http://localhost:5013/api/
```

### WebSocket connection issues
Check nginx error logs and ensure Upgrade headers are properly configured.
