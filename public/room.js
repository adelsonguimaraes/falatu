document.addEventListener('DOMContentLoaded', () => {

    // state
    const state = {
        peerConnection: null,
        stream: null,
        creator: true,
        mycam: true,
        mymic: true
    };

    // room
    const socket = io('/');
    const btnCam = document.querySelector('.btn-cam');
    const btnMic = document.querySelector('.btn-mic');
    const btnExit = document.querySelector('.btn-exit');
    const mycam = document.querySelector('.my-cam video');
    const outhercam = document.querySelector('.outher video');

    // ice servers
    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.services.mozilla.com' },
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    };

    // cam
    btnCam.addEventListener('click', () => {
        state.mycam = !state.mycam;
        state.stream.getTracks()[1].enabled = !state.stream.getTracks()[1].enabled;
        if (state.mycam) {
            btnCam.classList.remove('btn-cam-active');
        }else{
            btnCam.classList.add('btn-cam-active');
        }
    });

    // mic
    btnMic.addEventListener('click', () => {
        state.mymic = !state.mymic;
        state.stream.getTracks()[0].enabled = !state.stream.getTracks()[0].enabled;
        (state.mymic) ? btnMic.classList.remove('btn-mic-active') : btnMic.classList.add('btn-mic-active');
    });

    // check the room parameter
    const r = sessionStorage.getItem('room');
    if (typeof(r) !== 'string') {
        alert('A sala não é válida!');
        return window.location.replace('/');
    }

    // conectando ao servidor
    const slug = r.trim().replace(' ', '_').toLowerCase();

    // reforce hash
    window.location.hash = '#' + slug;

    
    socket.emit('join', slug);

    // get user media function
    getMyUserMedia = () => {
        // media user
        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        }).then((stream) => {
            // adicionando a minha stream dentro da state
            state.stream = stream;

            mycam.srcObject = stream;
            mycam.onloadedmetadata = (e) => {
                mycam.play();
            }

            // quando a segunda pessoa entra
            socket.emit('ready', slug);

        }).catch((err) => {
            console.error(err);
        });
    };
    
    // events socket from server response
    socket.on('created', () => {
        state.creator = true;
        getMyUserMedia();
    });
    socket.on('joined', () => {
        state.creator = false;
        getMyUserMedia();
    });
    socket.on('full', () => {
        alert("Room is Full, Can't Join");
        return window.location.replace('/');
    });
    socket.on('ready', () => {
        if (state.creator) {
            state.peerConnection = new RTCPeerConnection(iceServers);
            state.peerConnection.onicecandidate = OnIceCandidateFunction;
            // escutando recebimento de mídia da outra ponta
            state.peerConnection.ontrack = OnTrackFunction;
            
            state.peerConnection.addTrack(state.stream.getTracks()[0], state.stream);
            state.peerConnection.addTrack(state.stream.getTracks()[1], state.stream);

            // enviando nossas midias para a outra ponta
            // for (const track of state.stream.getTracks()) {
            //     state.peerConnection.addTrack(track, state.stream);
            // }
            
            // criando oferta
            state.peerConnection.createOffer()
            .then((offer) => {
                state.peerConnection.setLocalDescription(offer);
                socket.emit('offer', offer, r);
            })
            .catch((err) => {
                console.error(err);
            });
        }
    });
    socket.on('candidate', (cadidate) => {
        console.log('RECEBENDO CANDIDATO');
        const iceCandidate = new RTCIceCandidate(cadidate);
        state.peerConnection.addIceCandidate(iceCandidate);
    });
    socket.on('offer', (offer) => {
        if (!state.creator) {
            state.peerConnection = new RTCPeerConnection(iceServers);
            state.peerConnection.onicecandidate = OnIceCandidateFunction;
            // escutando recebimento de mídia da outra ponta
            state.peerConnection.ontrack = OnTrackFunction;

            state.peerConnection.addTrack(state.stream.getTracks()[0], state.stream);
            state.peerConnection.addTrack(state.stream.getTracks()[1], state.stream);
            
            // enviando nossas midias para a outra ponta
            // for (const track of state.stream.getTracks()) {
            //     state.peerConnection.addTrack(track, state.stream);
            // }

            state.peerConnection.setRemoteDescription(offer);
            
            // criando resposta
            state.peerConnection.createAnswer()
            .then((answer) => {
                state.peerConnection.setLocalDescription(answer);
                socket.emit('answer', answer, r);
            })
            .catch((err) => {
                console.error(err);
            });
        }
    });
    socket.on('answer', (answer) => {
        state.peerConnection.setRemoteDescription(answer);
    });

    OnIceCandidateFunction = (event) => {
        // check candidate in event   
        if (event.candidate) {
            socket.emit('candidate', event.candidate, r);
        }
    };

    // acionanda quando há fluxo de mídia no canal da outra ponta
    OnTrackFunction = (event) => {
        // const remote = new MediaStream();
        // outhercam.srcObject = remote;
        outhercam.srcObject = event.streams[0];
        // remote.addTrack(event.track)
        outhercam.onloadedmetadata = (e) => {
            outhercam.play();
        }
    };

    stopMyStream = () => {
        if (mycam.srcObject) {
            mycam.srcObject.getTracks()[0].stop();
            mycam.srcObject.getTracks()[1].stop();
        }

        sessionStorage.removeItem('room');
        window.location.replace('/');
    };

    stopOutherStream = () => {
        if (outhercam.srcObject) {
            outhercam.srcObject.getTracks()[0].stop();
            outhercam.srcObject.getTracks()[1].stop();
            outhercam.srcObject = null;
        };

        if (state.peerConnection) {
            state.peerConnection.ontrack = null;
            state.peerConnection.onicecandidate = null;
            state.peerConnection.close();
            state.peerConnection = null;
        };
    };

    // exit
    btnExit.addEventListener('click', () => {
        socket.emit('leave', slug);
        stopMyStream();
        stopOutherStream();
    });

    socket.on('leave', () => {
        alert('O parceiro se desconectou, você é novo dono da sala!');
        state.creator = true;
        // stopMyStream(); // forçando a saída da sala
        stopOutherStream();
    });
});