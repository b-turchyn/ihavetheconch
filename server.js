var app = require('./app');
var debug = require('debug')('demo:server');
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io')(server);

var clients = {};
var queue = [];
var conchHolder;
var startTime;

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

io
  .of('/')
  .on('connection', function(socket) {
    socket.on('disconnect', function(data) {
      delete clients[socket.id];
      var index = queue.indexOf(socket.id);
      if (index > -1) {
        queue = queue.splice(index, 1);
      }
      socket.broadcast.emit('clients', clients);
      socket.broadcast.emit('queue', queue);
    });

    socket.on('name', function(data) {
      clients[socket.id] = { 'name': data };
      socket.broadcast.emit('user-connect', data);
      socket.emit('clients', clients);
      socket.broadcast.emit('clients', clients);
      socket.emit('queue', queue);
      if (conchHolder != null) {
        socket.emit('conch-holder', conchHolder);
      }
    });

    socket.on('hand-up', function() {
      if (queue.indexOf(socket.id) < 0) {
        queue.push(socket.id);
        socket.emit('queue', queue);
        socket.broadcast.emit('queue', queue);
      }
    });

    socket.on('hand-down', function() {
      var index = queue.indexOf(socket.id);
      if (index > -1) {
        queue = queue.splice(index, 1);
      }
      socket.emit('queue', queue);
      socket.broadcast.emit('queue', queue);
    });

    socket.on('pass-conch', function() {
      if (queue.length > 0) {
        var next = queue[0];
        queue = queue.splice(1);
        conchHolder = [next, new Date().getTime()]
        socket.emit('conch-holder', conchHolder);
        socket.broadcast.emit('conch-holder', conchHolder);
        socket.emit('queue', queue);
        socket.broadcast.emit('queue', queue);
      }
    });

  }).on('*', function(data) {
  console.log(data);
}).on('name', function (data) {
  console.log('name got sent');
  console.log(data);
}).on('hand-up', function (data) {
  console.log('hand went up');
}).on('hand-down', function (data) {
  console.log('hand went down');
});


/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
