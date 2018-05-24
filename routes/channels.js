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

  db.doInConn(function(conn, args, callback) {
    conn.query('INSERT INTO channels SET ?', newChannel, function(error, results, fields) {
      if (!error) {
        console.log(error);
        console.log(results);
        console.log(fields);
        res.redirect('/a/' + newChannel['admin_key']);
      }
      callback(error);
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
            admin: req.cookies[req.params.channel] !== undefined,
            user_key: "https://" + req.headers.host + "/c/" + results['results'][0]['user_key'],
            admin_key: "https://" + req.headers.host + "/a/" + results['results'][0]['admin_key']
          });
        } else {
          res.status(404).send('No dice');
        }
      })
      .catch(callback);
  });
});

module.exports = router;

