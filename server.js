const WebSocket = require('ws');

// Configuração da porta
const PORT = process.env.PORT || 6001;
const wss = new WebSocket.Server({ port: PORT });

// Canais e Salas
const channels = {}; // Para Live TV
const rooms = {};    // Para Watch Party

wss.on('connection', function connection(ws) {
    ws.currentChannel = null;
    ws.currentRoom = null;

    console.log('Novo usuário conectado.');

    ws.on('message', function incoming(message) {
        try {
            const data = JSON.parse(message);

            // --- LÓGICA LIVE TV (CHAT PÚBLICO) ---
            if (data.type === 'join-live-tv') {
                leaveAll(ws);
                const channelId = data.liveTvId;
                if (!channels[channelId]) channels[channelId] = new Set();
                channels[channelId].add(ws);
                ws.currentChannel = channelId;
                console.log(`Usuário entrou na Live TV: ${channelId}`);
            }

            else if (data.type === 'new-comment') {
                const channelId = data.liveTvId;
                broadcast(channels[channelId], {
                    type: 'comment-received',
                    user: data.user,
                    comment: data.comment
                }, ws);
            }

            // --- LÓGICA WATCH PARTY (SALA PRIVADA) ---
            else if (data.type === 'join-watch-party') {
                leaveAll(ws);
                const roomId = data.roomId;
                if (!rooms[roomId]) rooms[roomId] = new Set();
                rooms[roomId].add(ws);
                ws.currentRoom = roomId;
                console.log(`Usuário entrou na Watch Party: ${roomId}`);
            }

            else if (data.type === 'watch-party-action') {
                const roomId = data.roomId;
                // Broadcast de eventos como play, pause, seek ou chat privado
                broadcast(rooms[roomId], {
                    type: 'watch-party-received',
                    event: data.event, // Ex: 'player-setting', 'conversation-message'
                    payload: data.payload
                }, ws);
            }

        } catch (e) {
            console.error('Erro ao processar JSON:', e);
        }
    });

    ws.on('close', function () {
        leaveAll(ws);
        console.log('Usuário desconectado.');
    });
});

function broadcast(channelSet, data, sender) {
    if (channelSet) {
        channelSet.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client !== sender) {
                client.send(JSON.stringify(data));
            }
        });
    }
}

function leaveAll(ws) {
    // Sair de canais Live TV
    if (ws.currentChannel && channels[ws.currentChannel]) {
        channels[ws.currentChannel].delete(ws);
        if (channels[ws.currentChannel].size === 0) delete channels[ws.currentChannel];
        ws.currentChannel = null;
    }
    // Sair de salas Watch Party
    if (ws.currentRoom && rooms[ws.currentRoom]) {
        rooms[ws.currentRoom].delete(ws);
        if (rooms[ws.currentRoom].size === 0) delete rooms[ws.currentRoom];
        ws.currentRoom = null;
    }
}

console.log(`Servidor rodando na porta ${PORT}`);

