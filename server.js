const WebSocket = require("ws");
const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Wynote Signaling Server Ultra Pro OK");
});

const wss = new WebSocket.Server({ server });

// Map des utilisateurs connectés <userId, socket>
const users = new Map();

// Map des appels actifs <userId, targetId> pour le nettoyage automatique
const activeCalls = new Map();

function sendToUser(userId, data) {
    const client = users.get(String(userId));
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
        return true;
    }
    return false;
}

wss.on("connection", (ws) => {
    let currentUser = null;

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            const type = data.type;

            console.log(`[Signal] ${type} de ${currentUser || "Inconnu"}`);

            switch (type) {
                case "register":
                    currentUser = String(data.userId);
                    users.set(currentUser, ws);
                    console.log(`Utilisateur ${currentUser} connecté`);
                    break;

                case "incoming_call":
                    const caller = String(data.callerId);
                    const receiver = String(data.receiverId);
                    
                    activeCalls.set(caller, receiver);
                    activeCalls.set(receiver, caller);

                    // IMPORTANT: On passe le callType (audio/video) pour l'UI Android
                    sendToUser(receiver, {
                        type: "incoming_call",
                        callerId: caller,
                        callerName: data.callerName,
                        callerAvatar: data.callerAvatar,
                        callType: data.callType || "audio" 
                    });
                    break;

                case "call_accept":
                    sendToUser(String(data.targetId), {
                        type: "call_accept",
                        userId: currentUser
                    });
                    break;

                case "call_reject":
                    const targetToReject = String(data.targetId);
                    sendToUser(targetToReject, { type: "call_reject" });
                    activeCalls.delete(currentUser);
                    activeCalls.delete(targetToReject);
                    break;

                case "offer":
                case "answer":
                    sendToUser(String(data.targetId), {
                        type: type,
                        senderId: currentUser,
                        sdp: data.sdp
                    });
                    break;

                case "candidate":
                    sendToUser(String(data.targetId), {
                        type: "candidate",
                        senderId: currentUser,
                        candidate: data.candidate,
                        sdpMid: data.sdpMid,
                        sdpMLineIndex: data.sdpMLineIndex
                    });
                    break;

                case "call_end":
                    const partnerId = String(data.targetId);
                    sendToUser(partnerId, { type: "call_end" });
                    activeCalls.delete(currentUser);
                    activeCalls.delete(partnerId);
                    break;

                case "ping":
                    ws.send(JSON.stringify({ type: "pong" }));
                    break;
            }
        } catch (error) {
            console.error("Erreur Signaling:", error);
        }
    });

    ws.on("close", () => {
        if (currentUser) {
            console.log(`Déconnexion : ${currentUser}`);
            const partnerId = activeCalls.get(currentUser);
            if (partnerId) {
                // Notifie l'autre côté que l'appel est coupé à cause d'une perte réseau
                sendToUser(partnerId, { type: "call_end", reason: "peer_disconnected" });
                activeCalls.delete(partnerId);
                activeCalls.delete(currentUser);
            }
            users.delete(currentUser);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Wynote Signaling Server Ultra Pro running on port ${PORT}`);
});
