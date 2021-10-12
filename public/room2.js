document.addEventListener('DOMContentLoaded', () => {

    // state
    const state = {
        // peerConnection: null,
        id: null,
        peerConnectionsIds: [],
        peerConnections: [],
        remote_stream: [],
        stream: null,
        screenSharing: null,
        screenSharingSender: null,
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
    addNewVideoElement = (stream) => {
        // pegando os elementos de video em outhers
        const videos = document.querySelectorAll('.outhers video');
        // caso ainda não exista nenhum video em outhers criamos
        if (Array.from(videos).length===0) {
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
        }else{
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
            }
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

            // quando a segunda pessoa entra
            // socket.emit('ready', slug, state.id);

        }).catch((err) => {
            // alert('Não foi possível acessar a Câmera!');
            // stopMyStream();

            console.error(err);
        });
    };

    // set peerconnection
    setPeerConnection = (pcId) => {
        console.log('Set my peer connection', pcId);

        const connection = new RTCPeerConnection(iceServers);
        // const dataChannel = connection.createDataChannel('both', {negotiated: true, id: pcId});

        // toda vez que houve dados de track ele entra no evento de negociação
        connection.onnegotiationneeded = async (e) => {
            // cria oferta
            // const offer = await connection.createOffer();
            // await connection.setLocalDescription(offer);

            // socket.emit('process', {
            //     message: JSON.stringify({offer: connection.localDescription}), 
            //     room: r,
            //     pcId
            // });
        };

        connection.onicecandidate = (e) => {
            if (e.candidate) {
                socket.emit('process', {
                    message: JSON.stringify({icecandidate: e.candidate}), 
                    room: r,
                    pcId
                });
            }
        };

        connection.ontrack = (e) => {
            if (!state.remote_stream[pcId]) {
                state.remote_stream[pcId] = new MediaStream();
            }

            if (e.track.kind == 'video') {
                state.remote_stream[pcId].getVideoTracks()
                .forEach((t) => state.remote_stream[pcId].removeTrack(t));
                state.remote_stream[pcId].addTrack(e.track);
            }else if (e.track.kind == 'audio') {
                state.remote_stream[pcId].getAudioTracks()
                .forEach((t) => state.remote_stream[pcId].removeTrack(t));
                state.remote_stream[pcId].addTrack(e.track);
            }

        }
        

        // state.peerConnections[pcId].addTrack(state.stream.getTracks()[0], state.stream);
        // state.peerConnections[pcId].addTrack(state.stream.getTracks()[1], state.stream);
        connection.addTrack(state.stream.getTracks()[0], state.stream);
        connection.addTrack(state.stream.getTracks()[1], state.stream);

        state.peerConnectionsIds[pcId] = pcId;
        state.peerConnections[pcId] = connection;
    }


    createOffer = async (pcId) => {
        console.log('criando a oferta');
        const offer = await state.peerConnections[pcId].createOffer();
        await state.peerConnections[pcId].setLocalDescription(offer);

        socket.emit('process', {
            message: JSON.stringify({offer: state.peerConnections[pcId].localDescription}), 
            room: r,
            pcId
        });
    };

    welcome = (pcId) => {
        // mandando o id pro peer
        socket.emit('welcome', {
            room: r, 
            pcId: pcId
        });
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
    });
    socket.on('joined', async (idSocket) => {
        state.creator = false;
        state.id = idSocket;
        
        await getMyUserMedia();
        // quando a segunda pessoa entra
        await socket.emit('ready', slug, state.id);
        playAudio('join');
    });
    socket.on('full', () => {
        alert("Opa! A sala atingiu o total suportado!");
        return window.location.replace('/');
    });
    socket.on('ready', async (pcId) => {
        playAudio('outher_join');
        
        // alert('Um parceiro chegou!');
        showNotification('Um parceiro chegou!');

        await setPeerConnection(pcId);
        // await welcome(pcId);
        await createOffer(pcId);

        // if (state.creator) {
            // criando oferta
            // state.peerConnections[pcId].createOffer()
            // .then((offer) => {
            //     state.peerConnections[pcId].setLocalDescription(offer);
            //     socket.emit('offer', offer, r, state.id);
            // })
            // .catch((err) => {
            //     console.error(err);
            // });
        // }
    });
    socket.on('candidate', async (cadidate, pcId) => {
        console.log('RECEBENDO CANDIDATO');
        const iceCandidate = new RTCIceCandidate(cadidate);
        // state.peerConnection.addIceCandidate(iceCandidate);
        // console.log(state.peerConnections);
        // console.log(pcId);
        const pc = state.peerConnections.filter(p => p.id === pcId)[0];
        // console.log(pc);
        pc.addIceCandidate(iceCandidate);
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
                socket.emit('answer', answer, r, state.id);
            })
            .catch((err) => {
                console.error(err);
            });
        // }
    });
    socket.on('answer', (answer, pcId) => {
        state.peerConnections[pcId].setRemoteDescription(answer);
    });

    OnIceCandidateFunction = (event) => {
        // check candidate in event   
        if (event.candidate) {
            socket.emit('candidate', event.candidate, r, state.id);
        }
    };

    // recebendo eventos de adição de stream depois de uma oferta
    OnTrackFunction = (event) => {
        addNewVideoElement(event.streams[0]);
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

    // showDisplay
    const btnScreen = document.querySelector('button.btn-screen');
    btnScreen.addEventListener('click', async () => {
        if (state.peerConnections.length===0) {
            return showNotification('Nenhuma conexão para compartilhar a tela!');
        }

        const screenSharing = await navigator.mediaDevices.getDisplayMedia({
            video: true
        });
        // caso a tela já esteja sendo compartilhada substitui
        if (state.screenSharingSender!==null) {
            return state.screenSharingSender.replaceTrack(screenSharing.getVideoTracks()[0]);
        }
        
        state.screenSharing = screenSharing;
        
        // evento quando o compartilhamento for finalizado
        screenSharing.getVideoTracks()[0].onended = (e) => {
            state.screenSharing.getTracks().forEach(track => track.stop());
            socket.emit('stop-screen-sharing', slug, state.screenSharing.id);
            state.screenSharing = null;
            state.screenSharingSender = null;
        }

        // listando peers connections
        state.peerConnections.forEach(p => {
            for (const track of screenSharing.getTracks()) {
                p.screenSharingSender = p.addTrack(track, screenSharing);
            };
            // state.screenSharingSender = state.peerConnection.addTrack(track, screenSharing);
        });

        // criando a oferta pra cada par
        state.peerConnections.forEach(p => {
            p.createOffer()
            .then((offer) => {
                p.setLocalDescription(offer);
                socket.emit('offer', offer, r, state.id);
            })
            .catch((err) => {
                console.error(err);
            });
        });
    });

    // recebendo o evento de parada de compartilhamento de tela
    socket.on('stop-screen-sharing', (idStream) => {
        const videos = document.querySelectorAll('.outhers video');
        Array.from(videos).forEach(video => {
            if (video.id === idStream) {
                video.srcObject = null;
                video.parentElement.remove();
            }
        });
    })

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

    // socket.on('welcome', (data) => {
    //     setPeerConnection(data.pcId);
    // });

    socket.on('process', async (data) => {
        const message = JSON.parse(data.message);

        if (message.answer) {
            console.log('opa uma resposta');
        }else if (message.offer) {
            console.log('recebdo uma oferta');
            if (!state.peerConnections[data.pcId]) await setPeerConnection(data.pcId);
            // quando receber uma oferta criamos uma resposta
            const answer = await state.peerConnections[data.pcId].createAnswer();
            console.log(answer)
            // setamos a resposta como localdescription
            // await peerConnections[data.pcId].setLocalDescription(answer);
            // emitimos um process com objeto mensagem e pcId
            // socket.emit('process', {
            //     message: JSON.stringify({answer: answer}),
            //     pcId: data.pcId
            // });
        }else if (message.candidate) {
            console.log('temos um candidato');
        }
    });
});