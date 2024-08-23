const socket = io();
let username = '';
let room = '';

const loginArea = document.getElementById('login-area');
const roomArea = document.getElementById('room-area');
const chatArea = document.getElementById('chat-area');
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
    chatArea.style.display = 'block';
    addMessage('你加入了房间: ' + room);
});

socket.on('playerJoined', (data) => {
    addMessage(`${data.username} 加入了房间`);
    addMessage(`当前用户: ${data.players.join(', ')}`);
});

socket.on('playerLeft', (data) => {
    addMessage(`${data.username} 离开了房间`);
    addMessage(`当前用户: ${data.players.join(', ')}`);
});

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
        // 立即在本地显示消息，包括用户名
        addMessage(`${username}: ${message}`);
    }
}

socket.on('chat', (data) => {
    // 只有当消息不是自己发的时候才添加
    if (data.username !== username) {
        addMessage(`${data.username}: ${data.message}`);
    }
});

function addMessage(message) {
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}

socket.on('roomNotFound', () => {
    alert('房间不存在，请重新输入或创建新房间');
});