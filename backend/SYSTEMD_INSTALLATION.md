# Systemd Service Installation

## Prerequisites
1. Install Python dependencies in a virtual environment
2. Adjust paths in the service file to match your deployment

## Installation Steps

### 1. Customize the service file
Edit `mosquitto-dashboard.service` and update the following paths:
- `WorkingDirectory`: Path to your backend directory
- `Environment PATH`: Path to your Python virtual environment
- `ExecStart`: Path to your Python interpreter and run.py
- `User` and `Group`: System user to run the service (default: mosquitto)

### 2. Copy service file to systemd
```bash
sudo cp mosquitto-dashboard.service /etc/systemd/system/
```

### 3. Reload systemd daemon
```bash
sudo systemctl daemon-reload
```

### 4. Enable service to start on boot
```bash
sudo systemctl enable mosquitto-dashboard
```

### 5. Start the service
```bash
sudo systemctl start mosquitto-dashboard
```

## Managing the Service

### Check status
```bash
sudo systemctl status mosquitto-dashboard
```

### View logs
```bash
sudo journalctl -u mosquitto-dashboard -f
```

### Restart service
```bash
sudo systemctl restart mosquitto-dashboard
```

### Stop service
```bash
sudo systemctl stop mosquitto-dashboard
```

### Disable service
```bash
sudo systemctl disable mosquitto-dashboard
```

## Example Deployment Structure
```
/home/mqtt-dashboard/
├── backend/
│   ├── run.py
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   └── ...
└── venv/
    └── bin/
        └── python
```
