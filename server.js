var app = require('./app');
var debug = require('debug')('conch:server');
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io')(server);
var db = require('./lib/database');

var clients = {};
var queue = [];
var conchHolder;

/**
 * Establish DB connectivity
 */
db.doInConn(function(conn, args, callback) {
  db.query(conn, 'DELETE FROM attendees')
    .then(result => debug('%d old attendees removed', result.results.affectedRows))
    .then(callback)
    .catch(result => callback(result));
});

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

io.on('connection', function(socket) {
  var name = socket.handshake.query['name'],
    channel = socket.handshake.query['room'],
    adminKey = socket.handshake.query['admin'],
    sid = socket.id;
  socket.join(channel);
  debug('%s (%s)  connected to %s', name, sid, channel);
  db.doInConn(function(conn, args, callback) {
    db.query(conn,
      "insert into attendees (name, channel_id, sid) VALUES (?, (SELECT id FROM channels WHERE user_key = ?), ?)",
      [name, channel, sid])
    .then(function(results) {
      io.to(channel).emit('user-connect', name);
    })
    .then(() => {
      return checkAdminStatus(conn, channel, adminKey)
    })
    .then((results) => {
      if (results.results.length > 0) {
        return makeAdmin(conn, channel, sid);
      } else {
        adminKey = null;
        return Promise.resolve();
      }
    })
    .then(() => {
      getChannelList(conn, channel)
        .then(sendChannelList);
    })
    .then(() => {
      return getQueue([conn, channel])
    })
    .then(broadcastQueue)
    .then(() => {
      return getConchHolder([conn, channel])
    })
    .then((result) => {
      socket.emit('conch-holder', result);
    })
    .then(function() {
      callback();
    });
  });

  socket.on('disconnect', function(data) {
    debug('%s (%s) disconnected from %s', name, sid, channel);
    db.doInConn(function(conn, args, callback) {
      getConchHolder([conn, channel])
        .then((result) => {
          console.log(result);
          if (result.length > 0 && result[0] == sid) {
            return deleteCurrentConchHolder(conn, channel)
              .then(passConchToUser)
              .then(getConchHolder)
              .then(function(result) {
                io.to(channel).emit('conch-holder', result);
              }).then(function() {
                return getQueue([conn, channel]);
              }).then(broadcastQueue);
          }
        })
        .then(() => {
          db.query(conn, "DELETE FROM attendees WHERE sid = ?", [sid])
        })
        .then(function() {
          io.to(channel).emit('user-disconnect', name);
        })
        .then(function() {
          return getChannelList(conn, channel);
        })
        .then(sendChannelList)
        .then(function() {
          return getQueue([conn, channel])
        })
        .then(broadcastQueue)
        // TODO: conch holder changes?
        .then(function() {
          callback()
        })
        .catch(callback);
      
    });
  });

  socket.on('hand-up', function() {
    debug('%s raised hand in %s', name, channel);
    db.doInConn(function(conn, args, callback) {
      addToQueue(conn, sid, channel)
        .then(getQueue)
        .then(broadcastQueue)
        .then(callback)
        .catch(callback);
    });
  });

  socket.on('hand-down', function() {
    debug('%s lowered hand in %s', name, channel);
    db.doInConn(function(conn, args, callback) {
      getConchHolder([conn, channel])
        .then((result) => {
          console.log(result);
          if (result.length > 0 && result[0] == sid) {
            return deleteCurrentConchHolder(conn, channel)
              .then(passConchToUser)
              .then(getConchHolder)
              .then(function(result) {
                io.to(channel).emit('conch-holder', result);
              }).then(function() {
                return getQueue([conn, channel]);
              }).then(broadcastQueue);
          }
        })
        .then(() => {
          return removeFromQueue(conn, sid, channel);
        })
        .then(getQueue)
        .then(broadcastQueue)
        .then(callback)
        .catch(callback);
    });
  });

  if (adminKey != null) {
    socket.on('pass-conch', function() {
      passConch(socket, channel);
    });
  }
});

var passConch = function (socket, channel) {
  debug('Conch passed in %s', channel);
  db.doInConn(function(conn, args, callback) {
    Promise.all([
      deleteCurrentConchHolder(conn, channel)
        .then(passConchToUser)
        .then(getConchHolder)
        .then(function(result) {
          io.to(channel).emit('conch-holder', result);
        }).then(function() {
          return getQueue([conn, channel]);
        }).then(broadcastQueue)
        .catch(function(error) {
          callback(error);
        })
    ]).then(function() {
      callback();
    });
  });
};

function deleteCurrentConchHolder(conn, channel) {
  return new Promise(function(resolve, reject) {
    conn.query("DELETE FROM queue WHERE start_time IS NOT NULL AND attendee_id IN (SELECT a.id FROM attendees a INNER JOIN channels c ON c.id = a.channel_id AND c.user_key = ?)",
      [channel],
      function(error, results, fields) {
        if (error) {
          reject(error);
        } else {
          resolve([conn, channel]);
        }
      });
  });
}

function passConchToUser(args) {
  var conn = args[0],
      channel = args[1];
  return new Promise(function(resolve, reject) {
    conn.query("UPDATE queue q SET start_time = ? WHERE attendee_id IN (SELECT a.id FROM attendees a INNER JOIN channels c ON c.id = a.channel_id AND c.user_key = ?) ORDER BY q.id LIMIT 1",
      [Math.floor(new Date().getTime() / 1000), channel],
      function(error, results, fields) {
        if (error) {
          reject(error);
        } else {
          resolve([conn, channel]);
        }
      }
    );
  });
}

function getConchHolder(args) {
  var conn = args[0],
      channel = args[1];
  return new Promise(function(resolve, reject) {
    conn.query("SELECT q.*, a.sid FROM queue q INNER JOIN attendees a ON a.id = q.attendee_id INNER JOIN channels c ON c.id = a.channel_id WHERE c.user_key = ? AND q.start_time IS NOT NULL ORDER BY q.id ASC LIMIT 0, 1",
      [channel],
      function(error, results, fields) {
        if (error) {
          reject(error);
        } else {
          var result = [null, 0];
          if (!error && results.length) {
            result = [results[0]['sid'], results[0]['start_time']];
          }
          resolve(result);
        }
      }
    );
  });
}

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

function getChannelList(conn, channel) {
  return new Promise(function(resolve, reject) {
    conn.query("SELECT a.name, a.sid, a.admin FROM channels c INNER JOIN attendees a ON a.channel_id = c.id WHERE c.user_key = ? ORDER BY name ASC",
      [channel],
      function(error, results, fields) {
        if (error) {
          reject(error);
        } else {
          var clients = {};
          results.forEach(function(result) {
            clients[result['sid']] = {
              name: result['name'],
              admin: result['admin'] == 1
            };
          });
          resolve([channel, clients]);
        }
      }
    );
  });
}

function sendChannelList(args) {
  var channel = args[0],
      clients = args[1];
  return new Promise(function(resolve, reject) {
    io.to(channel).emit('clients', clients);
    resolve(args);
  });
}

function addToQueue(conn, sid, channel) {
  return new Promise(function(resolve, reject) {
    conn.query("INSERT INTO queue (attendee_id) (select a.id FROM attendees a WHERE a.sid = ? AND NOT EXISTS (select 1 FROM queue q WHERE a.id = q.attendee_id));",
      [sid],
      function(error, results, fields) {
        if (error) {
          reject(error);
        } else {
          resolve([conn, channel]);
        }
      }
    );
  });
}

function removeFromQueue(conn, sid, channel) {
  return new Promise(function(resolve, reject) {
    conn.query("DELETE FROM queue WHERE attendee_id = (select a.id FROM attendees a INNER JOIN channels c ON c.id = a.channel_id WHERE a.sid = ? AND c.user_key = ?);",
      [sid, channel],
      function(error, results, fields) {
        if (error) {
          reject(error);
        } else {
          resolve([conn, channel]);
        }
      }
    );
  });
}

function broadcastQueue(args) {
  var channel = args[0],
      queue = args[1];
  return new Promise(function(resolve, reject) {
    io.to(channel).emit('queue', queue);
    resolve();
  });
}

function getQueue(args) {
  var conn = args[0],
      channel = args[1];
  return new Promise(function(resolve, reject) {
    conn.query("SELECT a.sid FROM channels c INNER JOIN attendees a ON a.channel_id = c.id INNER JOIN queue q ON q.attendee_id = a.id WHERE c.user_key = ? AND q.start_time IS NULL ORDER BY q.id ASC",
      [channel],
      function(error, results, fields) {
        if (error) {
          reject(error);
        } else {
          resolve([channel, results.map(function(sid) { return sid['sid'] })]);
        }
      }
    );
  });
}

function checkAdminStatus(conn, channel, adminKey) {
  return db.query(conn, "SELECT 1 FROM channels WHERE user_key = ? AND admin_key = ? LIMIT 0, 1", [channel, adminKey]);
}

function makeAdmin(conn, channel, sid) {
  return db.query(conn, "UPDATE attendees SET admin = true WHERE channel_id = (SELECT channel_id FROM channels WHERE user_key = ?) AND sid = ?", [channel, sid]);
}
