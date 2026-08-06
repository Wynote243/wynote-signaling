const WebSocket = require("ws");
const http = require("http");



const PORT = process.env.PORT || 3000;



const server = http.createServer(
    (req,res)=>{

        res.writeHead(200);
        res.end(
            "Wynote Signaling Server OK"
        );

    }
);



const wss = new WebSocket.Server({
    server
});



// utilisateurs connectés
const users = new Map();



// appels actifs
const calls = new Map();





function sendToUser(
    userId,
    data
){

    const client =
        users.get(
            String(userId)
        );


    if(
        client &&
        client.readyState === WebSocket.OPEN
    ){

        client.send(
            JSON.stringify(data)
        );


        return true;

    }


    return false;

}







wss.on(
"connection",
(ws)=>{


    let currentUser=null;



    console.log(
        "Nouvelle connexion"
    );



    ws.on(
    "message",
    message=>{


        try{


            const data =
                JSON.parse(message);



            const type =
                data.type;



            console.log(
                "Message:",
                data
            );




            /*
             * Enregistrement utilisateur
             */

            if(type==="register"){


                currentUser =
                    String(
                        data.userId
                    );


                users.set(
                    currentUser,
                    ws
                );


                console.log(
                    "Utilisateur connecté:",
                    currentUser
                );


                return;

            }






            /*
             * Appel entrant
             */

            if(type==="incoming_call"){



                const receiver =
                    data.receiverId;



                calls.set(
                    receiver,
                    data.callerId
                );



                sendToUser(
                    receiver,
                    {

                        type:
                        "incoming_call",


                        callerId:
                        data.callerId

                    }

                );


                return;

            }






            /*
             * Acceptation
             */

            if(type==="call_accept"){



                sendToUser(
                    data.targetId,
                    {

                        type:
                        "call_accept",


                        userId:
                        currentUser

                    }

                );


                return;

            }






            /*
             * Refus
             */

            if(type==="call_reject"){



                sendToUser(
                    data.targetId,
                    {

                        type:
                        "call_reject"

                    }

                );


                calls.delete(
                    currentUser
                );


                return;

            }








            /*
             * SDP OFFER
             */

            if(type==="offer"){



                sendToUser(
                    data.targetId,
                    {

                        type:
                        "offer",


                        senderId:
                        currentUser,


                        sdp:
                        data.sdp

                    }

                );


                return;

            }







            /*
             * SDP ANSWER
             */

            if(type==="answer"){



                sendToUser(
                    data.targetId,
                    {

                        type:
                        "answer",


                        senderId:
                        currentUser,


                        sdp:
                        data.sdp

                    }

                );


                return;

            }








            /*
             * ICE Candidate
             */

            if(type==="candidate"){



                sendToUser(
                    data.targetId,
                    {

                        type:
                        "candidate",


                        candidate:
                        data.candidate,


                        sdpMid:
                        data.sdpMid,


                        sdpMLineIndex:
                        data.sdpMLineIndex

                    }

                );


                return;

            }







            /*
             * Fin appel
             */

            if(type==="call_end"){



                sendToUser(
                    data.targetId,
                    {

                        type:
                        "call_end"

                    }

                );


                calls.delete(
                    currentUser
                );


                return;

            }







            /*
             * Ping
             */

            if(type==="ping"){

                ws.send(
                    JSON.stringify({
                        type:"pong"
                    })
                );

            }



        }
        catch(error){


            console.log(
                "Erreur message",
                error
            );

        }


    });









    ws.on(
    "close",
    ()=>{


        if(currentUser){


            users.delete(
                currentUser
            );


            console.log(
                "Déconnexion:",
                currentUser
            );

        }


    });



});







server.listen(
PORT,
()=>{


console.log(
`Wynote Signaling running ${PORT}`
);


});
