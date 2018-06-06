var socket;
var users = {};
var conchHolder;

document.addEventListener("DOMContentLoaded", function(event) {
  if (typeof Notification === "undefined") {
    alert('Desktop notifications not available in your browser. Try Chrome or Firefox.');
  } else if (Notification.permission !== "granted") {
    Notification.requestPermission();
  }

  document.getElementById('user-key').addEventListener('focus', function() {
    document.getElementById('user-key').setSelectionRange(0, 1000);
  });

  if (document.getElementById('admin-key') !== null) {
    document.getElementById('admin-key').addEventListener('focus', function() {
      document.getElementById('admin-key').setSelectionRange(0, 1000);
    });
  }

  document.getElementById("nameform").addEventListener("submit", function(e) {
    e.preventDefault();

    if (socket && socket.connected) {
      socket.close();
      return;
    }

    var query = {
      name: document.getElementById('name').value,
      room: window.location.pathname.substr(window.location.pathname.lastIndexOf("/") + 1)
    };
    if (getCookie(query['room']).length > 0) {
      query['admin'] = getCookie(query['room']);
    }

    socket = io({ query: query });

    socket.on('connect', function() {
      document.getElementById('hand-up').disabled = false;
      document.getElementById('hand-down').disabled = false;
      if (document.getElementById('pass-conch') !== null) {
        document.getElementById('pass-conch').disabled = false;
      }
      document.getElementById('other-actions').disabled = false;

      document.getElementById('connect').parentElement.classList.add("d-none");
      document.getElementById('connect').disabled = true;
      document.getElementById('disconnect').parentElement.classList.remove("d-none");
      document.getElementById('disconnect').disabled = false;
      document.getElementById('name').disabled = true;
    });

    socket.on('disconnect', function() {
      document.getElementById('hand-up').disabled = true;
      document.getElementById('hand-down').disabled = true;
      if (document.getElementById('pass-conch') !== null) {
        document.getElementById('pass-conch').disabled = true;
      }
      document.getElementById('other-actions').disabled = true;

      document.getElementById('disconnect').parentElement.classList.add("d-none");
      document.getElementById('disconnect').disabled = true;
      document.getElementById('connect').parentElement.classList.remove("d-none");
      document.getElementById('connect').disabled = false;
      document.getElementById('name').disabled = false;
    });

    socket.on('queue', function (data) {
      var queued = conchHolder === socket.id;
      $(".queue").html("");
      data.forEach(function (user) {
        if (user === socket.id) {
          document.getElementById('hand-up').parentElement.classList.add('d-none');
          document.getElementById('hand-down').parentElement.classList.remove('d-none');
          queued = true;
        }
        $("<li>").html(users[user]['name']).appendTo($(".queue"));
      });
      if (!queued) {
        document.getElementById('hand-up').parentElement.classList.remove('d-none');
        document.getElementById('hand-down').parentElement.classList.add('d-none');
      }
    });

    socket.on('user-connect', function(data) {
      console.log(data);
    });

    socket.on('clients', function(clients) {
      users = clients;

      $(".users").html("");
      Object.keys(clients).forEach(function (user) {
        var item = $("<li>").html(users[user]['name']);
        if (users[user]['admin']) {
          item.prepend("<i class='fa fa-crown mr-1'>");
        }
        item.appendTo($(".users"));
      });
    });

    socket.on('conch-holder', function(data) {
      timer.stopTimer();
      if (data != null && data.length == 2 && data[0] !== null) {
        conchHolder = data[0];
        if (socket.id === data[0]) {
          notify("The conch has been passed to you! It's your turn to talk!");
        }
        $(".conch-holder").html(users[data[0]]['name']);
        timer.startTimer(data[1]);
      } else {
        $(".conch-holder").html("<em>None</em>");
        conchHolder = null;
      }
    });

    socket.on('delete-channel', function() {
      notify("Channel closed");
      document.location = "/";
    });
  });

  document.getElementById('hand-up').addEventListener('click', function() {
    socket.emit('hand-up');
  });

  document.getElementById('hand-down').addEventListener('click', function() {
    socket.emit('hand-down');
  });

  if (document.getElementById('pass-conch') !== null) {
    document.getElementById('pass-conch').addEventListener('click', function() {
      socket.emit('pass-conch');
    });
  }

  if (document.getElementById('add-all') !== null) {
    document.getElementById('add-all').addEventListener('click', function(e) {
      e.preventDefault();
      socket.emit('add-all');
    });
  }

  if (document.getElementById('remove-all') !== null) {
    document.getElementById('remove-all').addEventListener('click', function(e) {
      e.preventDefault();
      socket.emit('remove-all');
    });
  }

  if (document.getElementById('delete-channel') !== null) {
    document.getElementById('delete-channel').addEventListener('click', function(e) {
      e.preventDefault();
      if (confirm("Are you sure? This can not be reversed!")) {
        socket.emit('delete-channel');
      }
    });
  }
});

var timer = {
  startTime: null,
  timerInterval: null,
  startTimer: function(time) {
    timer.startTime = time;
    timer.timerInterval = setInterval(function () {
      var time = Math.floor(new Date().getTime() / 1000) - timer.startTime;
      $(".timer").html(" - " + getTimeDisplay(time));
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
  if (typeof Notification !== "undefined" ) {
    if (Notification.permission !== 'granted') {
      Notification.requestPermission()
    } else {
      var notification = new Notification('Conch - ' + document.getElementsByTagName('title')[0].text, {
        icon: "https://i.imgur.com/loZX7YP.png",
        body: msg
      });
    }
  }
};

function getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i <ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}
