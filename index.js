const express = require('express');
const http = require('http');

const PORT = 4000;

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/room', (req, res) => {
    res.sendFile(__dirname + '/public/room.html');
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

    socket.on('ready', (r) => {
        console.log('Ready');
        socket.broadcast.to(r).emit('ready');
    });

    socket.on('candidate', (c, r) => {
        console.log('Candidate');
        socket.broadcas.to(r).emit('cadidate', c);
    });

    socket.on('offer', (o, r) => {
        console.log('Offer');
        socket.broadcas.to(r).emit('offer', o);
    });

    socket.on('answer', (a, r) => {
        console.log('Answer');
        socket.broadcas.to(r).emit('answer', a);
    })
});