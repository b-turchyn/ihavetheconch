var db = require('../lib/database');
var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.redirect('../');
});

router.get('/:channel', function(req, res, next) {
  db.doInConn(function(conn, args, callback) {
    db.query(conn, 'SELECT * FROM channels WHERE admin_key = ?', [req.params.channel])
      .then(function(results) {
        callback();
        res.redirect('/c/' + results['results'][0]['user_key']);
      }).catch(callback);
  });
});

module.exports = router;

