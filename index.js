const express = require('express');
const http = require('http');

const PORT =  process.env.PORT || 4000;

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

app.get("/room", (req, res) => {
    res.sendFile(__dirname + "/public/room.html");
});

server.listen(PORT, () => {
    console.log('listening on ' + PORT);
});

// events for socket
io.on('connection', (socket) => {
    console.log('User connected: ' + socket.id);

    // join in room
    socket.on('join', (r) => {
        const rooms = io.sockets.adapter.rooms;
        const room = rooms.get(r);

        // if room undefined, create room
        if (room === undefined) {
            // adicioando o socket a sala
            socket.join(r);
            // enviando sinal de resposta ao socket
            // sinalizando sala criada
            socket.emit('created');
            console.log('Room Created');

        // if room 1 people, joining room
        }else if (room.size===1) {
            // adicionando o socket a sala
            socket.join(r);
            // enviando sinal para o socket
            // de entrada na sala
            socket.emit('joined');
            console.log('Room Joined');

        // or room fully
        }else{
            // enviando sinal para o socket
            // se sala cheia
            socket.emit('full');
            console.log('Room full for Now');
        }

        console.log(rooms);
    });

    // recebendo o sinal de pronto
    socket.on('ready', (r) => {
        // repassando o sinal para todos conectados na sala to(sala)
        // (broadcast) sinal pra todos menos quem envia
        socket.broadcast.to(r).emit('ready');
    });

    // recendendo o candidato
    socket.on('candidate', (c, r) => {
        // repassando o sinal para todos conectados na sala to(sala)
        // (broadcast) sinal pra todos menos quem envia
        socket.broadcast.to(r).emit('candidate', c);
    });

    // recebendo a oferta
    socket.on('offer', (o, r) => {
        // repassando o sinal para todos conectados na sala to(sala)
        // (broadcast) sinal pra todos menos quem envia
        socket.broadcast.to(r).emit('offer', o);
    });

    // recebendo a resposta
    socket.on('answer', (a, r) => {
        // repassando o sinal para todos conectados na sala to(sala)
        // (broadcast) sinal pra todos menos quem envia
        socket.broadcast.to(r).emit('answer', a);
    })

    // recebendo sinal de sair da sala
    socket.on('leave', (r) => {
        // removendo o socket da sala
        socket.leave(r);
        // repassando o sinal para todos conectados na sala to(sala)
        // (broadcast) sinal pra todos menos quem envia
        socket.broadcast.to(r).emit('leave');
    });
});