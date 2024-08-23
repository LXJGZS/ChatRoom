const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const publicIp = require('public-ip');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const rooms = {};

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '0.0.0.0';
}

const localIp = getLocalIp();

io.on('connection', async (socket) => {
    const clientPublicIp = await publicIp.v4();
    console.log(`用户已连接，局域网IP地址: ${localIp}, 公网IP地址: ${clientPublicIp}`);

    socket.on('login', (username) => {
        socket.username = username;
        console.log(`用户 ${username} 登录，局域网IP地址: ${localIp}, 公网IP地址: ${clientPublicIp}`);
    });

    socket.on('createRoom', (room) => {
        if (!rooms[room]) {
            rooms[room] = { players: [] };
        }
        joinRoom(socket, room);
    });

    socket.on('joinRoom', (room) => {
        if (rooms[room]) {
            joinRoom(socket, room);
        } else {
            socket.emit('roomNotFound');
        }
    });

    function joinRoom(socket, room) {
        socket.join(room);
        if (!rooms[room].players.includes(socket.username)) {
            rooms[room].players.push(socket.username);
        }
        socket.room = room;
        io.to(room).emit('playerJoined', { username: socket.username, players: rooms[room].players });
        socket.emit('joinedRoom', room);
        console.log(`用户 ${socket.username} 加入房间 ${room}，局域网IP地址: ${localIp}, 公网IP地址: ${clientPublicIp}`);
    }

    socket.on('chat', (data) => {
        io.to(data.room).emit('chat', {
            username: data.username,
            message: data.message
        });
    });

    socket.on('disconnect', () => {
        console.log(`用户已断开连接，局域网IP地址: ${localIp}, 公网IP地址: ${clientPublicIp}`);
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
            joinRoom(socket, data.room);
            socket.emit('rejoinedRoom');
        } else {
            socket.emit('roomNotFound');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    const serverPublicIp = await publicIp.v4();
    console.log(`服务器运行在端口 ${PORT}，局域网IP地址: ${localIp}, 公网IP地址: ${serverPublicIp}`);
});