var mysql = require('mysql');
var pool = mysql.createPool({
  connectionLimit: Number(process.env.MYSQL_CONN_LIMIT) || 10,
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'conch',
  password: process.env.MYSQL_PASS || '',
  database: process.env.MYSQL_DB || 'conch',
  port: process.env.MYSQL_PORT || 3306
});

var db = {
  doInConn: function (fcn, args) {
    pool.getConnection( function(err, connection) {
      if (err) {
        throw err;
      }

      db.doInTxn(connection, fcn, args, function () {
        connection.release();
      });
    });
  },
  doInTxn: function (connection, fcn, args, callback) {
    connection.beginTransaction(function(err) {
      if (err) {
        throw err;
      }

      fcn(connection, args, function(err) {
        if (err) {
          return connection.rollback(function() {
            throw err;
          });
        } else {
          connection.commit(function(err) {
            if (err) {
              return connection.rollback(function() {
                throw err;
              });
            } else {
              callback();
            }
          });
        }
      });
    });
  }
};

module.exports = db;
