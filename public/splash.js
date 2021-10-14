const splash = {
    show() {
        const splash = document.createElement('div');
        splash.classList.add('splash');
        document.body.appendChild(splash);

        setTimeout(() => {
            splash.remove();
        }, [3000]);
    }
}