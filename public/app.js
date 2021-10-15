document.addEventListener('DOMContentLoaded', () => {
    const btnAcessar = document.getElementById('acessar');
    const btnCriar = document.getElementById('criar');
    const inputSala = document.querySelector('input[name=sala]');

    sessionStorage.removeItem('room');
    sessionStorage.removeItem('alias');
    sessionStorage.removeItem('create');

    inputSala.addEventListener('input', (e) => {
        const input = e.target.value.replace(/\D/gi, '');
        e.target.value = input;
        if (input.toString().length>=13){
            btnAcessar.style.backgroundColor = '#3D5081';
            btnAcessar.disabled = false;
        }else{
            btnAcessar.style.backgroundColor = '#5a73b3';
            btnAcessar.disabled = true;
        }
    });

    btnAcessar.addEventListener('click', () => {
        const sala = inputSala.value;
        if (sala === '') return alert('Insira um código de sala!');
        
        // save the name room in storage
        sessionStorage.setItem('room', sala);

        // redirecinando para página da sala
        const slug = sala.trim().replace(' ', '_');
        window.location.replace(`/room#${slug}`);
    });

    btnCriar.addEventListener('click', () => {
        const slug = Date.now();
        sessionStorage.setItem('create', slug);
        window.location.replace(`/room#${slug}`);
    });

    // chamando a splash
    splash.show();
});