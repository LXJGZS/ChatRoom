const express = require('express');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const rooms = {};

function getPublicIp(callback) {
    const services = [
        'https://api.ipify.org',
        'https://api.my-ip.io/ip',
        'https://ip.seeip.org'
    ];

    function tryNextService(index) {
        if (index >= services.length) {
            callback('无法获取公网IP');
            return;
        }

        https.get(services[index], (resp) => {
            let data = '';
            resp.on('data', (chunk) => {
                data += chunk;
            });
            resp.on('end', () => {
                if (data.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
                    callback(data.trim());
                } else {
                    tryNextService(index + 1);
                }
            });
        }).on("error", (err) => {
            console.log("Error: " + err.message);
            tryNextService(index + 1);
        });
    }

    tryNextService(0);
}

io.on('connection', (socket) => {
    getPublicIp((clientPublicIp) => {
        console.log(`用户已连接，公网IP地址: ${clientPublicIp}`);

        socket.on('login', (username) => {
            socket.username = username;
            console.log(`用户 ${username} 登录，公网IP地址: ${clientPublicIp}`);
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
            console.log(`用户 ${socket.username} 加入房间 ${room}，公网IP地址: ${clientPublicIp}`);
        }

        socket.on('chat', (data) => {
            io.to(data.room).emit('chat', {
                username: data.username,
                message: data.message
            });
        });

        socket.on('disconnect', () => {
            console.log(`用户已断开连接，公网IP地址: ${clientPublicIp}`);
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
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    getPublicIp((serverPublicIp) => {
        console.log(`服务器运行在端口 ${PORT}，公网IP地址: ${serverPublicIp}`);
    });
});