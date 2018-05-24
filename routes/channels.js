var db = require('../lib/database');
var crypto = require('crypto');
var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.redirect('../');
});

router.post('/', (req, res, next) => {
  res.redirect('/c/' + req.body['user-key']);
});

router.get('/new', function(req, res, next) {
  res.redirect('../../');
});

router.post('/new', function(req, res, next) {
  var newChannel = {
    'name': req.body['channel-name'],
    'admin_key': crypto.randomBytes(16).toString('hex'), // Admin key
    'user_key': crypto.randomBytes(16).toString('hex')  // User key
  };

  db.doInConn((conn, args, callback) => {
    ensureUnique(conn, newChannel, 'admin_key', (results) => {
      newChannel = results;
      ensureUnique(conn, newChannel, 'user_key', (results) => {
        newChannel = results;
        conn.query('INSERT INTO channels SET ?', newChannel, function(error, results, fields) {
          if (!error) {
            res.redirect('/a/' + newChannel['admin_key']);
          }
          callback(error);
        });
      });
    });

  });

});

router.get('/:channel', function(req, res, next) {
  db.doInConn(function(conn, args, callback) {
    db.query(conn, 'SELECT * FROM channels WHERE user_key = ?', [req.params.channel])
      .then(function(results) {
        callback();
        if (results['results'].length) {
          res.render('channels/channel', {
            title: results['results'][0]['name'],
            admin: req.cookies[req.params.channel] !== undefined
          });
        } else {
          res.status(404).send('No dice');
        }
      })
      .catch(callback);
  });
});

module.exports = router;

var isDuplicateKey = function(conn, key, callback) {
  conn.query("SELECT 1 FROM channels WHERE user_key = ? OR admin_key = ? LIMIT 0, 1", [key, key], (error, results, fields) => {
    callback(results.length > 0);
  });
};

var ensureUnique = function(conn, channel_params, key, callback) {
  isDuplicateKey(conn, channel_params[key], (results) => {
    if (results) {
      channel_params[key] = crypto.randomBytes(16).toString('hex');
      ensureUnique(conn, channel_params, key, callback);
    } else {
      callback(channel_params);
    }
  });
};
