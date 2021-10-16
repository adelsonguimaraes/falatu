const Preparo = {
    async show() {
        const preparo = document.createElement('div');
        preparo.classList.add('preparo');
        preparo.innerHTML = `
            <div class="room">
                <div>
                    <label>Room</label>
                    <a>#5545445</a>
                </div>
            </div>
            <div class="cam">
                <video id="preparo_video"></video>
                <label class="alias" id="preparo_alias">Alias</label>
                <div>
                    <button id="preparo_btn_mic">
                        <img src="./assets/images/btn_mic.png">
                    </button>
                    <button id="preparo_btn_cam">
                        <img src="./assets/images/btn_cam.png">
                    </button>
                </div>
            </div>
            <label>Insira seu Alias</label>
            <input id="preparo_input" type="text" placeholder="Insira seu Alias" autocomplete="off">
            <button id="preparo_pronto" type="button">Pronto</button>
            <button id="preparo_sair" type="button" class="btn-vermelho">Sair</button>
        `;

        document.body.appendChild(preparo);

        const preparoVideo = document.getElementById('preparo_video');
        const preparoAlias = document.getElementById('preparo_alias');
        const inputPreparo = document.getElementById('preparo_input');
        const btnPreparoMic = document.getElementById('preparo_btn_mic');
        const btnPreparoCam = document.getElementById('preparo_btn_cam');
        const btnPreparoPronto = document.getElementById('preparo_pronto');
        const btnPreparoSair = document.getElementById('preparo_sair');

        let alias = sessionStorage.getItem('alias');
        if (alias) {
            inputPreparo.value = alias;
            preparoAlias.innerHTML = alias;
        }

        inputPreparo.addEventListener('input', (e) => {
            e.target.value = e.target.value.substring(0, 10);
            preparoAlias.innerHTML = (e.target.value==='') ? 'Alias' : e.target.value;
            alias = e.target.value;
        });

        btnPreparoMic.addEventListener('click', (e) => {
            if (!stream.getAudioTracks()[0]) return false;

            stream.getAudioTracks()[0].enabled = !stream.getAudioTracks()[0].enabled;
            if (stream.getAudioTracks()[0].enabled) {
                btnPreparoMic.querySelector('img').src = './assets/images/btn_mic.png';
            }else{
                btnPreparoMic.querySelector('img').src = './assets/images/btn_mic_mute.png';
            }
        });

        btnPreparoCam.addEventListener('click', (e) => {
            if (!stream.getVideoTracks()[0]) return false;

            stream.getVideoTracks()[0].enabled = !stream.getVideoTracks()[0].enabled;
            if (stream.getVideoTracks()[0].enabled) {
                btnPreparoCam.querySelector('img').src = './assets/images/btn_cam.png';
            }else{
                btnPreparoCam.querySelector('img').src = './assets/images/btn_cam_mute.png';
            }
        });

        btnPreparoPronto.addEventListener('click', (e) => {
            if (!stream.getAudioTracks()[0] && !stream.getVideoTracks()[0]) {
                return alert('Permita o uso do Microfone para entrar na sala');
            };
            if (!alias) return alert('Informe um alias para entrar na sala');

            sessionStorage.setItem('alias', alias);

            preparo.remove();
            
            iniciar(stream, alias);
            
        });

        btnPreparoSair.addEventListener('click', (e) => {
            window.location.replace('/');
        });

        const stream = await this.getMedia();

        if (!stream.getAudioTracks()[0]) btnPreparoMic.querySelector('img').src = './assets/images/btn_mic_mute.png';
        if (!stream.getVideoTracks()[0]) btnPreparoCam.querySelector('img').src = './assets/images/btn_cam_mute.png';
        preparoVideo.srcObject = stream;
        preparoVideo.onloadedmetadata = (e) => preparoVideo.play();
        
    },
    async getMedia () {
        const mediaStream = new MediaStream();
        let streamAudio = null;
        let streamVideo = null;

        try {
            streamAudio = await navigator.mediaDevices.getUserMedia({audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }});
            streamVideo = await navigator.mediaDevices.getUserMedia({video:true});

            mediaStream.addTrack(streamAudio.getAudioTracks()[0]);
            mediaStream.addTrack(streamVideo.getVideoTracks()[0]);
        }catch(e) {
            if (!streamAudio && !streamVideo) {
                alert('Você precisa permitir pelo menos o uso do Microfone para entra na sala.');
                // return window.location.replace('/');
            }else{
                if (streamAudio) mediaStream.addTrack(streamAudio.getAudioTracks()[0]);
                (streamVideo) ? mediaStream.addTrack(streamVideo.getVideoTracks()[0]) : showNotification('Problema na captura da Câmera!');
            }
        }

        return mediaStream;
    }
}