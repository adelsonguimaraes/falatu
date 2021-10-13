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

const aliases = [];

// events for socket
io.on('connection', (socket) => {
    console.log('User connected: ' + socket.id);

    // join in room
    socket.on('join', (r, alias) => {
        const rooms = io.sockets.adapter.rooms;
        const room = rooms.get(r);

        aliases[socket.id] = alias;

        // if room undefined, create room
        if (room === undefined) {
            // adicioando o socket a sala
            socket.join(r);
            // enviando sinal de resposta ao socket
            // sinalizando sala criada
            socket.emit('created', socket.id);
            console.log('Room Created');

        // if room 1 people, joining room
        }else if (room.size<=4) {
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

    // recebendo o sinal de pronto
    socket.on('ready', (r, pcId) => {
        // enviando para toda a sala nosso id de conexão
        // assim os outros parares podem nos ofertar uma conexão
        socket.broadcast.to(r).emit('ready', socket.id, aliases[socket.id]);
    });

    // recendendo o candidato
    socket.on('candidate', (c, pcId) => {
        // recebendo o icecandidate de um par e repassando para a outra ponta
        socket.broadcast.to(pcId).emit('candidate', c, socket.id);
    });

    // recebendo a oferta
    socket.on('offer', (o, pcId) => {
        // repassando a oferta para a outra ponta com nosso id de conexão
        socket.broadcast.to(pcId).emit('offer', o, socket.id, aliases[socket.id]);
    });

    // recebendo a oferta
    socket.on('offer-screen-sharing', (o, pcId) => {
        // repassando a oferta para a outra ponta com nosso id de conexão
        socket.broadcast.to(pcId).emit('offer-screen-sharing', o, socket.id, aliases[socket.id]);
        console.log(pcId, socket.id);
    });

    // recebendo a resposta
    socket.on('answer', (a, pcId) => {
        // repassando a resposta para a outra ponta com nosso id de conexão
        socket.broadcast.to(pcId).emit('answer', a, socket.id);
    })

    // recebendo sinal de fim de compartilhamento de tela
    socket.on('stop-screen-sharing', (r, streamId) => {
        console.log('stop screen sharing', streamId);
        socket.broadcast.to(r).emit('stop-screen-sharing', streamId, socket.id, aliases[socket.id]);
    })

    // recebendo sinal de sair da sala
    socket.on('leave', (r) => {
        // removendo o socket da sala
        socket.leave(r);
        aliases.splice(aliases[socket.id]);
        // repassando o sinal para todos conectados na sala to(sala)
        // (broadcast) sinal pra todos menos quem envia
        socket.broadcast.to(r).emit('leave', socket.id, aliases[socket.id]);
    });
    
    // pegando o evento de desconexão
    socket.on("disconnect", () => {
        // removendo o socket de todas as salas
        socket.leave();
        aliases.splice(aliases[socket.id]);
        // enviando a saída do socket para todas as salas
        socket.broadcast.emit('leave', socket.id, aliases[socket.id]);
    });
});