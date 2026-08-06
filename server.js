const WebSocket = require("ws");
const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Wynote Signaling Server OK");
});

const wss = new WebSocket.Server({ server });

// utilisateurs connectés
const users = new Map();

// appels actifs
const calls = new Map();

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

    console.log("Nouvelle connexion");

    ws.on("message", (message) => {

        try {

            const data = JSON.parse(message);

            const type = data.type;

            console.log("Message :", data);

            // =====================================================
            // REGISTER
            // =====================================================

            if (type === "register") {

                currentUser = String(data.userId);

                users.set(currentUser, ws);

                console.log(`Utilisateur ${currentUser} connecté`);

                return;
            }

            // =====================================================
            // APPEL ENTRANT
            // =====================================================

            if (type === "incoming_call") {

                const caller = String(data.callerId);
                const receiver = String(data.receiverId);

                calls.set(caller, receiver);
                calls.set(receiver, caller);

                const delivered = sendToUser(receiver, {

                    type: "incoming_call",

                    callerId: caller,

                    callerName: data.callerName,

                    callerAvatar: data.callerAvatar

                });

                console.log(
                    `[CALL] ${caller} -> ${receiver} : ${delivered ? "DELIVERED" : "OFFLINE"}`
                );

                if (!delivered) {

                    sendToUser(caller, {

                        type: "call_reject",

                        reason: "offline"

                    });

                }

                return;
            }

            // =====================================================
            // ACCEPTATION
            // =====================================================

            if (type === "call_accept") {

                sendToUser(String(data.targetId), {

                    type: "call_accept",

                    userId: currentUser

                });

                return;
            }

            // =====================================================
            // REFUS
            // =====================================================

            if (type === "call_reject") {

                sendToUser(String(data.targetId), {

                    type: "call_reject"

                });

                const other = calls.get(currentUser);

                calls.delete(currentUser);

                if (other) {

                    calls.delete(other);

                }

                return;
            }

            // =====================================================
            // OFFER
            // =====================================================

            if (type === "offer") {

                sendToUser(String(data.targetId), {

                    type: "offer",

                    senderId: currentUser,

                    sdp: data.sdp

                });

                return;
            }

            // =====================================================
            // ANSWER
            // =====================================================

            if (type === "answer") {

                sendToUser(String(data.targetId), {

                    type: "answer",

                    senderId: currentUser,

                    sdp: data.sdp

                });

                return;
            }

            // =====================================================
            // ICE
            // =====================================================

            if (type === "candidate") {

                sendToUser(String(data.targetId), {

                    type: "candidate",

                    senderId: currentUser,

                    candidate: data.candidate,

                    sdpMid: data.sdpMid,

                    sdpMLineIndex: data.sdpMLineIndex

                });

                return;
            }

            // =====================================================
            // FIN APPEL
            // =====================================================

            if (type === "call_end") {

                sendToUser(String(data.targetId), {

                    type: "call_end"

                });

                const other = calls.get(currentUser);

                calls.delete(currentUser);

                if (other) {

                    calls.delete(other);

                }

                return;
            }

            // =====================================================
            // PING
            // =====================================================

            if (type === "ping") {

                ws.send(JSON.stringify({

                    type: "pong"

                }));

                return;
            }

        } catch (error) {

            console.error("Erreur message :", error);

        }

    });

    // =====================================================
    // DECONNEXION
    // =====================================================

    ws.on("close", () => {

        if (!currentUser)
            return;

        const other = calls.get(currentUser);

        if (other) {

            sendToUser(other, {

                type: "call_end"

            });

            calls.delete(other);
            calls.delete(currentUser);
        }

        users.delete(currentUser);

        console.log(`Déconnexion : ${currentUser}`);

    });

});

server.listen(PORT, () => {

    console.log(`Wynote Signaling Server running on port ${PORT}`);

});
