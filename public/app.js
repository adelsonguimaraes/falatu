document.addEventListener('DOMContentLoaded', () => {
    const btnAcessar = document.getElementById('acessar');
    const inputSala = document.querySelector('input[name=sala]');

    btnAcessar.addEventListener('click', () => {
        const sala = inputSala.value;
        if (sala === '') return alert('Insira uma sala!');

        // save the name room in storage
        sessionStorage.setItem('room', sala);

        // redirecinando para página da sala
        const slug = sala.trim().replace(' ', '_');
        window.location.replace(`/room#${slug}`);
    });
});