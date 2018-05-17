var socket;
var users = {};

document.addEventListener("DOMContentLoaded", function(event) {
  document.getElementById("nameform").addEventListener("submit", function(e) {
    e.preventDefault();

    socket = io.connect('/');

    socket.on('connect', function() {
      console.log('sending name');
      socket.emit('name', document.getElementById('name').value);
    });

    socket.on('queue', function (data) {
      $(".queue").html("");
      data.forEach(function (user) {
        $("<li>").html(users[user]['name']).appendTo($(".queue"));
      });
    });

    socket.on('user-connect', function(data) {
      console.log(data);
    });

    socket.on('clients', function(clients) {
      users = clients;

      $(".users").html("");
      Object.keys(clients).forEach(function (user) {
        $("<li>").html(users[user]['name']).appendTo($(".users"));
      });
    });

    socket.on('conch-holder', function(data) {
      $(".conch-holder").html(users[data[0]]['name']);
      timer.stopTimer();
      timer.startTimer(data[1]);
    });
  });

  document.getElementById('hand-up').addEventListener('click', function() {
    socket.emit('hand-up');
  });

  document.getElementById('hand-down').addEventListener('click', function() {
    socket.emit('hand-down');
  });

  document.getElementById('pass-conch').addEventListener('click', function() {
    socket.emit('pass-conch');
  });
});

var timer = {
  startTime: null,
  timerInterval: null,
  startTimer: function(time) {
    timer.startTime = time;
    timer.timerInterval = setInterval(function () {
      var time = new Date().getTime() - timer.startTime;
      $(".timer").html(Math.floor(time / 100) / 10);
    }, 100);
  },
  stopTimer: function() {
    clearInterval(timer.timerInterval);
    timer.timerInterval = null;
  }
};
