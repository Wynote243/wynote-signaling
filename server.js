const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

// ==============================
// Serveur HTTP (Health Check)
// ==============================
const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain"
    });

    res.end("Wynote Signaling Server is Running...");
});

// ==============================
// Serveur WebSocket
// ==============================
const wss = new WebSocket.Server({
    server
});

// userId -> websocket
const users = new Map();

// ==============================
// Démarrage
// ==============================
server.listen(PORT, () => {
    console.log(`🚀 Wynote Signaling Server démarré sur le port ${PORT}`);
});

// ==============================
// Heartbeat (évite les déconnexions Render)
// ==============================
function heartbeat() {
    this.isAlive = true;
}

const interval = setInterval(() => {

    wss.clients.forEach((ws) => {

        if (!ws.isAlive) {

            if (ws.userId) {
                users.delete(ws.userId);
                console.log(`❌ Connexion expirée : ${ws.userId}`);
            }

            return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();

    });

}, 30000);

// ==============================
// Connexion WebSocket
// ==============================
wss.on("connection", (ws) => {

    console.log("📱 Nouvelle connexion WebSocket");

    ws.isAlive = true;

    ws.on("pong", heartbeat);

    ws.on("message", (message) => {

        try {

            const data = JSON.parse(message.toString());

            console.log(`📩 ${data.type}`);

            switch (data.type) {

                // ==========================
                // Enregistrement utilisateur
                // ==========================
                case "store_user": {

                    const userId = String(data.user_id);

                    ws.userId = userId;

                    users.set(userId, ws);

                    console.log(`✅ Utilisateur enregistré : ${userId}`);

                    ws.send(JSON.stringify({
                        type: "registered",
                        user_id: userId
                    }));

                    break;
                }

                // ==========================
                // Signaling WebRTC
                // ==========================
                case "offer":
                case "answer":
                case "candidate":
                case "end_call": {

                    if (!ws.userId) {

                        ws.send(JSON.stringify({
                            type: "error",
                            message: "Utilisateur non enregistré"
                        }));

                        break;
                    }

                    const receiverId = String(data.to);

                    const target = users.get(receiverId);

                    if (target && target.readyState === WebSocket.OPEN) {

                        data.from = ws.userId;

                        target.send(JSON.stringify(data));

                        console.log(
                            `📨 ${data.type} : ${ws.userId} ➜ ${receiverId}`
                        );

                    } else {

                        console.log(
                            `⚠️ Destinataire ${receiverId} hors ligne`
                        );

                        if (data.type === "offer") {

                            ws.send(JSON.stringify({
                                type: "end_call",
                                from: receiverId,
                                reason: "user_offline"
                            }));

                        }

                    }

                    break;
                }

                default:

                    console.log(
                        `⚠️ Type inconnu : ${data.type}`
                    );
            }

        } catch (error) {

            console.error(
                "❌ Erreur JSON :",
                error.message
            );

        }

    });

    ws.on("close", () => {

        if (ws.userId) {

            users.delete(ws.userId);

            console.log(
                `❌ Utilisateur déconnecté : ${ws.userId}`
            );

        }

    });

    ws.on("error", (error) => {

        console.log(
            `❌ Erreur WebSocket : ${error.message}`
        );

    });

});

// ==============================
// Arrêt propre
// ==============================
wss.on("close", () => {
    clearInterval(interval);
});