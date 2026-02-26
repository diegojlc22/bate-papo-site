const WebSocket = require('ws');

// Cria o servidor do WebSocket na porta definida pelo ambiente (Render/Heroku/etc) ou 6001 localmente
const PORT = process.env.PORT || 6001;
const wss = new WebSocket.Server({ port: PORT });

// Objeto para manter controle de quem está em cada canal (Live TV)
const channels = {};

wss.on('connection', function connection(ws) {
    // Inicialmente o usuário não está em nenhum canal
    ws.currentChannel = null;

    console.log('Novo usuário conectado.');

    ws.on('message', function incoming(message) {
        try {
            const data = JSON.parse(message);

            // Quando o usuário entra em uma página de Live TV
            if (data.type === 'join-live-tv') {
                const channelId = data.liveTvId;

                // Remove do canal antigo, se tiver
                leaveChannel(ws);

                // Adiciona ao novo canal
                if (!channels[channelId]) {
                    channels[channelId] = new Set();
                }
                channels[channelId].add(ws);
                ws.currentChannel = channelId;

                console.log(`Usuário entrou no canal Live TV: ${channelId}`);
            }

            // Quando alguém envia uma mensagem
            else if (data.type === 'new-comment') {
                const channelId = data.liveTvId;
                console.log(`Nova mensagem no canal ${channelId}:`, data.comment);

                // Envia a mensagem (faz o broadcast) para todos os outros usuários na mesma Live TV
                if (channels[channelId]) {
                    channels[channelId].forEach(function (client) {
                        // Verifica se o client ainda está conectado e não é o próprio remetente (opcional, aqui envia pra todos inclusive ele pra confirmar)
                        if (client.readyState === WebSocket.OPEN && client !== ws) {
                            client.send(JSON.stringify({
                                type: 'comment-received',
                                user: data.user,
                                comment: data.comment
                            }));
                        }
                    });
                }
            }
        } catch (e) {
            console.error('Erro ao processar mensagem JSON:', e);
        }
    });

    // Quando o usuário desconecta ou sai da página
    ws.on('close', function () {
        leaveChannel(ws);
        console.log('Usuário desconectado.');
    });
});

function leaveChannel(ws) {
    if (ws.currentChannel && channels[ws.currentChannel]) {
        channels[ws.currentChannel].delete(ws);
        // Remove o canal da memória se ficar vazio
        if (channels[ws.currentChannel].size === 0) {
            delete channels[ws.currentChannel];
        }
    }
}

console.log('Servidor WebSocket de Chat rodando na porta 6001 (ws://127.0.0.1:6001)');
