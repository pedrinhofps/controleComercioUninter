const { app, BrowserWindow } = require('electron');
const path = require('path');

// Liga o backend
require('./server.js'); 

let mainWindow;

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        autoHideMenuBar: true, // Esconde menus (Arquivo, Editar, Exibir)
        icon: path.join(__dirname, 'public', 'favicon.ico') // Espaço para um icone
    });

    // Dá 1 segundo para o Express (server.js) respirar e ligar, e então carrega a tela
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
    }, 1000);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
});

// Encerra o servidor e o app quando o usuário clica no "X" para fechar a janela
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});