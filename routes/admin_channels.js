var db = require('../lib/database');
var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.redirect('../');
});

router.get('/:channel', function(req, res, next) {
  db.doInConn(function(conn, args, callback) {
    conn.query('SELECT * FROM channels WHERE admin_key = ?', [req.params.channel], function(error, results, fields) {
      if (!error) {
        if (results.length) {
          res.redirect('/c/' + results[0]['user_key']);
        } else {
          res.redirect('../');
        }
      }
      callback(error);
    });
  });
});

module.exports = router;

