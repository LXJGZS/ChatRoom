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
const messageArea = document.getElementById('message-area');
const chatInput = document.getElementById('chat-input');
const sendChatButton = document.getElementById('send-chat');

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
    }
});

document.getElementById('join-room').addEventListener('click', () => {
    room = document.getElementById('room-name').value;
    if (room) {
        socket.emit('joinRoom', room);
    }
});

socket.on('joinedRoom', (joinedRoom) => {
    room = joinedRoom;
    roomArea.style.display = 'none';
    roleSelection.style.display = 'block';
});

socket.on('playerJoined', (data) => {
    addMessage(`${data.username} 加入了房间`);
    addMessage(`当前玩家: ${data.players.join(', ')}`);
});

socket.on('playerLeft', (data) => {
    addMessage(`${data.username} 离开了房间`);
    addMessage(`当前玩家: ${data.players.join(', ')}`);
});

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
        addMessage('你已选择词语，等待猜词者...');
    }
});

socket.on('drawerReady', () => {
    if (!isDrawer) {
        addMessage('画家已准备好，你可以开始猜词了！');
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
    if (data.correct) {
        addMessage(`恭喜 ${data.username} 猜对了！正确答案是：${data.word}`);
        if (!isDrawer) {
            alert('你猜对了！');
        }
        setTimeout(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 3000);
    } else {
        addMessage(`${data.username} 猜测: ${data.guess} - 不正确`);
    }
});

socket.on('gameState', (state) => {
    if (state === 'waiting') {
        addMessage('等待其他玩家...');
    } else if (state === 'start') {
        addMessage('游戏开始！');
        if (isDrawer) {
            alert('请输入一个词语并开始绘画');
        } else {
            alert('等待画家绘画，准备猜词');
        }
    } else if (state === 'newRound') {
        addMessage('新一轮开始！请重新选择角色。');
        gameArea.style.display = 'none';
        roleSelection.style.display = 'block';
        drawerControls.style.display = 'none';
        guesserControls.style.display = 'none';
    }
});

socket.on('roomNotFound', () => {
    alert('无此房间，请重新输入或创建新房间');
});

// 优化聊天功能
sendChatButton.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message) {
        socket.emit('chat', { room, username, message });
        chatInput.value = '';
        // 立即在本地显示消息
        addMessage(`<${username}>: ${message}`);
    }
}

socket.on('chat', (data) => {
    // 只显示来自其他用户的消息
    if (data.username !== username) {
        addMessage(`<${data.username}>: ${data.message}`);
    }
});

function addMessage(message) {
    const messageElement = document.createElement('p');
    messageElement.innerHTML = message;
    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}