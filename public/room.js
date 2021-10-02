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
    const notification = document.querySelector('.notification');

    // ice servers
    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.services.mozilla.com' },
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    };

    let notificationTime = null;
    showNotification = (msg) => {
        if (notificationTime!=null) {
            clearTimeout(notificationTime);
        }

        notification.innerHTML = msg;
        notification.classList.add('notification-active');
        notificationTime = setTimeout(()=>{
            notification.classList.remove('notification-active');
        }, [4000]);
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

    let slug = '';

    // check the room session
    let r = sessionStorage.getItem('room');
    
    if (typeof(r) !== 'string') {
        // check the room parameter
        r = window.location.hash.replace('#', '');
        if (r==='') {
            alert('A sala não é válida!');
            return window.location.replace('/');
        }

        sessionStorage.setItem('room', r);
        slug = r;
    }else{
        // conectando ao servidor
        slug = r.trim().toLowerCase().replace(' ', '_');
    }


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
            alert('Não foi possível acessar a Câmera!');
            stopMyStream();

            console.error(err);
        });
    };

    playAudio = (a) => {
        const audio = new Audio();
        audio.volume = .5;
        audio.src = './assets/audio/'+a+'.mp3';
        audio.play();
    };
    
    // events socket from server response
    socket.on('created', () => {
        state.creator = true;
        getMyUserMedia();
        // effect audio
        playAudio('join');
    });
    socket.on('joined', () => {
        state.creator = false;
        getMyUserMedia();
        playAudio('join');
    });
    socket.on('full', () => {
        alert("Opa! A sala atingiu o total suportado!");
        return window.location.replace('/');
    });
    socket.on('ready', () => {
        
        playAudio('outher_join');
        
        // alert('Um parceiro chegou!');
        showNotification('Um parceiro chegou!');

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

        playAudio('outher_disconnect');

        // alert('O parceiro se desconectou, você é novo dono da sala!');
        showNotification('O parceiro se desconectou, você é novo dono da sala!');
        state.creator = true;
        // stopMyStream(); // forçando a saída da sala
        stopOutherStream();
    });
});