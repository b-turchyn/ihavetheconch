var socket;
var users = {};

document.addEventListener("DOMContentLoaded", function(event) {
  if (!Notification) {
    alert('Desktop notifications not available in your browser. Try Chromium.');
  }
  if (Notification.permission !== "granted") {
    Notification.requestPermission();
  }

  document.getElementById("nameform").addEventListener("submit", function(e) {
    e.preventDefault();

    socket = io({
      query: {
        name: document.getElementById('name').value,
        room: window.location.pathname.substr(window.location.pathname.lastIndexOf("/") + 1)
      }
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
      timer.stopTimer();
      if (data != null && data.length == 2 && data[0] !== null) {
        if (socket.id === data[0]) {
          notify();
        }
        $(".conch-holder").html(users[data[0]]['name']);
        timer.startTimer(data[1]);
      } else {
        $(".conch-holder").html("");
      }
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
      var time = Math.floor(new Date().getTime() / 1000) - timer.startTime;
      $(".timer").html(getTimeDisplay(time));
    }, 100);
  },
  stopTimer: function() {
    clearInterval(timer.timerInterval);
    timer.timerInterval = null;
    $(".timer").html("");
  }
};

var formatTimeSegment = function (number) {
  return String("00" + number).slice(-2);
}

function getTimeDisplay(time) {
  var i = 0;
  var segments = [0,0];

  while((Math.floor(time / Math.pow(60, i)) > 0) || i == 0) {
    segments[i] = Math.floor(time / Math.pow(60, i)) % 60;
    i++;
  }

  return segments.reverse().map(formatTimeSegment).join(":");
}

var notify = function(msg) {
  if (Notification.permission !== 'granted') {
    Notification.requestPermission()
  } else {
    var notification = new Notification('Conch - ' + document.getElementsByTagName('title')[0].text, {
      icon: "https://i.imgur.com/loZX7YP.png",
      body: "The conch has been passed to you! It's your turn to talk!"
    });
  }
};
