const socket = io();
let username = '';
let room = '';

const loginArea = document.getElementById('login-area');
const roomArea = document.getElementById('room-area');
const chatArea = document.getElementById('chat-area');
const roomHeader = document.getElementById('room-header');
const messageArea = document.getElementById('message-area');
const chatInput = document.getElementById('chat-input');
const sendChatButton = document.getElementById('send-chat');

function getIPs(callback) {
    let ip = { local: 'Unknown', public: 'Unknown' };
    
    // 获取局域网IP
    const RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    if (RTCPeerConnection) {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel("");
        pc.createOffer().then(pc.setLocalDescription.bind(pc));
        pc.onicecandidate = (ice) => {
            if (!ice || !ice.candidate || !ice.candidate.candidate) return;
            const match = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(ice.candidate.candidate);
            if (match) {
                ip.local = match[1];
            }
            pc.onicecandidate = null;
            getPublicIP();
        };
    } else {
        console.warn('无法获取局域网IP，RTCPeerConnection不可用');
        getPublicIP();
    }

    // 获取公网IP
    function getPublicIP() {
        fetch('https://api.ipify.org?format=json')
            .then(response => response.json())
            .then(data => {
                ip.public = data.ip;
                callback(ip);
            })
            .catch(error => {
                console.error('获取公网IP时出错:', error);
                callback(ip);
            });
    }
}

// 在连接建立后获取IP并发送给服务器
socket.on('connect', () => {
    getIPs((ips) => {
        console.log('获取到的IP:', ips);
        socket.emit('reportIP', ips);
    });
});

// 用户名输入和登录
document.getElementById('login-btn').addEventListener('click', () => {
    username = document.getElementById('username').value.trim();
    if (username) {
        socket.emit('login', username);
        loginArea.style.display = 'none';
        roomArea.style.display = 'flex';
    } else {
        alert('请输入用户名');
    }
});

// 创建房间
document.getElementById('create-room').addEventListener('click', () => {
    room = document.getElementById('room-name').value.trim();
    if (room) {
        socket.emit('createRoom', room);
    } else {
        alert('请输入房间名');
    }
});

// 加入房间
document.getElementById('join-room').addEventListener('click', () => {
    room = document.getElementById('room-name').value.trim();
    if (room) {
        socket.emit('joinRoom', room);
    } else {
        alert('请输入房间名');
    }
});

// 成功加入房间
socket.on('joinedRoom', (joinedRoom) => {
    room = joinedRoom;
    roomArea.style.display = 'none';
    chatArea.style.display = 'flex';
    roomHeader.textContent = `房间: ${room}`;
    addMessage('你加入了房间 ' + room, 'system');
});

// 新玩家加入
socket.on('playerJoined', (data) => {
    addMessage(`${data.username} 加入了房间`, 'system');
    addMessage(`当前用户: ${data.players.join(', ')}`, 'system');
});

// 玩家离开
socket.on('playerLeft', (data) => {
    addMessage(`${data.username} 离开了房间`, 'system');
    addMessage(`当前用户: ${data.players.join(', ')}`, 'system');
});

// 发送聊天消息
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
        addMessage(message, 'user');
    }
}

// 接收聊天消息
socket.on('chat', (data) => {
    if (data.username !== username) {
        addMessage(`${data.username}: ${data.message}`, 'other');
    }
});

// 添加消息到聊天区域
function addMessage(message, type) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    switch(type) {
        case 'system':
            messageElement.classList.add('system-message');
            messageElement.textContent = message;
            break;
        case 'user':
            messageElement.classList.add('user-message');
            messageElement.textContent = `你: ${message}`;
            break;
        case 'other':
            messageElement.classList.add('other-message');
            messageElement.textContent = message;
            break;
    }
    
    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}

// 房间不存在
socket.on('roomNotFound', () => {
    alert('房间不存在，请重新输入或创建新房间');
});

// 错误处理
socket.on('error', (errorMessage) => {
    alert('错误: ' + errorMessage);
});

// 断开连接
socket.on('disconnect', () => {
    addMessage('与服务器的连接已断开', 'system');
});

// 重新连接
socket.on('reconnect', () => {
    if (username && room) {
        socket.emit('rejoinRoom', { username, room });
    }
});

// 重新加入房间成功
socket.on('rejoinedRoom', () => {
    addMessage('重新连接成功', 'system');
});