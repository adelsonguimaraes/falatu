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

        const pcId = (room===undefined) ? 0 : room.size;

        console.log('size', pcId);

        // if room undefined, create room
        if (room === undefined) {
            // adicioando o socket a sala
            socket.join(r);
            // enviando sinal de resposta ao socket
            // sinalizando sala criada
            socket.emit('created', socket.id);
            console.log('Room Created');

        // if room 1 people, joining room
        }else if (room.size<=2) {
            // adicionando o socket a sala
            socket.join(r);
            // enviando sinal para o socket
            // de entrada na sala
            socket.emit('joined', socket.id);
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

    socket.on('welcome', (data) => {
        socket.broadcast.to(data.pcId).emit('welcome', {
            pcId: socket.id
        });
    });

    socket.on('process', (data) => {
        socket.broadcast.to(data.pcId).emit('process', {
            message: data.message,
            pcId: socket.id
        });
    })

    // recebendo o sinal de pronto
    socket.on('ready', (r, pcId) => {
        // repassando o sinal para todos conectados na sala to(sala)
        // (broadcast) sinal pra todos menos quem envia
        socket.broadcast.to(r).emit('ready', pcId);
    });

    // recendendo o candidato
    socket.on('candidate', (c, r, pcId) => {
        // repassando o sinal para todos conectados na sala to(sala)
        // (broadcast) sinal pra todos menos quem envia
        socket.broadcast.to(r).emit('candidate', c, pcId);
    });

    // recebendo a oferta
    socket.on('offer', (o, r, pcId) => {
        // repassando o sinal para todos conectados na sala to(sala)
        // (broadcast) sinal pra todos menos quem envia
        socket.broadcast.to(r).emit('offer', o, pcId);
    });

    // recebendo a resposta
    socket.on('answer', (a, r, pcId) => {
        // repassando o sinal para todos conectados na sala to(sala)
        // (broadcast) sinal pra todos menos quem envia
        socket.broadcast.to(r).emit('answer', a, pcId);
    })

    // recebendo sinal de fim de compartilhamento de tela
    socket.on('stop-screen-sharing', (r, s) => {
        console.log('stop screen sharing', s);
        socket.broadcast.to(r).emit('stop-screen-sharing', s);
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