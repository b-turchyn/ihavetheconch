var socket;
var users = {};
var conchHolder;
var conchPrefs = {
  rememberName: true,
  notifyConchPass: "me"
};
var audio;

document.addEventListener("DOMContentLoaded", function(event) {
  loadPreferences();
  // Hook preferences
  if (getId('pref-remember-name') != null) {
    getId('pref-remember-name').addEventListener('click', changeRememberName);
    changeRememberName.apply(getId('pref-remember-name'));
  }
  if (getId('pref-conch-pass') != null) {
    getId('pref-conch-pass').addEventListener('change', changeConchNotify);
    changeConchNotify.apply(getId('pref-conch-pass'));
  }
  if (getId('pref-conch-vibrate') != null) {
    getId('pref-conch-vibrate').addEventListener('change', changeConchVibrate);
    changeConchVibrate.apply(getId('pref-conch-vibrate'));
  }
  if (getId('pref-sound-notify') != null) {
    getId('pref-sound-notify').addEventListener('click', changeNotifySound);
    changeNotifySound.apply(getId('pref-sound-notify'));
  }

  if (typeof Notification === "undefined") {
    alert('Desktop notifications not available in your browser. Try Chrome or Firefox.');
  } else if (Notification.permission !== "granted") {
    Notification.requestPermission();
  }
  if (typeof Audio !== "undefined") {
    audio = new Audio("/audio/notification.mp3");
  }

  getId('user-key').addEventListener('focus', function() {
    getId('user-key').setSelectionRange(0, 1000);
  });

  if (getId('admin-key') !== null) {
    getId('admin-key').addEventListener('focus', function() {
      getId('admin-key').setSelectionRange(0, 1000);
    });
  }

  getId("nameform").addEventListener("submit", function(e) {
    e.preventDefault();

    if (socket && socket.connected) {
      socket.close();
      return;
    }

    var query = {
      name: getId('name').value,
      room: window.location.pathname.substr(window.location.pathname.lastIndexOf("/") + 1)
    };
    if (getCookie(query['room']).length > 0) {
      query['admin'] = getCookie(query['room']);
    }

    socket = io({ query: query });

    socket.on('connect', function() {
      getId('hand-up').disabled = false;
      getId('hand-down').disabled = false;
      if (getId('pass-conch') !== null) {
        getId('pass-conch').disabled = false;
      }
      if (getId('other-actions') !== null) {
        getId('other-actions').disabled = false;
      }

      getId('connect').parentElement.classList.add("d-none");
      getId('connect').disabled = true;
      getId('disconnect').parentElement.classList.remove("d-none");
      getId('disconnect').disabled = false;
      getId('name').disabled = true;
    });

    socket.on('disconnect', function() {
      getId('hand-up').disabled = true;
      getId('hand-down').disabled = true;
      if (getId('pass-conch') !== null) {
        getId('pass-conch').disabled = true;
      }
      if (getId('other-actions') !== null) {
        getId('other-actions').disabled = true;
      }

      getId('disconnect').parentElement.classList.add("d-none");
      getId('disconnect').disabled = true;
      getId('connect').parentElement.classList.remove("d-none");
      getId('connect').disabled = false;
      getId('name').disabled = false;
    });

    socket.on('queue', function (data) {
      var queued = conchHolder === socket.id;
      $(".queue").html("");
      data.forEach(function (user) {
        if (user === socket.id) {
          getId('hand-up').parentElement.classList.add('d-none');
          getId('hand-down').parentElement.classList.remove('d-none');
          queued = true;
        }
        $("<li>").html(users[user]['name']).appendTo($(".queue"));
      });
      if (!queued) {
        getId('hand-up').parentElement.classList.remove('d-none');
        getId('hand-down').parentElement.classList.add('d-none');
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
        if ((conchPrefs.notifyConchPass === "all" || conchPrefs.notifyConchPass === "me") && socket.id === data[0]) {
          notify("The conch has been passed to you! It's your turn to talk!");
        } else if (conchPrefs.notifyConchPass === "all") {
          notify(users[data[0]].name + " has the conch!");
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

  getId('hand-up').addEventListener('click', function() {
    socket.emit('hand-up');
  });

  getId('hand-down').addEventListener('click', function() {
    socket.emit('hand-down');
  });

  if (getId('pass-conch') !== null) {
    getId('pass-conch').addEventListener('click', function() {
      socket.emit('pass-conch');
    });
  }

  if (getId('add-all') !== null) {
    getId('add-all').addEventListener('click', function(e) {
      e.preventDefault();
      socket.emit('add-all');
    });
  }

  if (getId('remove-all') !== null) {
    getId('remove-all').addEventListener('click', function(e) {
      e.preventDefault();
      socket.emit('remove-all');
    });
  }

  if (getId('delete-channel') !== null) {
    getId('delete-channel').addEventListener('click', function(e) {
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
        body: msg,
        vibrate: conchPrefs.notifyConchVibrate
      });
      if (typeof Audio !== "undefined" && conchPrefs.notifySound) {
        audio.play();
      }
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

function createCookie(name, value, days) {
  var expires;
  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toGMTString();
  }
  else {
    expires = "";
  }
  document.cookie = name + "=" + value + expires + "; path=/";
}

function getId(id) {
  return document.getElementById(id);
}

function loadPreferences() {
  conchPrefs = JSON.parse(getCookie("preferences") || "{}");

  // Defaults
  conchPrefs.name = conchPrefs.name || "";
  conchPrefs.rememberName = conchPrefs.rememberName !== undefined ? conchPrefs.rememberName : true;
  conchPrefs.notifyConchPass = conchPrefs.notifyConchPass || "me";
  conchPrefs.notifyConchVibrate = conchPrefs.notifyConchVibrate || "me";
  conchPrefs.notifySound = conchPrefs.notifySound !== undefined ? conchPrefs.notifySound : true;

  getId("pref-remember-name").checked = conchPrefs.rememberName;
  if (conchPrefs.rememberName) {
    getId('name').value = conchPrefs.name || "";
  }
  getId("pref-conch-pass").value = conchPrefs.notifyConchPass;
  getId("pref-conch-vibrate").value = conchPrefs.notifyConchVibrate;
}

function savePreferences() {
  createCookie("preferences", JSON.stringify(conchPrefs), 365);
}

function changeRememberName(e) {
  conchPrefs.rememberName = this.checked;
  if (this.checked) {
    getId('name').addEventListener('change', changeName);
  } else {
    getId('name').removeEventListener('change', changeName);
  }
  savePreferences();
}

function changeNotifySound(e) {
  conchPrefs.notifySound = this.checked;
  savePreferences();
}

function changeConchNotify(e) {
  conchPrefs.notifyConchPass = this.value;
  savePreferences();
}

function changeConchVibrate(e) {
  conchPrefs.notifyConchVibrate = this.value;
  savePreferences();
}

function changeName(e) {
  conchPrefs.name = getId('name').value;
  savePreferences();
}

