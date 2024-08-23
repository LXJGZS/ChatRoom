const express = require('express');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const rooms = {};

function getClientIp(socket) {
    const ipAddress = socket.handshake.headers['x-forwarded-for'] || 
                      socket.handshake.headers['x-real-ip'] ||
                      socket.handshake.address;
    
    // 如果是 IPv6 格式，我们只取 IPv4 部分
    return ipAddress.split(',')[0].trim().replace(/^::ffff:/, '');
}

function verifyIpFormat(ip) {
    // 简单的 IPv4 格式验证
    return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
}

function getPublicIp(callback) {
    https.get('https://api.ipify.org?format=json', (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
            data += chunk;
        });
        resp.on('end', () => {
            try {
                const ip = JSON.parse(data).ip;
                callback(null, ip);
            } catch (error) {
                callback(error, null);
            }
        });
    }).on("error", (err) => {
        callback(err, null);
    });
}

io.on('connection', (socket) => {
    let clientIp = getClientIp(socket);

    if (!verifyIpFormat(clientIp) || clientIp === '127.0.0.1' || clientIp === '::1') {
        getPublicIp((err, ip) => {
            clientIp = err ? "无法获取IP" : ip;
            handleConnection(socket, clientIp);
        });
    } else {
        handleConnection(socket, clientIp);
    }
});

function handleConnection(socket, clientIp) {
    console.log(`用户已连接，公网IP地址: ${clientIp}`);

    socket.on('login', (username) => {
        socket.username = username;
        console.log(`用户 ${username} 登录，公网IP地址: ${clientIp}`);
    });

    socket.on('createRoom', (room) => {
        if (!rooms[room]) {
            rooms[room] = { players: [] };
        }
        joinRoom(socket, room, clientIp);
    });

    socket.on('joinRoom', (room) => {
        if (rooms[room]) {
            joinRoom(socket, room, clientIp);
        } else {
            socket.emit('roomNotFound');
        }
    });

    function joinRoom(socket, room, ip) {
        socket.join(room);
        if (!rooms[room].players.includes(socket.username)) {
            rooms[room].players.push(socket.username);
        }
        socket.room = room;
        io.to(room).emit('playerJoined', { username: socket.username, players: rooms[room].players });
        socket.emit('joinedRoom', room);
        console.log(`用户 ${socket.username} 加入房间 ${room}，公网IP地址: ${ip}`);
    }

    socket.on('chat', (data) => {
        io.to(data.room).emit('chat', {
            username: data.username,
            message: data.message
        });
    });

    socket.on('disconnect', () => {
        console.log(`用户已断开连接，公网IP地址: ${clientIp}`);
        if (socket.room && rooms[socket.room]) {
            rooms[socket.room].players = rooms[socket.room].players.filter(player => player !== socket.username);
            io.to(socket.room).emit('playerLeft', { username: socket.username, players: rooms[socket.room].players });
            if (rooms[socket.room].players.length === 0) {
                delete rooms[socket.room];
            }
        }
    });

    socket.on('rejoinRoom', (data) => {
        if (rooms[data.room]) {
            socket.username = data.username;
            joinRoom(socket, data.room, clientIp);
            socket.emit('rejoinedRoom');
        } else {
            socket.emit('roomNotFound');
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});