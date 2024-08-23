const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('login', (username) => {
        socket.username = username;
    });

    socket.on('createRoom', (room) => {
        if (!rooms[room]) {
            rooms[room] = { players: [], drawer: null, guesser: null, word: null };
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
    }

    socket.on('ready', (data) => {
        if (rooms[data.room]) {
            if (data.isDrawer && !rooms[data.room].drawer) {
                rooms[data.room].drawer = socket.username;
            } else if (!data.isDrawer && !rooms[data.room].guesser) {
                rooms[data.room].guesser = socket.username;
            }
            if (rooms[data.room].drawer && rooms[data.room].guesser) {
                io.to(data.room).emit('gameState', 'start');
            } else {
                socket.emit('gameState', 'waiting');
            }
        }
    });

    socket.on('draw', (data) => {
        socket.to(data.room).emit('draw', data);
    });

    socket.on('clearCanvas', (room) => {
        socket.to(room).emit('clearCanvas');
    });

    socket.on('newWord', (data) => {
        if (rooms[data.room]) {
            rooms[data.room].word = data.word;
            socket.to(data.room).emit('drawerReady');
        }
    });

    socket.on('guess', (data) => {
        if (rooms[data.room] && rooms[data.room].word) {
            const correct = data.guess.toLowerCase() === rooms[data.room].word.toLowerCase();
            io.to(data.room).emit('guessResult', {
                username: data.username,
                guess: data.guess,
                correct: correct,
                word: correct ? rooms[data.room].word : null
            });
            if (correct) {
                rooms[data.room].word = null;
                rooms[data.room].drawer = null;
                rooms[data.room].guesser = null;
                setTimeout(() => {
                    io.to(data.room).emit('gameState', 'newRound');
                }, 3000);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        if (socket.room && rooms[socket.room]) {
            rooms[socket.room].players = rooms[socket.room].players.filter(player => player !== socket.username);
            io.to(socket.room).emit('playerLeft', { username: socket.username, players: rooms[socket.room].players });
            if (rooms[socket.room].players.length === 0) {
                delete rooms[socket.room];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));