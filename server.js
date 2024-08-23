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
        socket.join(room);
        rooms[room] = { players: [socket.username], drawer: null, guesser: null, word: null };
        socket.room = room;
    });

    socket.on('joinRoom', (room) => {
        if (rooms[room]) {
            socket.join(room);
            rooms[room].players.push(socket.username);
            socket.room = room;
            socket.emit('gameState', 'waiting');
        } else {
            socket.emit('roomNotFound');
        }
    });

    socket.on('ready', (data) => {
        if (rooms[data.room]) {
            if (data.isDrawer) {
                rooms[data.room].drawer = socket.username;
            } else {
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
                setTimeout(() => {
                    io.to(data.room).emit('gameState', 'start');
                }, 3000);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        if (socket.room && rooms[socket.room]) {
            rooms[socket.room].players = rooms[socket.room].players.filter(player => player !== socket.username);
            if (rooms[socket.room].players.length === 0) {
                delete rooms[socket.room];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));