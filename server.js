var app = require('./app');
var debug = require('debug')('demo:server');
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io')(server);
var db = require('./lib/database');

var clients = {};
var queue = [];
var conchHolder;
var startTime;

/**
 * Establish DB connectivity
 */
db.doInConn(function(conn, args, callback) {
  conn.query('select 1 from channels', function (error, results, fields) {
    callback(error);
  });
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

io
  .on('connection', function(socket) {
    var name = socket.handshake.query['name'],
        channel = socket.handshake.query['room'],
        sid = socket.id;
    socket.join(channel);
    console.log(sid + " connected to " + channel);
    db.doInConn(function(conn, args, callback) {
      conn.query("insert into attendees (name, channel_id, sid) VALUES (?, (SELECT id FROM channels WHERE user_key = ?), ?)",
        [name, channel, sid],
        function(error, results, fields) {
          if (!error) {
            io.to(channel).emit('user-connect', name);
            sendChannelList(conn, channel, callback);
            getQueue(conn, channel, function(error, result) {
              if (!error) {
                socket.emit('queue', result);
              }
            });
            /*
            io.to(channel).emit('queue', queue);
            if (conchHolder != null) {
              socket.emit('conch-holder', conchHolder);
            }
            //*/
          } else {
            callback(error);
          }
        });
    });
    socket.on('disconnect', function(data) {
      console.log(sid + " disconnected from " + channel);
      db.doInConn(function(conn, args, callback) {
        conn.query("DELETE FROM attendees WHERE sid = ?", [sid], function(error, results, fields) {
          if (!error) {
            io.to(channel).emit('user-disconnect', name);
            sendChannelList(conn, channel, callback);
          }
        });
      });
      delete clients[socket.id];
      var index = queue.indexOf(socket.id);
      if (index > -1) {
        queue = queue.splice(index, 1);
      }
      socket.broadcast.emit('clients', clients);
      socket.broadcast.emit('queue', queue);
      if (conchHolder != null && conchHolder[0] === socket.id) {
        console.log("passing conch from disconnect");
        passConch(socket);
      }
    });

    socket.on('name', function(data) {
      clients[socket.id] = { 'name': data };
    });

    socket.on('hand-up', function() {
      db.doInConn(function(conn, args, callback) {
        addToQueue(conn, sid, channel, function(error) {
          if (!error) {
            sendQueue(conn, channel, callback);
          } else {
            callback(error);
          }
        });
      });
    });

    socket.on('hand-down', function() {
      db.doInConn(function(conn, args, callback) {
        removeFromQueue(conn, sid, channel, function(error) {
          if (!error) {
            sendQueue(conn, channel, callback);
          } else {
            callback(error);
          }
        });
      });
    });

    socket.on('pass-conch', function() {
      passConch(socket, channel);
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

var passConch = function (socket, channel) {
  db.doInConn(function(conn, args, callback) {
    console.log('Deleting');
    deleteCurrentConchHolder(conn, channel, function(error) {
      if (!error) {
        console.log('Setting new holder');
        passConchToUser(conn, channel, function(error) {
          if (!error) {
            console.log('Getting');
            getConchHolder(conn, channel, function(error, result) {
              if (!error) {
                console.log("Emitting");
                console.log(result);
                io.to(channel).emit('conch-holder', result);
              }
              sendQueue(conn, channel, callback);
            });
          } else {
            callback(error);
          }
        });
      } else {
        callback(error);
      }
    });
    conn.query("SELECT q.* FROM queue q INNER JOIN attendees a ON a.id = q.attendee_id INNER JOIN channels c ON c.id = a.channel_id AND c.user_key = ? ORDER BY q.id LIMIT 0, 1",
      [channel],
      function(error, results, fields) {
      });
  });
};

function deleteCurrentConchHolder(conn, channel, callback) {
  conn.query("DELETE FROM queue WHERE start_time IS NOT NULL AND attendee_id IN (SELECT a.id FROM attendees a INNER JOIN channels c ON c.id = a.channel_id AND c.user_key = ?)",
    [channel],
    function(error, results, fields) {
      callback(error);
    }
  );
}

function passConchToUser(conn, channel, callback) {
  conn.query("UPDATE queue q SET start_time = ? WHERE attendee_id IN (SELECT a.id FROM attendees a INNER JOIN channels c ON c.id = a.channel_id AND c.user_key = ?) ORDER BY q.id LIMIT 1",
    [Math.floor(new Date().getTime() / 1000), channel],
    function(error, results, fields) {
      callback(error);
    }
  );
}

function getConchHolder(conn, channel, callback) {
  conn.query("SELECT q.*, a.sid FROM queue q INNER JOIN attendees a ON a.id = q.attendee_id INNER JOIN channels c ON c.id = a.channel_id WHERE c.user_key = ? AND q.start_time IS NOT NULL ORDER BY q.id ASC LIMIT 0, 1",
    [channel],
    function(error, results, fields) {
      var result = [null, 0];
      if (!error && results.length) {
        console.log(results);
        result = [results[0]['sid'], results[0]['start_time']];
      }
      callback(error, result);
    }
  );
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

function sendChannelList(conn, channel, callback) {
  conn.query("SELECT a.name, a.sid FROM channels c INNER JOIN attendees a ON a.channel_id = c.id WHERE c.user_key = ? ORDER BY name ASC",
    [channel],
    function(error, results, fields) {
      var clients = {};
      results.forEach(function(result) {
        clients[result['sid']] = {name: result['name']};
      });
      io.to(channel).emit('clients', clients);
      callback(error);
    }
  );
}

function addToQueue(conn, sid, channel, callback) {
  conn.query("INSERT INTO queue (attendee_id) (select a.id FROM attendees a WHERE a.sid = ? AND NOT EXISTS (select 1 FROM queue q WHERE a.id = q.attendee_id));",
    [sid],
    function(error, results, fields) {
      callback(error);
    }
  );
}

function removeFromQueue(conn, sid, channel, callback) {
  conn.query("DELETE FROM queue WHERE attendee_id = (select a.id FROM attendees a INNER JOIN channels c ON c.id = a.channel_id WHERE a.sid = ? AND c.user_key = ?);",
    [sid, channel],
    function(error, results, fields) {
      callback(error);
    }
  );
}

function sendQueue(conn, channel, callback) {
  getQueue(conn, channel, function(error, result) {
    if (!error) {
      io.to(channel).emit('queue', result);
    }
    callback(error);
  });
}

function getQueue(conn, channel, callback) {
  conn.query("SELECT a.sid FROM channels c INNER JOIN attendees a ON a.channel_id = c.id INNER JOIN queue q ON q.attendee_id = a.id WHERE c.user_key = ? AND q.start_time IS NULL ORDER BY q.id ASC",
    [channel],
    function(error, results, fields) {
      callback(error, results.map(function(sid) { return sid['sid'] }));
    }
  );
}
