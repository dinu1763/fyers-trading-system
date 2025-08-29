# FYERS Trading System - Deployment Guide

This guide covers deploying the FYERS algorithmic trading system to production environments.

## Table of Contents
1. [Pre-deployment Checklist](#pre-deployment-checklist)
2. [Local Development Setup](#local-development-setup)
3. [Production Environment Setup](#production-environment-setup)
4. [Cloud Deployment Options](#cloud-deployment-options)
5. [Monitoring and Maintenance](#monitoring-and-maintenance)
6. [Security Considerations](#security-considerations)
7. [Troubleshooting](#troubleshooting)

## Pre-deployment Checklist

### ✅ Code Readiness
- [ ] All tests passing (`npm test`)
- [ ] Code linted and formatted (`npm run lint`)
- [ ] Environment variables configured
- [ ] API credentials validated
- [ ] Trading strategies tested with paper trading
- [ ] Risk management parameters configured
- [ ] Logging properly configured

### ✅ Infrastructure Readiness
- [ ] Server/VPS provisioned
- [ ] Node.js runtime installed (v18+ recommended)
- [ ] Process manager installed (PM2 recommended)
- [ ] Monitoring tools configured
- [ ] Backup strategy in place
- [ ] Network security configured

## Local Development Setup

### 1. Initial Setup
```bash
# Clone and setup
git clone <your-repo>
cd fyers-trading-system
npm install

# Run setup script
node scripts/setup.js

# Configure environment
cp .env.example .env
# Edit .env with your credentials
```

### 2. Authentication Setup
```bash
# Setup FYERS API authentication
node examples/auth-setup.js

# Test connection
node examples/auth-setup.js test
```

### 3. Development Mode
```bash
# Start in development mode
npm run dev

# Run tests
npm test

# Run quick start example
node examples/quickstart.js
```

## Production Environment Setup

### 1. Server Requirements
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Windows Server 2019+
- **RAM**: Minimum 2GB, Recommended 4GB+
- **CPU**: 2+ cores
- **Storage**: 20GB+ SSD
- **Network**: Stable internet connection with low latency

### 2. Node.js Installation
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Application Deployment
```bash
# Create application directory
sudo mkdir -p /opt/fyers-trading
sudo chown $USER:$USER /opt/fyers-trading
cd /opt/fyers-trading

# Deploy application
git clone <your-repo> .
npm ci --production

# Setup environment
cp .env.example .env
# Configure production environment variables
```

### 4. Process Manager Setup (PM2)
```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'fyers-trading',
    script: 'src/app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions provided by the command
```

### 5. System Service Setup (Alternative to PM2)
```bash
# Create systemd service file
sudo cat > /etc/systemd/system/fyers-trading.service << EOF
[Unit]
Description=FYERS Trading System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/fyers-trading
ExecStart=/usr/bin/node src/app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=fyers-trading

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable fyers-trading
sudo systemctl start fyers-trading

# Check status
sudo systemctl status fyers-trading
```

## Cloud Deployment Options

### 1. AWS EC2 Deployment
```bash
# Launch EC2 instance (t3.small or larger)
# Configure security groups (SSH, HTTP/HTTPS if needed)
# Connect to instance and follow production setup

# Optional: Use AWS Systems Manager for secure access
# Optional: Use AWS CloudWatch for monitoring
```

### 2. Google Cloud Platform
```bash
# Create Compute Engine instance
# Configure firewall rules
# Follow production setup steps

# Optional: Use Cloud Monitoring and Logging
```

### 3. DigitalOcean Droplet
```bash
# Create droplet (2GB RAM minimum)
# Follow production setup steps
# Configure monitoring and backups
```

### 4. Docker Deployment
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3000

USER node

CMD ["node", "src/app.js"]
```

```bash
# Build and run
docker build -t fyers-trading .
docker run -d --name fyers-trading \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  fyers-trading
```

## Monitoring and Maintenance

### 1. Application Monitoring
```bash
# PM2 monitoring
pm2 monit

# Check logs
pm2 logs fyers-trading

# Application status
pm2 status
```

### 2. System Monitoring
```bash
# Install monitoring tools
sudo apt install htop iotop nethogs

# Monitor system resources
htop
iotop
nethogs

# Check disk space
df -h

# Monitor network
netstat -tulpn
```

### 3. Log Management
```bash
# Setup log rotation
sudo cat > /etc/logrotate.d/fyers-trading << EOF
/opt/fyers-trading/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# Test log rotation
sudo logrotate -d /etc/logrotate.d/fyers-trading
```

### 4. Automated Backups
```bash
# Create backup script
cat > backup.sh << EOF
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/fyers-trading"
APP_DIR="/opt/fyers-trading"

mkdir -p $BACKUP_DIR

# Backup configuration and logs
tar -czf $BACKUP_DIR/fyers-trading-$DATE.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  $APP_DIR

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: fyers-trading-$DATE.tar.gz"
EOF

chmod +x backup.sh

# Add to crontab for daily backups
echo "0 2 * * * /opt/fyers-trading/backup.sh" | crontab -
```

## Security Considerations

### 1. Server Security
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 22/tcp

# Disable root login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Setup fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 2. Application Security
- Use environment variables for all sensitive data
- Implement API rate limiting
- Regular security updates
- Monitor for suspicious activities
- Use HTTPS for all external communications

### 3. API Security
- Rotate access tokens regularly
- Monitor API usage limits
- Implement proper error handling
- Log all trading activities

## Troubleshooting

### Common Issues

1. **Application Won't Start**
   ```bash
   # Check logs
   pm2 logs fyers-trading
   
   # Check environment variables
   cat .env
   
   # Test configuration
   node examples/auth-setup.js test
   ```

2. **High Memory Usage**
   ```bash
   # Monitor memory
   pm2 monit
   
   # Restart application
   pm2 restart fyers-trading
   
   # Check for memory leaks in logs
   ```

3. **API Connection Issues**
   ```bash
   # Test network connectivity
   ping api.fyers.in
   
   # Check API credentials
   node examples/auth-setup.js test
   
   # Verify access token
   ```

4. **WebSocket Connection Failures**
   ```bash
   # Check network connectivity
   telnet socket.fyers.in 443
   
   # Review WebSocket logs
   grep -i websocket logs/combined.log
   ```

### Performance Optimization

1. **Node.js Optimization**
   ```bash
   # Increase memory limit if needed
   node --max-old-space-size=4096 src/app.js
   ```

2. **System Optimization**
   ```bash
   # Increase file descriptor limits
   echo "* soft nofile 65536" >> /etc/security/limits.conf
   echo "* hard nofile 65536" >> /etc/security/limits.conf
   ```

## Maintenance Schedule

### Daily
- [ ] Check application status
- [ ] Review error logs
- [ ] Monitor system resources
- [ ] Verify trading activities

### Weekly
- [ ] Review performance metrics
- [ ] Check backup integrity
- [ ] Update dependencies (if needed)
- [ ] Review trading strategy performance

### Monthly
- [ ] Security updates
- [ ] Log cleanup
- [ ] Performance optimization
- [ ] Strategy backtesting

This deployment guide ensures a robust, secure, and maintainable production environment for your FYERS algorithmic trading system.
