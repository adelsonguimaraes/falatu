document.addEventListener('DOMContentLoaded', () => {
    const btnAcessar = document.getElementById('acessar');
    const inputAlias = document.querySelector('input[name=alias]');
    const inputSala = document.querySelector('input[name=sala]');

    btnAcessar.addEventListener('click', () => {
        const sala = inputSala.value;
        const alias = inputAlias.value;
        if (sala === '') return alert('Insira uma sala!');
        if (alias === '') return alert('Insira seu apelido!');

        // save the name room in storage
        sessionStorage.setItem('room', sala);
        sessionStorage.setItem('alias', alias);

        // redirecinando para página da sala
        const slug = sala.trim().replace(' ', '_');
        window.location.replace(`/room#${slug}`);
    });
});