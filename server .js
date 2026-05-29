const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const activeSessions = new Map();

function generateSessionId() {
    return `SILAYOX_V6_${Date.now()}_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}

async function createQRSession(socket, sessionId) {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionId}`);
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['SILAYOX V6', 'Chrome', '6.0.0']
        });

        activeSessions.set(sessionId, { sock, status: 'connecting' });

        sock.ev.on('connection.update', async (update) => {
            const { qr, connection, lastDisconnect } = update;
            
            if (qr) {
                const qrBuffer = await QRCode.toBuffer(qr);
                const qrBase64 = `data:image/png;base64,${qrBuffer.toString('base64')}`;
                socket.emit('qr-code', { sessionId, qr: qrBase64 });
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason === DisconnectReason.loggedOut) {
                    socket.emit('error', { message: 'Session logged out' });
                }
            }
            
            if (connection === 'open') {
                activeSessions.set(sessionId, { sock, status: 'ready' });
                socket.emit('session-ready', { 
                    sessionId: sessionId,
                    message: 'SILAYOX V6 is ready!'
                });
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error('Error:', error);
        socket.emit('error', { message: error.message });
    }
}

async function createPairingSession(socket, sessionId, phoneNumber) {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionId}`);
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['SILAYOX V6', 'Chrome', '6.0.0']
        });

        activeSessions.set(sessionId, { sock, status: 'pairing' });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason === DisconnectReason.loggedOut) {
                    socket.emit('error', { message: 'Session logged out' });
                }
            }
            
            if (connection === 'open') {
                activeSessions.set(sessionId, { sock, status: 'ready' });
                socket.emit('session-ready', { 
                    sessionId: sessionId,
                    message: 'SILAYOX V6 is ready!'
                });
            }
        });

        if (sock.requestPairingCode) {
            const cleanNumber = phoneNumber.replace(/\D/g, '');
            const code = await sock.requestPairingCode(cleanNumber);
            socket.emit('pairing-code', { 
                sessionId, 
                code: code,
                instructions: `Enter this code in WhatsApp: Settings → Linked Devices → Link with phone number`
            });
        }

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        socket.emit('error', { message: 'Pairing failed: ' + error.message });
    }
}

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('request-qr', async (data) => {
        const sessionId = data.sessionId || generateSessionId();
        await createQRSession(socket, sessionId);
    });

    socket.on('request-pairing', async (data) => {
        const { phoneNumber } = data;
        const sessionId = data.sessionId || generateSessionId();
        
        if (!phoneNumber) {
            socket.emit('error', { message: 'Phone number required' });
            return;
        }
        
        await createPairingSession(socket, sessionId, phoneNumber);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

app.get('/api/status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    res.json({ 
        exists: !!session, 
        status: session ? session.status : 'not found' 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🟢 SILAYOX V6 Session Server running on http://localhost:${PORT}`);
});
