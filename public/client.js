const socket = io();
let username = '';
let room = '';
let isDrawer = false;
let currentWord = '';

const loginArea = document.getElementById('login-area');
const roomArea = document.getElementById('room-area');
const roleSelection = document.getElementById('role-selection');
const gameArea = document.getElementById('game-area');
const drawerControls = document.getElementById('drawer-controls');
const guesserControls = document.getElementById('guesser-controls');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

document.getElementById('login-btn').addEventListener('click', () => {
    username = document.getElementById('username').value;
    if (username) {
        socket.emit('login', username);
        loginArea.style.display = 'none';
        roomArea.style.display = 'block';
    }
});

document.getElementById('create-room').addEventListener('click', () => {
    room = document.getElementById('room-name').value;
    if (room) {
        socket.emit('createRoom', room);
        showRoleSelection();
    }
});

document.getElementById('join-room').addEventListener('click', () => {
    room = document.getElementById('room-name').value;
    if (room) {
        socket.emit('joinRoom', room);
    }
});

function showRoleSelection() {
    roomArea.style.display = 'none';
    roleSelection.style.display = 'block';
}

document.getElementById('choose-drawer').addEventListener('click', () => {
    isDrawer = true;
    startGame();
});

document.getElementById('choose-guesser').addEventListener('click', () => {
    isDrawer = false;
    startGame();
});

function startGame() {
    roleSelection.style.display = 'none';
    gameArea.style.display = 'block';
    if (isDrawer) {
        drawerControls.style.display = 'flex';
        initCanvas();
    } else {
        guesserControls.style.display = 'flex';
    }
    socket.emit('ready', { room, isDrawer });
}

function initCanvas() {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
}

let isDrawing = false;

function startDrawing(e) {
    isDrawing = true;
    draw(e);
}

function draw(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineWidth = document.getElementById('brush-size').value;
    ctx.lineCap = 'round';
    ctx.strokeStyle = document.getElementById('color-picker').value;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    socket.emit('draw', { room, x, y, color: ctx.strokeStyle, width: ctx.lineWidth });
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
}

socket.on('draw', (data) => {
    ctx.lineWidth = data.width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = data.color;
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
});

document.getElementById('clear-canvas').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clearCanvas', room);
});

socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

document.getElementById('submit-word').addEventListener('click', () => {
    currentWord = document.getElementById('word-input').value;
    if (currentWord) {
        socket.emit('newWord', { room, word: currentWord });
        document.getElementById('word-input').value = '';
    }
});

document.getElementById('submit-guess').addEventListener('click', () => {
    const guess = document.getElementById('guess-input').value;
    if (guess) {
        socket.emit('guess', { room, username, guess });
        document.getElementById('guess-input').value = '';
    }
});

socket.on('guessResult', (data) => {
    const messageArea = document.getElementById('message-area');
    if (data.correct) {
        messageArea.innerHTML += `<p>恭喜 ${data.username} 猜对了！正确答案是：${data.word}</p>`;
        if (!isDrawer) {
            alert('你猜对了！');
        }
        setTimeout(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 3000);
    } else {
        messageArea.innerHTML += `<p>${data.username} 猜测: ${data.guess} - 不正确</p>`;
    }
    messageArea.scrollTop = messageArea.scrollHeight;
});

socket.on('gameState', (state) => {
    const messageArea = document.getElementById('message-area');
    if (state === 'waiting') {
        messageArea.innerHTML += '<p>等待其他玩家...</p>';
    } else if (state === 'start') {
        messageArea.innerHTML += '<p>游戏开始！</p>';
        if (isDrawer) {
            alert('请输入一个词语并开始绘画');
        } else {
            alert('等待画家绘画，准备猜词');
        }
    }
    messageArea.scrollTop = messageArea.scrollHeight;
});

socket.on('roomNotFound', () => {
    alert('无此房间，请重新输入或创建新房间');
});