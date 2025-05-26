const API_URL = 'https://cimlgm4ovj.execute-api.us-east-2.amazonaws.com/USE_CURRENT/minecraft';

let autoRefreshInterval = null;
let serverStartTime = null;
let lastKnownStatus = null;
let activityHistory = JSON.parse(localStorage.getItem('mcServerHistory') || '[]');
let pendingAction = null;

// Cost estimation (adjust based on your instance type)
const HOURLY_COSTS = {
    't2.micro': 0.0116,
    't2.small': 0.023,
    't2.medium': 0.0464,
    't3.micro': 0.0104,
    't3.small': 0.0208,
    't3.medium': 0.0416,
    'm5.large': 0.096,
    'm5.xlarge': 0.192
};

async function makeRequest(action) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: action })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error:', error);
        return { 
            success: false, 
            error: error.message || 'Network connection failed'
        };
    }
}

async function startServer() {
    setLoading(true, 'start');
    const result = await makeRequest('start');
    
    if (result.success) {
        showMessage(result.message || 'Server start command sent!', 'success');
        addToHistory('Started', 'Server start initiated');
        setTimeout(checkStatus, 3000);
    } else {
        showMessage(result.error || 'Failed to start server', 'error');
    }
    setLoading(false, 'start');
}

async function stopServer() {
    setLoading(true, 'stop');
    const result = await makeRequest('stop');
    
    if (result.success) {
        showMessage(result.message || 'Server stop command sent!', 'success');
        addToHistory('Stopped', 'Server stop initiated');
        setTimeout(checkStatus, 3000);
    } else {
        showMessage(result.error || 'Failed to stop server', 'error');
    }
    setLoading(false, 'stop');
}

async function checkStatus() {
    setLoading(true, 'refresh');
    const result = await makeRequest('status');
    
    if (result.success) {
        updateStatusDisplay(result);
        updateMetrics(result);
        
        // Track server start time
        if (result.status === 'running' && lastKnownStatus !== 'running') {
            serverStartTime = new Date();
            addToHistory('Online', 'Server came online');
        } else if (result.status === 'stopped' && lastKnownStatus === 'running') {
            serverStartTime = null;
            addToHistory('Offline', 'Server went offline');
        }
        
        lastKnownStatus = result.status;
    } else {
        document.getElementById('status').textContent = 'Error checking status';
        document.getElementById('statusDetails').textContent = result.error || 'Unknown error';
        showMessage(result.error || 'Failed to check server status', 'error');
    }
    setLoading(false, 'refresh');
}

function updateStatusDisplay(result) {
    const statusElement = document.getElementById('status');
    const detailsElement = document.getElementById('statusDetails');
    const indicatorElement = document.getElementById('statusIndicator');
    const section = document.querySelector('.status-section');
    
    const statusMap = {
        'running': { 
            text: '🟢 Server Online', 
            details: result.message || 'Server is running and ready for players!',
            class: 'status-running'
        },
        'stopped': { 
            text: '🔴 Server Offline', 
            details: result.message || 'Server is stopped',
            class: 'status-stopped'
        },
        'pending': { 
            text: '🟡 Starting Up', 
            details: result.message || 'Server is starting...',
            class: 'status-pending'
        },
        'stopping': { 
            text: '🟠 Shutting Down', 
            details: result.message || 'Server is stopping...',
            class: 'status-stopping'
        }
    };
    
    const statusInfo = statusMap[result.status] || {
        text: `❓ ${result.status}`,
        details: result.message || 'Unknown status',
        class: 'status-pending'
    };
    
    statusElement.textContent = statusInfo.text;
    detailsElement.textContent = statusInfo.details;
    
    // Update visual indicators
    section.className = `status-section ${statusInfo.class}`;
    indicatorElement.className = `status-indicator ${statusInfo.class}`;
}

function updateMetrics(result) {
    // Update uptime
    const uptimeElement = document.getElementById('uptimeValue');
    if (result.status === 'running' && serverStartTime) {
        const uptime = Math.floor((new Date() - serverStartTime) / 1000 / 60);
        uptimeElement.textContent = uptime < 60 ? `${uptime}m` : `${Math.floor(uptime/60)}h ${uptime%60}m`;
    } else {
        uptimeElement.textContent = result.status === 'running' ? 'Unknown' : '--';
    }
    
    // Update estimated cost (assuming t3.small by default)
    const costElement = document.getElementById('costValue');
    const instanceType = result.instance_type || 'm5.xlarge';
    const hourlyCost = HOURLY_COSTS[instanceType] || HOURLY_COSTS['t3.small'];
    const dailyCost = (hourlyCost * 24).toFixed(2);
    costElement.textContent = result.status === 'running' ? `$${dailyCost}` : '$0.00';
    
    // Update IP address
    const ipElement = document.getElementById('ipValue');
    ipElement.textContent = result.public_ip || '--';
    
    // Update last action
    const lastActionElement = document.getElementById('lastActionValue');
    if (activityHistory.length > 0) {
        const lastAction = activityHistory[0];
        const timeAgo = getTimeAgo(new Date(lastAction.timestamp));
        lastActionElement.textContent = timeAgo;
    }
}

function addToHistory(action, details) {
    const historyItem = {
        action: action,
        details: details,
        timestamp: new Date().toISOString()
    };
    
    activityHistory.unshift(historyItem);
    activityHistory = activityHistory.slice(0, 10); // Keep only last 10 items
    
    localStorage.setItem('mcServerHistory', JSON.stringify(activityHistory));
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const historyLog = document.getElementById('historyLog');
    
    if (activityHistory.length === 0) {
        historyLog.innerHTML = '<div class="history-item"><span>No activity recorded yet</span><span class="history-time">--</span></div>';
        return;
    }
    
    historyLog.innerHTML = activityHistory.map(item => {
        const timeAgo = getTimeAgo(new Date(item.timestamp));
        return `
            <div class="history-item">
                <div>
                    <div class="history-action">${item.action}</div>
                    <div style="font-size: 0.8rem; color: #666;">${item.details}</div>
                </div>
                <span class="history-time">${timeAgo}</span>
            </div>
        `;
    }).join('');
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

function confirmAction(action) {
    pendingAction = action;
    const modal = document.getElementById('confirmationModal');
    const title = document.getElementById('confirmTitle');
    const message = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    
    if (action === 'start') {
        title.textContent = 'Start Server';
        message.textContent = 'Are you sure you want to start the Minecraft server? This will begin charging for the instance.';
        confirmBtn.textContent = '🚀 Start Server';
        confirmBtn.className = 'btn-start';
    } else if (action === 'stop') {
        title.textContent = 'Stop Server';
        message.textContent = 'Are you sure you want to stop the server? Any players will be disconnected.';
        confirmBtn.textContent = '🛑 Stop Server';
        confirmBtn.className = 'btn-stop';
    }
    
    modal.style.display = 'block';
    
    confirmBtn.onclick = function() {
        closeConfirmation();
        if (pendingAction === 'start') {
            startServer();
        } else if (pendingAction === 'stop') {
            stopServer();
        }
    };
}

function closeConfirmation() {
    document.getElementById('confirmationModal').style.display = 'none';
    pendingAction = null;
}

function toggleAutoRefresh() {
    const toggle = document.getElementById('autoRefreshToggle');
    const status = document.getElementById('refreshStatus');
    
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        toggle.classList.remove('active');
        status.textContent = 'OFF';
    } else {
        autoRefreshInterval = setInterval(checkStatus, 30000);
        toggle.classList.add('active');
        status.textContent = 'ON (30s)';
    }
}

function setLoading(loading, buttonType) {
    const buttons = {
        'start': document.getElementById('startBtn'),
        'stop': document.getElementById('stopBtn'),
        'refresh': document.getElementById('refreshBtn')
    };
    
    if (buttonType && buttons[buttonType]) {
        const button = buttons[buttonType];
        button.disabled = loading;
        
        if (loading) {
            button.classList.add('loading');
            button.innerHTML = '';
        } else {
            button.classList.remove('loading');
            const originalText = {
                'start': '🚀 Start Server',
                'stop': '🛑 Stop Server',
                'refresh': '🔄 Refresh'
            };
            button.innerHTML = originalText[buttonType];
        }
    }
}

function showMessage(message, type) {
    const messageElement = document.getElementById('message');
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    messageElement.style.display = 'block';
    
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 5000);
}

// Event listeners
document.getElementById('autoRefreshToggle').addEventListener('click', toggleAutoRefresh);

// Close modal when clicking outside
document.getElementById('confirmationModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeConfirmation();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    updateHistoryDisplay();
    checkStatus();
});
