const AudioEffect = {
    play(a) {
        const audio = new Audio();
        audio.volume = .5;
        audio.src = './assets/audio/'+a+'.mp3';
        audio.play();
    }
};