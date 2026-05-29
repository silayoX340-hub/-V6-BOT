const socket = io();

// DOM elements
const connectBtn = document.getElementById('connect-btn');
const sessionDisplay = document.getElementById('session-display');
const copyBtn = document.getElementById('copy-session-btn');
const statusBar = document.getElementById('status-bar');
const qrPlaceholder = document.getElementById('qr-placeholder');
const qrCanvas = document.getElementById('qr-canvas');
const methodBtns = document.querySelectorAll('.method-btn');
const qrArea = document.getElementById('qr-area');
const pairingArea = document.getElementById('pairing-area');
const phoneInput = document.getElementById('phone-number');

let currentMethod = 'qr';
let currentSessionId = null;

// Helper: Generate session ID
function generateSessionId() {
    return `SILAYOX_${Date.now()}_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}

// Update status
function updateStatus(message, isError = false) {
    statusBar.innerHTML = `<span>${isError ? '⚠️' : '⚡'}</span> ${message}`;
    statusBar.style.background = isError ? 'rgba(255, 50, 50, 0.15)' : 'rgba(0, 0, 0, 0.5)';
    statusBar.style.color = isError ? '#ff8888' : '#88ccaa';
}

// Reset UI
function resetUI() {
    qrPlaceholder.style.display = 'flex';
    qrCanvas.style.display = 'none';
    sessionDisplay.textContent = '——————';
    copyBtn.disabled = true;
    currentSessionId = null;
}

// Tab switching
methodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        methodBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMethod = btn.dataset.method;
        
        if (currentMethod === 'qr') {
            qrArea.classList.add('active');
            pairingArea.classList.remove('active');
        } else {
            qrArea.classList.remove('active');
            pairingArea.classList.add('active');
        }
        resetUI();
        updateStatus('Ready to generate session');
    });
});

// Socket events
socket.on('qr-code', (data) => {
    updateStatus('QR code generated! Scan with WhatsApp');
    qrPlaceholder.style.display = 'none';
    qrCanvas.style.display = 'block';
    
    const img = new Image();
    img.src = data.qr;
    img.onload = () => {
        const ctx = qrCanvas.getContext('2d');
        qrCanvas.width = 220;
        qrCanvas.height = 220;
        ctx.drawImage(img, 0, 0, 220, 220);
    };
});

socket.on('pairing-code', (data) => {
    updateStatus(`Pairing code: ${data.code}`);
    alert(`🔢 Your 8-digit pairing code: ${data.code}\n\n${data.instructions}`);
});

socket.on('session-ready', (data) => {
    updateStatus('✅ Session connected successfully!');
    currentSessionId = data.sessionId;
    sessionDisplay.textContent = data.sessionId;
    copyBtn.disabled = false;
    localStorage.setItem('silayox_session', data.sessionId);
});

socket.on('error', (data) => {
    updateStatus(data.message, true);
});

// Connect button
connectBtn.addEventListener('click', () => {
    resetUI();
    const sessionId = generateSessionId();
    
    if (currentMethod === 'qr') {
        updateStatus('Generating QR code...');
        socket.emit('request-qr', { sessionId });
    } else {
        const phone = phoneInput.value.trim();
        if (!phone) {
            updateStatus('Please enter your phone number', true);
            return;
        }
        const cleanPhone = phone.replace(/[\s\-+]/g, '');
        updateStatus(`Requesting pairing code...`);
        socket.emit('request-pairing', { sessionId, phoneNumber: cleanPhone });
    }
});

// Copy session ID
copyBtn.addEventListener('click', async () => {
    if (currentSessionId) {
        await navigator.clipboard.writeText(currentSessionId);
        copyBtn.textContent = '✅ COPIED!';
        setTimeout(() => {
            copyBtn.textContent = 'COPY';
        }, 2000);
        updateStatus('Session ID copied!');
    }
});

// Load saved session on page load
window.addEventListener('load', () => {
    const saved = localStorage.getItem('silayox_session');
    if (saved) {
        sessionDisplay.textContent = saved;
        currentSessionId = saved;
        copyBtn.disabled = false;
        updateStatus('Previous session ID available');
    }
});
