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
const messages = [];

// events for socket
io.on('connection', (socket) => {
    console.log('User connected: ' + socket.id);

    // checa se a sala existe assim que o usuário
    // entra na room antes de chamar a tela de preparo
    socket.on('check-room', r => {
        const rooms = io.sockets.adapter.rooms;
        const room = rooms.get(r);
        socket.emit('check-room', room);
    });

    // join in room
    socket.on('join', (r, alias, create) => {
        const rooms = io.sockets.adapter.rooms;
        const room = rooms.get(r);

        aliases[socket.id] = alias;

        // if room undefined, create room
        if (room === undefined) {
            // adicioando o socket a sala
            socket.join(r);
            // enviando sinal de resposta ao socket
            // sinalizando sala criada
            socket.emit('created', socket.id, alias);
            console.log('Room Created');

        // if room 1 people, joining room
        }else if (room.size<=4) {
            // adicionando o socket a sala
            socket.join(r);
            // enviando sinal para o socket
            // de entrada na sala
            socket.emit('joined', socket.id, alias, messages[r]);
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
    socket.on('offer', (o, pcId, statusMic, statusCam) => {
        // repassando a oferta para a outra ponta com nosso id de conexão
        socket.broadcast.to(pcId).emit('offer', o, socket.id, aliases[socket.id], statusMic, statusCam);
    });

    // recebendo a oferta
    socket.on('offer-screen-sharing', (o, pcId) => {
        // repassando a oferta para a outra ponta com nosso id de conexão
        socket.broadcast.to(pcId).emit('offer-screen-sharing', o, socket.id, aliases[socket.id]);
        console.log(pcId, socket.id);
    });

    // recebendo a resposta
    socket.on('answer', (a, pcId, statusMic, statusCam) => {
        // repassando a resposta para a outra ponta com nosso id de conexão
        socket.broadcast.to(pcId).emit('answer', a, socket.id, statusMic, statusCam);
    })

    // recebendo sinal de fim de compartilhamento de tela
    socket.on('stop-screen-sharing', (r, streamId) => {
        console.log('stop screen sharing', streamId);
        socket.broadcast.to(r).emit('stop-screen-sharing', streamId, socket.id, aliases[socket.id]);
    })

    // recebendo sinal de sair da sala
    socket.on('leave', (r) => {
        // emit o leave pra sala
        socket.broadcast.to(r).emit('leave', socket.id, aliases[socket.id]);
        // remove do alias da lista
        delete aliases[socket.id];
        // removendo o socket da sala
        socket.leave(r);
    });

    socket.on('mic-cam-toggle', (r, statusMic, statusCam) => {
        socket.broadcast.to(r).emit('mic-cam-toggle', socket.id, statusMic, statusCam);
    });

    socket.on('message', (r, message) => {
        const date = new Date;
        const h = ('0'+date.getHours()).slice(-2);
        const m = ('0'+date.getMinutes()).slice(-2);
        const msg = {'alias': aliases[socket.id], 'horario': `${h}:${m}`, 'message': message};
        
        if (!messages[r]) messages[r] = [];
        messages[r].push(msg);
        
        socket.emit('message', messages[r]);
        socket.broadcast.to(r).emit('message', messages[r]);
    });
    
    // pegando o evento de desconexão
    socket.on("disconnect", () => {
        // removendo o socket de todas as salas
        socket.leave();

        // se o alias já tiver sido cadastrado
        if (aliases[socket.id]!==undefined) {
            // enviando a saída do socket para todas as salas
            socket.broadcast.emit('leave', socket.id, aliases[socket.id]);
            // remove do alias da lista
            delete aliases[socket.id];
        }
    });
});