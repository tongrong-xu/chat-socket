const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require('path');
const port = process.env.PORT || "8080";

app.use(express.static(path.join(__dirname)));  //靜態路徑

const rooms = {};

app.get('/generate-room-code', (req, res) => {  //當前端fetch請求時 ，生成房間代碼
  const roomCode = generateRoomCode();
  rooms[roomCode] = {
    users: []
  };
  res.json({                                    //回傳代碼
    roomCode
  });
  console.log("code:", roomCode);
});

function generateRoomCode() {
  const roomCode = Math.floor(Math.random() * 10000).toString();
  return roomCode;
}

let users = [];

io.on('connection', function (socket) {
  let isNewPerson = true;
  let username = null;
  let roomCode = null;

  socket.on('login', function (data) {
    for (var i = 0; i < users.length; i++) {            //for迴圈確認有沒有相同名稱的人登入 ，如果是的話回傳flase，否的話回傳ture
      isNewPerson = users[i].username === data.username ? false : true;
    }
    if (isNewPerson) {
      username = data.username;
      roomCode = data.roomCode;
      const room = rooms[roomCode];
      if (room) {                                      // 如果是新的使用者，先確認房間存不存在
        users.push({
          username: data.username,
          roomCode: data.roomCode
        });
        room.users.push(data.username);                // 將新使用者的使用者名稱添加到該房間的使用者列表中
        data.userCount = room.users.length;            // 計算房間人數
        socket.join(roomCode);                         // 將用戶加入房間
        socket.emit('loginSuccess', data);
        io.sockets.in(roomCode).emit('add', data);     // 向房間內的所有用戶廣播加入消息
        console.log(data);
      } else {
        socket.emit('loginFail', '');
      }
    } else {
      socket.emit('loginFail', '');
    }
  });

  socket.on('logout', function () {                    // 監聽登出事件
    socket.emit('leaveSuccess');
    users = users.filter((val) => val.username !== username); // users[] 中過濾掉不是當前使用者名稱的使用者，並更新。
    const room = rooms[roomCode];
    if (room) {
      room.users = room.users.filter((val) => val !== username);// room 陣列中過濾掉不是當前使用者名稱的使用者，並更新。
      io.sockets.in(roomCode).emit('leave', {
        username: username,
        userCount: room.users.length,
      });
      socket.leave(roomCode); // 將用戶從房間中移除
    }
  });

  socket.on('sendMessage', function (data) {
    io.sockets.in(roomCode).emit('receiveMessage', data); // 向房間內的所有用戶傳播消息
  });
});

server.listen(port, () => {
  console.log('Server listening on port', port);
});