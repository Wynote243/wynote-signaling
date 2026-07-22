const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;


// Serveur HTTP pour Render
const server = http.createServer((req, res) => {

    res.writeHead(200, {
        "Content-Type": "text/plain"
    });

    res.end("Wynote Signaling Server OK");

});


// Serveur WebSocket attaché au serveur HTTP
const wss = new WebSocket.Server({
    server
});


// userId => websocket
const users = new Map();



server.listen(PORT, () => {

    console.log(
        `🚀 Wynote Signaling Server démarré sur le port ${PORT}`
    );

});



wss.on("connection", (ws) => {

    console.log("📱 Nouvelle connexion WebSocket");


    ws.on("message", (message) => {

        try {

            const data = JSON.parse(message);


            switch(data.type) {


                // Enregistrement utilisateur
                case "store_user":


                    const userId = String(data.user_id);


                    users.set(userId, ws);


                    ws.userId = userId;



                    console.log(
                        `✅ Utilisateur connecté : ${userId}`
                    );



                    ws.send(JSON.stringify({

                        type: "registered",

                        user_id: userId

                    }));


                    break;



                // Messages WebRTC
                case "offer":
                case "answer":
                case "candidate":


                    const receiver = String(data.to);


                    const target = users.get(receiver);



                    if (
                        target &&
                        target.readyState === WebSocket.OPEN
                    ) {


                        data.from = ws.userId;



                        target.send(
                            JSON.stringify(data)
                        );



                        console.log(
                            `📨 ${data.type} envoyé de ${ws.userId} vers ${receiver}`
                        );


                    } else {


                        console.log(
                            `⚠️ Utilisateur ${receiver} non connecté`
                        );


                    }


                    break;



                default:


                    console.log(
                        "⚠️ Type inconnu :",
                        data.type
                    );

            }



        } catch(error) {


            console.error(
                "❌ Erreur traitement message :",
                error.message
            );


        }


    });



    ws.on("close", () => {


        if(ws.userId) {


            users.delete(ws.userId);



            console.log(
                `❌ Utilisateur déconnecté : ${ws.userId}`
            );


        }


    });



    ws.on("error", (error) => {


        console.log(
            "❌ Erreur WebSocket :",
            error.message
        );


    });


});