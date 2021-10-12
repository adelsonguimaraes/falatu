document.addEventListener('DOMContentLoaded', () => {

    // state
    const state = {
        // peerConnection: null,
        id: null,
        peerConnections: [],
        peerConnectionsIds: [],
        videoPeers: [],
        stream: null,
        screenSharing: null,
        screenSharingSender: [],
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
    const outhers = document.querySelector('div .outhers');
    // const outhercam = document.querySelector('.outher video');
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


    // add new video element
    addNewVideoElement = (stream, pcId) => {

        // pegando os elementos de video em outhers
        const videos = document.querySelectorAll('.outhers video');
        
        // filtrando stream em videos
        const video = Array.from(videos).find(v => v.id.toString() === stream.id.toString());
        // caso o id da stream seja diferente dos id
        if (video === undefined) {
            const el = document.createElement('div');
            el.classList.add('outher');
            el.classList.add('multicam');
            const v = document.createElement('video');
            v.id = stream.id;
            v.srcObject = stream;
            el.appendChild(v);
            outhers.appendChild(el);

            v.onloadedmetadata = (e) => {
                v.play();
            }
            v.onclick = (e) => {
                v.requestFullscreen();
            }

            if (state.videoPeers[pcId]===undefined) state.videoPeers[pcId] = [];
            state.videoPeers[pcId].push(el);
        }
    }

    // get user media function
    getMyUserMedia = async () => {
        // media user
        await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        }).then((stream) => {
            // adicionando a minha stream dentro da state
            state.stream = stream;

            mycam.srcObject = stream;
            mycam.onloadedmetadata = (e) => {
                mycam.play();
            }

            // setMyPeerConnection();

            // // quando a segunda pessoa entra
            socket.emit('ready', slug, state.id);

        }).catch((err) => {
            // alert('Não foi possível acessar a Câmera!');
            // stopMyStream();

            console.error(err);
        });
    };

    // set peerconnection
    setPeerConnection = (pcId) => {
        console.log('Set my peer connection');

        const conn = new RTCPeerConnection(iceServers);
        
        conn.onicecandidate = (event) => {
            // check candidate in event   
            if (event.candidate) {
                socket.emit('candidate', event.candidate, pcId);
            }
        };
        
        // escutando recebimento de mídia da outra ponta
        conn.ontrack = (event) => {
            addNewVideoElement(event.streams[0], pcId);
        };

        conn.addTrack(state.stream.getTracks()[0], state.stream);
        conn.addTrack(state.stream.getTracks()[1], state.stream);

        state.peerConnectionsIds.push(pcId);
        state.peerConnections[pcId] = conn;
    }

    playAudio = (a) => {
        const audio = new Audio();
        audio.volume = .5;
        audio.src = './assets/audio/'+a+'.mp3';
        audio.play();
    };
    
    // events socket from server response
    socket.on('created', (idSocket) => {
        state.creator = true;
        state.id = idSocket;

        getMyUserMedia();
        // effect audio
        playAudio('join');
    });
    socket.on('joined', (idSocket) => {
        state.creator = false;
        state.id = idSocket;
        
        getMyUserMedia();
        playAudio('join');
    });
    socket.on('full', () => {
        alert("Opa! A sala atingiu o total suportado!");
        return window.location.replace('/');
    });
    socket.on('ready', (pcId) => {
        playAudio('outher_join');
        
        // alert('Um parceiro chegou!');
        showNotification('Um parceiro chegou!');

        setPeerConnection(pcId);

        // if (state.creator) {
            // criando oferta
            state.peerConnections[pcId].createOffer()
            .then((offer) => {
                state.peerConnections[pcId].setLocalDescription(offer);
                socket.emit('offer', offer, pcId);
            })
            .catch((err) => {
                console.error(err);
            });
        // }
    });
    socket.on('candidate', async (cadidate, pcId) => {
        console.log('RECEBENDO CANDIDATO');
        const iceCandidate = new RTCIceCandidate(cadidate);
        state.peerConnections[pcId].addIceCandidate(iceCandidate);
    });
    socket.on('offer', (offer, pcId) => {
        // if (!state.creator) {

        if (state.peerConnections[pcId]===undefined) {
            setPeerConnection(pcId);
        }
        
        state.peerConnections[pcId].setRemoteDescription(offer);
        
        // criando resposta
        state.peerConnections[pcId].createAnswer()
        .then((answer) => {
            state.peerConnections[pcId].setLocalDescription(answer);
            socket.emit('answer', answer, pcId);
        })
        .catch((err) => {
            console.error(err);
        });
        // }
    });
    socket.on('offer-screen-sharing', async (offer, pcId) => {
        state.peerConnections[pcId].setRemoteDescription(offer);
        const answer = await state.peerConnections[pcId].createAnswer();
        state.peerConnections[pcId].setLocalDescription(answer);
        socket.emit('answer', answer, pcId);
    });
    socket.on('answer', (answer, pcId) => {
        state.peerConnections[pcId].setRemoteDescription(answer);
    });

    // recebendo eventos de adição de stream depois de uma oferta
    // OnTrackFunction = (event) => {
    //     addNewVideoElement(event.streams[0]);
    // };

    stopMyStream = () => {
        if (mycam.srcObject) {
            mycam.srcObject.getTracks()[0].stop();
            mycam.srcObject.getTracks()[1].stop();
        }

        sessionStorage.removeItem('room');
        window.location.replace('/');
    };

    stopOutherStream = (pcId) => {
        // // pegando os elementos de video em outhers
        // const videos = document.querySelectorAll('.outhers video');
        // // pegando o video do par
        // const video = Array.from(videos).find(v => v.id.toString() === pcId.toString());
        // if (video===undefined) return;

        // // removendo elemento de video
        // if (video.srcObject) {
        //     video.srcObject.getTracks()[0].stop();
        //     video.srcObject.getTracks()[1].stop();
        //     video.srcObject = null;
        //     video.parentElement.remove();
        // };

        // removendo todos os elementos de vídeo do par
        state.videoPeers[pcId].forEach((v) => {
                v.remove();
                // removendo a lista de videos do par
                state.videoPeers.splice(pcId, 1);
            }
        );

        // removendo conexão de par
        if (state.peerConnections[pcId]) {
            state.peerConnections[pcId].ontrack = null;
            state.peerConnections[pcId].onicecandidate = null;
            state.peerConnections[pcId].close();
            state.peerConnections[pcId] = null;
            state.peerConnections.splice(state.peerConnections[pcId], 1);
        };
    };

    // showDisplay
    const btnScreen = document.querySelector('button.btn-screen');
    btnScreen.addEventListener('click', async () => {
        if (state.peerConnectionsIds.length===0) {
            return showNotification('Nenhuma conexão para compartilhar a tela!');
        }

        const screenSharing = await navigator.mediaDevices.getDisplayMedia({
            video: true
        });
        // caso a tela já esteja sendo compartilhada substitui
        if (state.screenSharingSender.length>0) {
            return state.screenSharingSender.replaceTrack(screenSharing.getVideoTracks()[0]);
        }
        
        state.screenSharing = screenSharing;
        
        // evento quando o compartilhamento for finalizado
        screenSharing.getVideoTracks()[0].onended = (e) => {
            state.screenSharing.getTracks().forEach(track => track.stop());
            socket.emit('stop-screen-sharing', r, state.screenSharing.id);
            state.screenSharing = null;
            state.screenSharingSender = [];
        }

        // listando peers connections
        state.peerConnectionsIds.forEach(pcId => {
            for (const track of screenSharing.getTracks()) {
                const ss = state.peerConnections[pcId].addTrack(track, screenSharing);
                state.screenSharingSender[pcId] = ss;
            };
        });

        // criando a oferta pra cada par
        state.peerConnectionsIds.forEach(pcId => {
            state.peerConnections[pcId].createOffer()
            .then((offer) => {
                state.peerConnections[pcId].setLocalDescription(offer);
                socket.emit('offer-screen-sharing', offer, pcId);
            })
            .catch((err) => {
                console.error(err);
            });
        });
    });

    // recebendo o evento de parada de compartilhamento de tela
    socket.on('stop-screen-sharing', (streamId, pcId) => {
        // buscando dentro dos videos do par
        state.videoPeers[pcId].forEach((v, index) => {
            // verificando se o id do video é igual ao da stream
            if (v.firstElementChild.id.toString() === streamId.toString()) {
                // removendo o elemento do dom
                v.remove();
                // removendo o video da lista de videos do par
                state.videoPeers[pcId].splice(index, 1);
            }
        });
    })

    // exit
    btnExit.addEventListener('click', () => {
        socket.emit('leave', slug);
        stopMyStream();
        // stopOutherStream();
    });

    socket.on('leave', (pcId) => {

        playAudio('outher_disconnect');

        // alert('O parceiro se desconectou, você é novo dono da sala!');
        showNotification('O parceiro se desconectou, você é novo dono da sala!');
        // state.creator = true;
        // stopMyStream(); // forçando a saída da sala
        stopOutherStream(pcId);
    });
});