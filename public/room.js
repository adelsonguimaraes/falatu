document.addEventListener('DOMContentLoaded', () => {

    // state
    const state = {
        // peerConnection: null,
        id: null,
        peerConnections: [],
        peerConnectionsIds: [],
        videoPeers: [],
        stream: null,
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

    
    // check the room session
    let slug = '';
    let r = sessionStorage.getItem('room');
    const hash = window.location.hash.replace('#', '');
    // verificando se clicou em criar
    const create = sessionStorage.getItem('create');
    
    if (!r) {
        if (hash==='') {
            return window.location.replace('/');
        }else{
            slug = hash;
        }
    }else{
        slug = r;
    }

    // reforce hash
    slug = slug.trim().toLowerCase().replace(' ', '_');
    window.location.hash = '#' + slug;

    // verificando se a sala existe
    socket.emit('check-room', slug);
    socket.on('check-room', check => {
        if (!check && !create) {
            alert('A sala não foi encontrada, talvez o dono tenha encerrado a chamada.');
            return window.location.replace('/');
        }else{
            // assim que entrar na room chama a tela de preparo
            Preparo.show();
        }
    });
    
    // chamado pelo controle de preparo
    iniciar = (stream, alias) => {
        // adicionando stream
        state.stream = stream;
        
        // verificando se clicou em criar
        const create = sessionStorage.getItem('create');

        socket.emit('join', slug, alias, create);
    }

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

        // verificando estado das mídias
        if(!state.stream.getAudioTracks()[0] || !state.stream.getAudioTracks()[0].enabled) {
            state.mymic = false;
            btnMic.classList.remove('btn-mic-active');
        }
        if(!state.stream.getVideoTracks()[0] || !state.stream.getVideoTracks()[0].enabled) {
            state.mycam = false;
            btnCam.classList.remove('btn-cam-active');
        }

        // eventos de botões
        
        // cam
        btnCam.addEventListener('click', () => {
            if (!state.stream.getVideoTracks()[0]) return showNotification('Câmera não está ativa!');
            
            state.mycam = !state.mycam;
            state.stream.getVideoTracks()[0].enabled = !state.stream.getVideoTracks()[0].enabled;
            if (state.mycam) {
                btnCam.classList.add('btn-cam-active');
                btnCam.title = "Mutar Câmera";
            }else{
                btnCam.classList.remove('btn-cam-active');
                btnCam.title = "Desmutar Câmera";
            }

            socket.emit('mic-cam-toggle', slug, state.mymic, state.mycam);
        });

        // mic
        btnMic.addEventListener('click', () => {
            if (!state.stream.getAudioTracks()[0]) return showNotification('Microfone não está ativo!');

            state.mymic = !state.mymic;
            state.stream.getAudioTracks()[0].enabled = !state.stream.getAudioTracks()[0].enabled;
            if (state.mymic) {
                btnMic.classList.add('btn-mic-active');
                btnMic.title = "Mutar Microfone";
            }else{
                btnMic.classList.remove('btn-mic-active');
                btnMic.title = "Desmutar Microfone";
            }

            socket.emit('mic-cam-toggle', slug, state.mymic, state.mycam);
        });

        // se for mobile remove botão de compartilhar tela
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            btnScreen.remove();
        }

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
                    socket.emit('stop-screen-sharing', slug, state.screenSharing.id);
                    state.screenSharing = null;
                    state.screenSharingSender = [];

                    state.myscreen = !state.myscreen;
                    (state.myscreen) ? btnScreen.classList.add('btn-screen-active') : btnScreen.classList.remove('btn-screen-active');

                    showNotification(`Compartilhamento de tela finalizado`);
                    AudioEffect.play('screen_sharing_stop');

                    btnScreen.title = "Compartilhar Tela";

                    return true;
                }

                const screenSharing = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: "always"
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100
                    }
                });

                state.myscreen = !state.myscreen;
                (state.myscreen) ? btnScreen.classList.add('btn-screen-active') : btnScreen.classList.remove('btn-screen-active');
                
                state.screenSharing = screenSharing;
                
                // evento quando o compartilhamento for finalizado
                screenSharing.getVideoTracks()[0].onended = (e) => {
                    state.screenSharing.getTracks().forEach(track => track.stop());
                    socket.emit('stop-screen-sharing', slug, state.screenSharing.id);
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
                AudioEffect.play('screen_sharing');

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

    removeVideoInfocus = (v) => {
        const outhers = document.querySelector('.outhers');
        outhers.appendChild(v.parentElement);
        state.videoInFocus.remove();
        state.videoInFocus = null;

        // adicionando em outher a class outhers infocus
        outhers.classList.remove('outhers-infocus');
        Array.from(outhers.querySelectorAll('.outher'))
        .forEach(e => {
            e.querySelector('h1').classList.remove('h1-infocus');
            e.classList.remove('outher-infocus')
        });
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
            if (state.videoInFocus) el.classList.add('outher-infocus');

            const h1 = document.createElement('h1');
            h1.innerText = label+' '+alias;
            h1.style.backgroundColor = color;
            if (state.videoInFocus) h1.classList.add('h1-infocus');

            el.appendChild(h1);

            const v = document.createElement('video');
            v.id = stream.id;
            v.srcObject = stream;
            v.controls = false;
            if (pcId===0) v.muted = true;
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

                    // adicionando em outher a class outhers infocus
                    outhers.classList.add('outhers-infocus');
                    Array.from(outhers.querySelectorAll('.outher'))
                    .forEach(e => {
                        e.querySelector('h1').classList.add('h1-infocus');
                        e.classList.add('outher-infocus')
                    });

                    showNotification(`${h1.innerText} colocado em foco.`);

                }else if (state.videoInFocus.firstChild === v.parentElement){
                    removeVideoInfocus(v);
                }else{
                    const outhers = document.querySelector('.outhers');
                    // adicionando os estilos infocus
                    state.videoInFocus.firstChild.classList.add('outher-infocus');
                    state.videoInFocus.firstChild.querySelector('h1')
                    .classList.add('h1-infocus');
                    outhers.appendChild(state.videoInFocus.firstChild);
                    
                    // revemovendos os estilos infocus
                    v.parentElement.classList.remove('outher-infocus');
                    v.parentElement.querySelector('h1')
                    .classList.remove('h1-infocus');

                    state.videoInFocus.appendChild(v.parentElement);

                    showNotification(`${h1.innerText} colocado em foco.`);
                }

                AudioEffect.play('popup');

                // calculando no evento de click do infocus
                // calcVideosStyle();
            }

            state.videoPeers[pcId].push(el);

            // calculando quando adiciona um video novo
            calcVideosStyle();
        }
    }

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

        if (state.stream.getAudioTracks()[0]) conn.addTrack(state.stream.getAudioTracks()[0], state.stream);
        if (state.stream.getVideoTracks()[0]) conn.addTrack(state.stream.getVideoTracks()[0], state.stream);

        // verificando se possui compartilhamento de tela ativo
        if (state.screenSharing) {
            state.screenSharing.getTracks().forEach(track => {
                conn.addTrack(track, state.screenSharing)
            });
        }

        state.peerConnectionsIds.push(pcId);
        state.peerConnections[pcId] = conn;
    }
    
    // events socket from server response
    socket.on('created', async (idSocket, alias) => {
        state.creator = true;
        state.id = idSocket;

        // adicionado a grade de videos
        addNewVideoElement(state.stream, 0, alias);
        // adicionando botões de chamada
        adicionaButtons();

        // effect audio
        AudioEffect.play('join');
        // quando a segunda pessoa entra
        // socket.emit('ready', slug, state.id);
    });
    socket.on('joined', async (idSocket, alias) => {
        state.creator = false;
        state.id = idSocket;
        
        // adicionado a grade de videos
        addNewVideoElement(state.stream, 0, alias);
        // adicionando botões de chamada
        adicionaButtons();
        
        AudioEffect.play('join');
        // quando a segunda pessoa entra
        socket.emit('ready', slug, state.id);
    });
    socket.on('full', () => {
        alert("Opa! A sala atingiu o total suportado");
        return window.location.replace('/');
    });
    socket.on('ready', (pcId, alias) => {
        AudioEffect.play('outher_join');
        
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

            // enviando status de mute do mic
            socket.emit('mic-cam-toggle', slug, state.mymic, state.mycam);
        })
        .catch((err) => {
            console.error(err);
        });
    });
    socket.on('offer-screen-sharing', async (offer, pcId, alias) => {
        showNotification(`${alias} iniciou um compartilhamento de tela.`);

        AudioEffect.play('screen_sharing');
        
        state.peerConnections[pcId].setRemoteDescription(offer);
        const answer = await state.peerConnections[pcId].createAnswer();
        state.peerConnections[pcId].setLocalDescription(answer);
        socket.emit('answer', answer, pcId);
    });
    socket.on('answer', (answer, pcId) => {
        state.peerConnections[pcId].setRemoteDescription(answer);
    });

    stopOutherStream = (pcId) => {
        // removendo todos os elementos de vídeo do par
        if (state.videoPeers[pcId]) {
            state.videoPeers[pcId].forEach((v) => {
                    if (state.videoInFocus && state.videoInFocus.firstChild === v) {
                        removeVideoInfocus(v);
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

        AudioEffect.play('screen_sharing_stop');

        // buscando dentro dos videos do par
        state.videoPeers[pcId].forEach((v, index) => {
            // verificando se o id do video é igual ao da stream
            if (v.querySelector('video').id.toString() === streamId.toString()) {
                // removendo se estiver infocus
                if (state.videoInFocus && state.videoInFocus.firstChild === v) {
                    removeVideoInfocus(v);
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
            AudioEffect.play('outher_disconnect');
            showNotification(`${alias} saiu da sala`);
            stopOutherStream(pcId);
        }
    });
});