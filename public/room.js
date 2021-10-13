document.addEventListener('DOMContentLoaded', () => {

    // state
    const state = {
        // peerConnection: null,
        id: null,
        peerConnections: [],
        peerConnectionsIds: [],
        videoPeers: [],
        streamVideo: null,
        streamAudio: null,
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
        if (state.streamVideo===null) return showNotification('Câmera não está ativa!');
        
        state.mycam = !state.mycam;
        state.streamVideo.getTracks()[1].enabled = !state.streamVideo.getTracks()[1].enabled;
        if (state.mycam) {
            btnCam.classList.remove('btn-cam-active');
        }else{
            btnCam.classList.add('btn-cam-active');
        }
    });

    // mic
    btnMic.addEventListener('click', () => {
        if (state.streamAudio===null) return showNotification('Microfone não está ativo!');

        state.mymic = !state.mymic;
        state.streamAudio.getTracks()[0].enabled = !state.streamAudio.getTracks()[0].enabled;
        (state.mymic) ? btnMic.classList.remove('btn-mic-active') : btnMic.classList.add('btn-mic-active');
    });

    
    let slug = '';

    // check the room session
    let r = sessionStorage.getItem('room');
    let alias = sessionStorage.getItem('alias');
    console.log(alias);
    if (alias===null) alias = window.prompt('Isira um alias.');
    if (alias === '') {
        alert('Você precisa informar um alias!');
        return window.location.replace('/');
    }

    sessionStorage.setItem('alias', alias);
    
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

    socket.emit('join', slug, alias);




    // add new video element
    addNewVideoElement = (stream, pcId, alias='Alias') => {

        // pegando os elementos de video em outhers
        const videos = document.querySelectorAll('.outhers video');
        
        // filtrando stream em videos
        const video = Array.from(videos).find(v => v.id.toString() === stream.id.toString());
        // caso o id da stream seja diferente dos id
        if (video === undefined) {
            const el = document.createElement('div');
            el.classList.add('outher');
            el.classList.add('multicam');

            const img = document.createElement('img');
            img.src = "./assets/images/btn_cam_mute.png";
            el.appendChild(img);

            const h1 = document.createElement('h1');
            h1.innerText = alias;
            el.appendChild(h1);

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
        try {
            // const mediaStream = new MediaStream();
            state.streamAudio = await navigator.mediaDevices.getUserMedia({audio:true});
            state.streamVideo = await navigator.mediaDevices.getUserMedia({video:true});

            if (state.streamVideo) {
                mycam.srcObject = state.streamVideo;
                mycam.onloadedmetadata = (e) => {
                    mycam.play();
                }
            }
        }catch(e) {
            if (state.streamAudio === null && state.streamVideo===null) {
                alert('Você precisa permitir no mínimo o Audio para participar de uma chamada!');
                window.location.replace('/');
            }
        }
    };

    // set peerconnection
    setPeerConnection = (pcId, alias) => {
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
            addNewVideoElement(event.streams[0], pcId, alias);
        };

        const mediaStream = new MediaStream();
        if (state.streamAudio!==null) conn.addTrack(state.streamAudio.getTracks()[0], mediaStream);
        if (state.streamVideo!==null) conn.addTrack(state.streamVideo.getTracks()[0], mediaStream);

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
    socket.on('created', async (idSocket) => {
        state.creator = true;
        state.id = idSocket;

        await getMyUserMedia();
        // effect audio
        playAudio('join');
        // quando a segunda pessoa entra
        socket.emit('ready', slug, state.id);
    });
    socket.on('joined', async (idSocket) => {
        state.creator = false;
        state.id = idSocket;
        
        await getMyUserMedia();
        playAudio('join');
        // quando a segunda pessoa entra
        socket.emit('ready', slug, state.id);
    });
    socket.on('full', () => {
        alert("Opa! A sala atingiu o total suportado!");
        return window.location.replace('/');
    });
    socket.on('ready', (pcId, alias) => {

        playAudio('outher_join');
        
        // alert('Um parceiro chegou!');
        showNotification('Um parceiro chegou!');

        setPeerConnection(pcId, alias);

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
    socket.on('offer', (offer, pcId, alias) => {
        console.log('recebendo oferta');
        // if (!state.creator) {

        if (state.peerConnections[pcId]===undefined) {
            setPeerConnection(pcId, alias);
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
        console.log('recebendo a resposta');
        state.peerConnections[pcId].setRemoteDescription(answer);
    });

    stopMyStream = () => {
        if (mycam.srcObject) {
            mycam.srcObject.getTracks().forEach((t) => t.stop());
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
        if (state.videoPeers[pcId]) {
            state.videoPeers[pcId].forEach((v) => {
                    v.remove();
                    // removendo a lista de videos do par
                    state.videoPeers.splice(pcId, 1);
                }
            );
        }

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
        if (Object.keys(state.screenSharingSender).length>0) {
            return state.peerConnectionsIds.forEach(pcId => {
                state.screenSharingSender[pcId].replaceTrack(screenSharing.getVideoTracks()[0]);
            });
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