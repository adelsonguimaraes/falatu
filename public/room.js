document.addEventListener('DOMContentLoaded', () => {

    // chamando a splash
    splash.show();

    // state
    const state = {
        // peerConnection: null,
        id: null,
        peerConnections: [],
        peerConnectionsIds: [],
        videoPeers: [],
        streamVideo: null,
        streamAudio: null,
        videoInFocus: null,
        screenSharing: null,
        screenSharingSender: [],
        creator: true,
        mycam: true,
        mymic: true,
        myscreen: false,
    };

    // room
    const socket = io('/');
    const outhers = document.querySelector('div .outhers');
    const buttonsBox = document.querySelector('.buttons-cam');
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

    socket.on('mic-cam-toggle', (pcId, statusMic, statusCam) => {
        if (!statusMic) {
            const imgMic = state.videoPeers[pcId][0].querySelector('.mic-muted-overlay');
            if (!imgMic) {
                const img = document.createElement('img');
                img.src = "./assets/images/btn_mic_mute.png";
                img.classList.add('mic-muted-overlay');
                state.videoPeers[pcId][0].appendChild(img);
            }
        }else{
            const el = state.videoPeers[pcId][0].querySelector('.mic-muted-overlay');
            if (el) el.remove();
        }

        if (!statusCam) {
            const imgCam = state.videoPeers[pcId][0].querySelector('.cam-muted-overlay');
            if (!imgCam) {
                const img = document.createElement('img');
                img.src = "./assets/images/btn_cam_mute.png";
                img.classList.add('cam-muted-overlay');
                state.videoPeers[pcId][0].appendChild(img);
            }
        }else{
            const el = state.videoPeers[pcId][0].querySelector('.cam-muted-overlay');
            if (el) el.remove();
        }
    });

    
    let slug = '';

    // check the room session
    let r = sessionStorage.getItem('room');
    let alias = sessionStorage.getItem('alias');
    
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
            alert('A sala não é válida');
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
    const create = sessionStorage.getItem('create');

    socket.emit('join', slug, alias, create);


    socket.on('ivalid-room', () => {
        alert('A sala não é válida!');
        return window.location.replace('/');
    });

    adicionaButtons = () => {
        buttonsBox.innerHTML = `
            <button class="btn-cam btn-cam-active" title="Mutar Câmera"></button>
            <button class="btn-mic btn-mic-active" title="Mutar Microfone"></button>
            <button class="btn-screen" title="Compartilhar Tela"></button>
            <button class="btn-exit" title="Sair da Sala"></button>
        `;

        const btnCam = document.querySelector('.btn-cam');
        const btnMic = document.querySelector('.btn-mic');
        const btnScreen = document.querySelector('button.btn-screen');
        const btnExit = document.querySelector('.btn-exit');

        // eventos de botões
        
        // cam
        btnCam.addEventListener('click', () => {
            if (state.streamVideo===null) return showNotification('Câmera não está ativa!');
            
            state.mycam = !state.mycam;
            state.streamVideo.getTracks()[0].enabled = !state.streamVideo.getTracks()[0].enabled;
            if (state.mycam) {
                btnCam.classList.add('btn-cam-active');
                btnCam.title = "Mutar Câmera";
            }else{
                btnCam.classList.remove('btn-cam-active');
                btnCam.title = "Desmutar Câmera";
            }

            socket.emit('mic-cam-toggle', r, state.mymic, state.mycam);
        });

        // mic
        btnMic.addEventListener('click', () => {
            if (state.streamAudio===null) return showNotification('Microfone não está ativo!');

            state.mymic = !state.mymic;
            state.streamAudio.getTracks()[0].enabled = !state.streamAudio.getTracks()[0].enabled;
            if (state.mymic) {
                btnMic.classList.add('btn-mic-active');
                btnMic.title = "Mutar Microfone";
            }else{
                btnMic.classList.remove('btn-mic-active');
                btnMic.title = "Desmutar Microfone";
            }

            socket.emit('mic-cam-toggle', r, state.mymic, state.mycam);
        });

        // se for mobile remove botão de compartilhar tela
        if (navigator.userAgentData.mobile) btnScreen.remove();

        btnScreen.addEventListener('click', async () => {

            try {
                // verificando se há conexões peers
                if (state.peerConnectionsIds.length===0) {
                    return showNotification('Nenhuma conexão para compartilhar a tela!');
                }

                // caso a tela já esteja sendo compartilhada derrubamos
                if (state.screenSharing!=null) {
                    // se tiver uma tela conectada para tudo
                    state.screenSharing.getTracks().forEach(track => track.stop());
                    socket.emit('stop-screen-sharing', r, state.screenSharing.id);
                    state.screenSharing = null;
                    state.screenSharingSender = [];

                    state.myscreen = !state.myscreen;
                    (state.myscreen) ? btnScreen.classList.add('btn-screen-active') : btnScreen.classList.remove('btn-screen-active');

                    showNotification(`Compartilhamento de tela finalizado`);
                    playAudio('screen_sharing_stop');

                    btnScreen.title = "Compartilhar Tela";

                    return true;
                }

                const screenSharing = await navigator.mediaDevices.getDisplayMedia({
                    video: true
                });

                state.myscreen = !state.myscreen;
                (state.myscreen) ? btnScreen.classList.add('btn-screen-active') : btnScreen.classList.remove('btn-screen-active');

                    // caso a tela já esteja sendo compartilhada substitui
                // if (Object.keys(state.screenSharingSender).length>0) {
                    // suspendendo por enquanto a atualização de uma tela já compartilhada
                    // return state.peerConnectionsIds.forEach(pcId => {
                    //     state.screenSharingSender[pcId].replaceTrack(screenSharing.getVideoTracks()[0]);
                    // });
                // }
                
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

                showNotification(`Compartilhamento de tela iniciado`);
                playAudio('screen_sharing');

                btnScreen.title = "Parar Compartilhamento";


            } catch (e) {
                console.error('O usuário não deu permissão de compartilhar a tela ou cancelou.', e); 
            }
        });

        // exit
        btnExit.addEventListener('click', () => {
            socket.emit('leave', slug);
            window.location.replace('/');
        });
    }

    calcVideosStyle = () => {
        const len = document.querySelectorAll('.outhers video').length;
        // mobile
        if (window.innerWidth <= 720) {
            document.querySelector('.outhers').style = (len<=2) ? 'flex-direction:column;' : 'flex-direction:row;';
        // desktop
        }else{
            if (len<=2 || state.videoInFocus) {
                document.querySelector('.outhers').style = 'align-content: stretch;';
                Array.from(document.querySelectorAll('.multicam')).forEach(e => e.style = 'height: auto; flex:300px;');
            }else{
                document.querySelector('.outhers').style = 'align-content: center;';
                Array.from(document.querySelectorAll('.multicam')).forEach(e => e.style = 'height: 200px; flex: 0 300px;');
            }
        }
    }

    // add new video element
    addNewVideoElement = (stream, pcId, alias='Alias') => {

        // pegando os elementos de video em outhers
        const videos = document.querySelectorAll('.outhers video');
        
        // filtrando stream em videos
        const video = Array.from(videos).find(v => v.id.toString() === stream.id.toString());
        // caso o id da stream seja diferente dos id
        if (video === undefined) {
            
            if (state.videoPeers[pcId]===undefined) state.videoPeers[pcId] = [];

            let color = 'darkmagenta';
            let label = '';
            
            if (state.videoPeers[pcId].length>0) {
                label = 'Tela de';
                color = '#8b0000';
            }

            const el = document.createElement('div');
            el.classList.add('outher');
            el.classList.add('multicam');

            const h1 = document.createElement('h1');
            h1.innerText = label+' '+alias;
            h1.style.backgroundColor = color;
            el.appendChild(h1);

            const v = document.createElement('video');
            v.id = stream.id;
            v.srcObject = stream;
            v.controls = false;
            el.appendChild(v);
            outhers.appendChild(el);

            v.onloadedmetadata = (e) => {
                v.play();
            }
            v.onclick = (e) => {
                // v.requestFullscreen();
                if (!state.videoInFocus) {
                    const len = document.querySelectorAll('.outhers video').length;
                    if (len===1) return false;

                    const infocus = document.createElement('div');
                    infocus.classList.add('infocus');
                    infocus.appendChild(v.parentElement);
                    document.querySelector('.video-box').prepend(infocus);
                    state.videoInFocus = infocus;

                    showNotification(`${h1.innerText} colocado em foco.`);

                }else if (state.videoInFocus.firstChild === v.parentElement){
                    const outhers = document.querySelector('.outhers');
                    outhers.appendChild(v.parentElement);
                    state.videoInFocus.remove();
                    state.videoInFocus = null;

                }else{
                    const outhers = document.querySelector('.outhers');
                    outhers.appendChild(state.videoInFocus.firstChild);
                    state.videoInFocus.appendChild(v.parentElement);

                    showNotification(`${h1.innerText} colocado em foco.`);
                }

                // calculando no evento de click do infocus
                calcVideosStyle();
            }

            state.videoPeers[pcId].push(el);

            // calculando quando adiciona um video novo
            calcVideosStyle();
        }
    }

    // get user media function
    getMyUserMedia = async () => {
        const mediaStream = new MediaStream();

        try {
            state.streamAudio = await navigator.mediaDevices.getUserMedia({audio:true});
            state.streamVideo = await navigator.mediaDevices.getUserMedia({video:true});

            mediaStream.addTrack(state.streamAudio.getAudioTracks()[0]);
            mediaStream.addTrack(state.streamVideo.getVideoTracks()[0]);
        }catch(e) {
            if (state.streamAudio === null && state.streamVideo===null) {
                alert('Você precisa permitir no mínimo o aúdio para participar de uma sala!');
                return window.location.replace('/');
            }else{
                if (state.streamAudio) mediaStream.addTrack(state.streamAudio.getAudioTracks()[0]);
                if (state.streamVideo) mediaStream.addTrack(state.streamVideo.getVideoTracks()[0]);
            }
        }

        // adicionado a grade de videos
        addNewVideoElement(mediaStream, 0, alias);
        // adicionando botões de chamada
        adicionaButtons();
    };

    // set peerconnection
    setPeerConnection = (pcId, alias) => {
        const conn = new RTCPeerConnection(iceServers);
        
        conn.onicecandidate = (event) => {
            // check candidate in event   
            if (event.candidate) {
                socket.emit('candidate', event.candidate, pcId);
            }
        };
        
        // escutando recebimento de mídia da outra ponta
        conn.ontrack = (event) => {
            event.streams.forEach(stream => addNewVideoElement(stream, pcId, alias));
        };

        const mediaStream = new MediaStream();
        if (state.streamAudio!==null) conn.addTrack(state.streamAudio.getTracks()[0], mediaStream);
        if (state.streamVideo!==null) conn.addTrack(state.streamVideo.getTracks()[0], mediaStream);

        // verificando se possui compartilhamento de tela ativo
        if (state.screenSharing) {
            state.screenSharing.getTracks().forEach(track => {
                conn.addTrack(track, state.screenSharing)
            });
        }

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
        // socket.emit('ready', slug, state.id);
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
        alert("Opa! A sala atingiu o total suportado");
        return window.location.replace('/');
    });
    socket.on('ready', (pcId, alias) => {
        playAudio('outher_join');
        
        // alert('Um parceiro chegou!');
        showNotification(`${alias} entrou na sala`);

        setPeerConnection(pcId, alias);

        // criando oferta
        state.peerConnections[pcId].createOffer()
        .then((offer) => {
            state.peerConnections[pcId].setLocalDescription(offer);
            socket.emit('offer', offer, pcId);
        })
        .catch((err) => {
            console.error(err);
        });
    });
    socket.on('candidate', async (cadidate, pcId) => {
        const iceCandidate = new RTCIceCandidate(cadidate);
        state.peerConnections[pcId].addIceCandidate(iceCandidate);
    });
    socket.on('offer', (offer, pcId, alias) => {
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
    });
    socket.on('offer-screen-sharing', async (offer, pcId, alias) => {
        showNotification(`${alias} iniciou um compartilhamento de tela.`);

        playAudio('screen_sharing');
        
        state.peerConnections[pcId].setRemoteDescription(offer);
        const answer = await state.peerConnections[pcId].createAnswer();
        state.peerConnections[pcId].setLocalDescription(answer);
        socket.emit('answer', answer, pcId);
    });
    socket.on('answer', (answer, pcId) => {
        state.peerConnections[pcId].setRemoteDescription(answer);
        // enviando status de mute do mic
        socket.emit('mic-cam-toggle', r, state.mymic, state.mycam)
    });

    stopOutherStream = (pcId) => {
        // removendo todos os elementos de vídeo do par
        if (state.videoPeers[pcId]) {
            state.videoPeers[pcId].forEach((v) => {
                    if (state.videoInFocus && state.videoInFocus.firstChild === v) {
                        state.videoInFocus.remove();
                        state.videoInFocus = null;
                    }
                    v.remove();
                }
            );
        }

        // removendo a lista de videos do par
        delete state.videoPeers[pcId];
        
        // removendo conexão de par
        if (state.peerConnections[pcId]) {
            state.peerConnections[pcId].ontrack = null;
            state.peerConnections[pcId].onicecandidate = null;
            state.peerConnections[pcId].close();
            state.peerConnections[pcId] = null;
            // removendo o peer que desconectou
            delete state.peerConnections[pcId];
        };

        // removendo id do par da lista (array comum)
        state.peerConnectionsIds = state.peerConnectionsIds.filter(id => id != pcId);

        calcVideosStyle();
    };

    // recebendo o evento de parada de compartilhamento de tela
    socket.on('stop-screen-sharing', (streamId, pcId, alias) => {
        showNotification(`${alias} finalizou o compartilhamento de tela.`);

        playAudio('screen_sharing_stop');

        // buscando dentro dos videos do par
        state.videoPeers[pcId].forEach((v, index) => {
            // verificando se o id do video é igual ao da stream
            if (v.querySelector('video').id.toString() === streamId.toString()) {
                // removendo se estiver infocus
                if (state.videoInFocus && state.videoInFocus.firstChild === v) {
                    state.videoInFocus.remove();
                    state.videoInFocus = null;
                }
                // removendo o elemento do dom
                v.remove();
                // removendo o video da lista de videos do par
                state.videoPeers[pcId].splice(index, 1);
            }
        });

        calcVideosStyle();
    })

    socket.on('leave', (pcId, alias) => {
        if (state.peerConnections[pcId]) {
            playAudio('outher_disconnect');
            showNotification(`${alias} saiu da sala`);
            stopOutherStream(pcId);
        }
    });
});