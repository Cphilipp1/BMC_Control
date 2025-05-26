const API_URL = 'https://cimlgm4ovj.execute-api.us-east-2.amazonaws.com/USE_CURRENT';

async function makeRequest(action) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: action })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error:', error);
        return { success: false, error: 'Network error' };
    }
}

async function startServer() {
    setLoading(true);
    const result = await makeRequest('start');
    
    if (result.success) {
        showMessage(result.message, 'success');
        setTimeout(checkStatus, 2000);
    } else {
        showMessage(result.error || 'Failed to start server', 'error');
    }
    setLoading(false);
}

async function stopServer() {
    setLoading(true);
    const result = await makeRequest('stop');
    
    if (result.success) {
        showMessage(result.message, 'success');
        setTimeout(checkStatus, 2000);
    } else {
        showMessage(result.error || 'Failed to stop server', 'error');
    }
    setLoading(false);
}

async function checkStatus() {
    const result = await makeRequest('status');
    const statusElement = document.getElementById('status');
    
    if (result.success) {
        statusElement.textContent = result.status.charAt(0).toUpperCase() + result.status.slice(1);
        statusElement.className = `status-display status-${result.status}`;
    } else {
        statusElement.textContent = 'Error checking status';
        statusElement.className = 'status-display';
    }
}

function setLoading(loading) {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    startBtn.disabled = loading;
    stopBtn.disabled = loading;
    
    if (loading) {
        startBtn.textContent = 'Working...';
        stopBtn.textContent = 'Working...';
    } else {
        startBtn.textContent = 'Start Server';
        stopBtn.textContent = 'Stop Server';
    }
}

function showMessage(message, type) {
    const messageElement = document.getElementById('message');
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    
    setTimeout(() => {
        messageElement.textContent = '';
        messageElement.className = 'message';
    }, 5000);
}

// Check status on page load
checkStatus();
setInterval(checkStatus, 10000); // Auto-refresh every 10 seconds
