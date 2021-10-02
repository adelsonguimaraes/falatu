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
            socket.join(r);
            socket.emit('created');
            console.log('Room Created');

        // if room 1 people, joining room
        }else if (room.size===1) {
            socket.join(r);
            socket.emit('joined');
            console.log('Room Joined');

        // or room fully
        }else{
            socket.emit('full');
            console.log('Room full for Now');
        }

        console.log(rooms);
    });

    // recebendo o sinal de pronto
    socket.on('ready', (r) => {
        // repassando o sinal de pronto
        socket.broadcast.to(r).emit('ready');
    });

    // recendendo o candidato
    socket.on('candidate', (c, r) => {
        // enviando o candidato para o parceiro
        socket.broadcast.to(r).emit('candidate', c);
    });

    // recebendo a oferta
    socket.on('offer', (o, r) => {
        // repassando a oferta
        socket.broadcast.to(r).emit('offer', o);
    });

    // recebendo a resposta
    socket.on('answer', (a, r) => {
        // repassando a resposta pro parceiro
        socket.broadcast.to(r).emit('answer', a);
    })

    // recebendo sinal de sair da sala
    socket.on('leave', (r) => {
        socket.leave(r);
        socket.broadcast.to(r).emit('leave');
    });
});