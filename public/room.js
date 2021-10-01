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
            { urls: 'stun1.l.google.com:19302' }
        ]
    };

    // cam
    btnCam.addEventListener('click', () => {
        state.mycam = !state.mycam;
        (state.mycam) ? btnCam.classList.remove('btn-cam-active') : btnCam.classList.add('btn-cam-active');
    });

    // mic
    btnMic.addEventListener('click', () => {
        state.mymic = !state.mymic;
        (state.mymic) ? btnMic.classList.remove('btn-mic-active') : btnMic.classList.add('btn-mic-active');
    });

    // exit
    btnExit.addEventListener('click', () => {
        console.log('caindo fora');
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
            audio: false,
            video: true
        }).then((stream) => {
            // adicionando a minha stream dentro da state
            state.stream = stream;

            mycam.srcObject = stream;
            mycam.onloadedmetadata = (e) => {
                mycam.play();
            }

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
        state.peerConnection = new RTCPeerConnection(iceServers);
        state.peerConnection.onicecandidate = OnIceCandidateFunction;
        // escutando recebimento de mídia da outra ponta
        state.peerConnection.ontrack = OnTrackFunction;
        // enviando nossas midias para a outra ponta
        state.peerConnection.addTrack(state.stream.getTracks()[0], state.stream); // trilha de audio
        state.peerConnection.addTrack(state.stream.getTracks()[1], state.stream); // trilha de video

        // criando oferta
        state.peerConnection.createOffer(()=>{

        }).then({}).catch({
           
        });
    });
    socket.on('candidate', () => {});
    socket.on('offer', () => {});
    socket.on('answer', () => {});

    OnIceCandidateFunction = (event) => {
        // check candidate in event   
        if (event.candidate) {
            socket.emit('candidate', event.candidate, r);
        }
    };

    // acionanda quando há fluxo de mídia no canal da outra ponta
    OnTrackFunction = (event) => {
        outhercam.srcObject = event.streams[0];
        outhercam.onloadedmetadata = (e) => {
            outhercam.play();
        }
    };
});