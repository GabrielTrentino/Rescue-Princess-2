// Ponto de entrada: apenas cria o jogo. Toda a lógica vive nos módulos.
import { Game } from './core/Game.js';

const game = new Game(document.getElementById('app'));
game.start();

// Acesso ao jogo pelo console do navegador para depuração: abra index.html?debug
if (new URLSearchParams(location.search).has('debug')) window.game = game;
