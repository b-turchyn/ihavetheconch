var socket;

document.addEventListener("DOMContentLoaded", function(event) {
  document.getElementById("nameform").addEventListener("submit", function(e) {
    e.preventDefault();

    socket = io.connect('http://whiskey:3000/');

    socket.on('connect', function() {
      console.log('sending name');
      socket.emit('name', document.getElementById('name').value);
    });

    socket.on('queue', function (data) {
      console.log(data);
    });

    socket.on('user-connect', function(data) {
      console.log(data);
    });
  });

  document.getElementById('hand-up').addEventListener('click', function() {
    socket.emit('hand-up');
  });

  document.getElementById('hand-down').addEventListener('click', function() {
    socket.emit('hand-down');
  });
});

