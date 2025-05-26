const API_URL = 'https://cimlgm4ovj.execute-api.us-east-2.amazonaws.com/USE_CURRENT/minecraft';

let autoRefreshInterval = null;
let serverStartTime = null;
let lastKnownStatus = null;
let activityHistory = JSON.parse(localStorage.getItem('mcServerHistory') || '[]');
let pendingAction = null;

const HOURLY_COSTS = {
    't2.micro': 0.0116, 't2.small': 0.023, 't2.medium': 0.0464,
    't3.micro': 0.0104, 't3.small': 0.0208, 't3.medium': 0.0416,
    'm5.large': 0.096, 'm5.xlarge': 0.192
};

async function makeRequest(action) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        return { success: false, error: error.message || 'Network error' };
    }
}

async function startServer() {
    setLoading(true, 'start');
    const result = await makeRequest('start');
    if (result.success) {
        showMessage(result.message || 'Server starting...', 'success');
        addToHistory('Started', 'Server start initiated');
        setTimeout(checkStatus, 3000);
    } else {
        showMessage(result.error || 'Start failed', 'error');
    }
    setLoading(false, 'start');
}

async function stopServer() {
    setLoading(true, 'stop');
    const result = await makeRequest('stop');
    if (result.success) {
        showMessage(result.message || 'Server stopping...', 'success');
        addToHistory('Stopped', 'Server stop initiated');
        setTimeout(checkStatus, 3000);
    } else {
        showMessage(result.error || 'Stop failed', 'error');
    }
    setLoading(false, 'stop');
}

async function checkStatus() {
    setLoading(true, 'refresh');
    const result = await makeRequest('status');
    if (result.success) {
        updateStatusDisplay(result);
        updateMetrics(result);
        if (result.status === 'running' && lastKnownStatus !== 'running') {
            serverStartTime = new Date();
            addToHistory('Online', 'Server came online');
        } else if (result.status === 'stopped' && lastKnownStatus === 'running') {
            serverStartTime = null;
            addToHistory('Offline', 'Server went offline');
        }
        lastKnownStatus = result.status;
    } else {
        document.getElementById('status').textContent = 'Error';
        document.getElementById('statusDetails').textContent = result.error || 'Unknown';
        showMessage(result.error || 'Status check failed', 'error');
    }
    setLoading(false, 'refresh');
}

function updateStatusDisplay(result) {
    const status = document.getElementById('status');
    const details = document.getElementById('statusDetails');
    const indicator = document.getElementById('statusIndicator');
    const section = document.querySelector('.status-section');

    const statusMap = {
        running: { text: '🟢 Server Online', details: result.message || '', class: 'status-running' },
        stopped: { text: '🔴 Server Offline', details: result.message || '', class: 'status-stopped' },
        pending: { text: '🟡 Starting Up', details: result.message || '', class: 'status-pending' },
        stopping: { text: '🟠 Shutting Down', details: result.message || '', class: 'status-stopping' }
    };

    const info = statusMap[result.status] || {
        text: `❓ ${result.status}`,
        details: result.message || 'Unknown',
        class: 'status-pending'
    };

    status.textContent = info.text;
    details.textContent = info.details;
    section.className = `status-section ${info.class}`;
    indicator.className = `status-indicator ${info.class}`;
}

function updateMetrics(result) {
    const uptimeEl = document.getElementById('uptimeValue');
    if (result.status === 'running' && serverStartTime) {
        const uptime = Math.floor((new Date() - serverStartTime) / 60000);
        uptimeEl.textContent = uptime < 60 ? `${uptime}m` : `${Math.floor(uptime / 60)}h ${uptime % 60}m`;
    } else {
        uptimeEl.textContent = result.status === 'running' ? 'Unknown' : '--';
    }

    const costEl = document.getElementById('costValue');
    const instance = result.instance_type || 'm5.xlarge';
    const daily = ((HOURLY_COSTS[instance] || HOURLY_COSTS['t3.small']) * 24).toFixed(2);
    costEl.textContent = result.status === 'running' ? `$${daily}` : '$0.00';

    document.getElementById('ipValue').textContent = result.public_ip || '--';
    document.getElementById('joinAddress').textContent = `${result.public_ip}:25565` || '--';

    const lastActionEl = document.getElementById('lastActionValue');
    if (activityHistory.length > 0) {
        const last = activityHistory[0];
        lastActionEl.textContent = getTimeAgo(new Date(last.timestamp));
    }
}

function addToHistory(action, details) {
    const entry = { action, details, timestamp: new Date().toISOString() };
    activityHistory.unshift(entry);
    activityHistory = activityHistory.slice(0, 10);
    localStorage.setItem('mcServerHistory', JSON.stringify(activityHistory));
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const log = document.getElementById('historyLog');
    if (activityHistory.length === 0) {
        log.innerHTML = `<div class="history-item"><span>No activity recorded yet</span><span class="history-time">--</span></div>`;
        return;
    }

    log.innerHTML = activityHistory.map(item => {
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
    const mins = Math.floor((now - date) / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

function confirmAction(action) {
    pendingAction = action;
    const modal = document.getElementById('confirmationModal');
    const title = document.getElementById('confirmTitle');
    const msg = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');

    if (action === 'start') {
        title.textContent = 'Start Server';
        msg.textContent = 'Are you sure you want to start the server?';
        confirmBtn.textContent = '🚀 Start Server';
        confirmBtn.className = 'btn-start';
    } else {
        title.textContent = 'Stop Server';
        msg.textContent = 'Are you sure you want to stop the server?';
        confirmBtn.textContent = '🛑 Stop Server';
        confirmBtn.className = 'btn-stop';
    }

    modal.style.display = 'block';
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

function setLoading(isLoading, type) {
    const map = {
        start: document.getElementById('startBtn'),
        stop: document.getElementById('stopBtn'),
        refresh: document.getElementById('refreshBtn')
    };
    const btn = map[type];
    if (!btn) return;

    btn.disabled = isLoading;
    if (isLoading) {
        btn.classList.add('loading');
        btn.innerHTML = '';
    } else {
        btn.classList.remove('loading');
        btn.innerHTML = {
            start: '🚀 Start Server',
            stop: '🛑 Stop Server',
            refresh: '🔄 Refresh'
        }[type];
    }
}

function showMessage(msg, type) {
    const el = document.getElementById('message');
    el.textContent = msg;
    el.className = `message ${type}`;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 5000);
}

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('confirmBtn').addEventListener('click', () => {
        if (pendingAction === 'start') startServer();
        else if (pendingAction === 'stop') stopServer();
        closeConfirmation();
    });

    document.getElementById('autoRefreshToggle').addEventListener('click', toggleAutoRefresh);
    document.getElementById('confirmationModal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeConfirmation();
    });

    updateHistoryDisplay();
    checkStatus();
});
