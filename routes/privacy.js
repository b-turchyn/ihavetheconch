var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.render('privacy/index', {
    title: 'Privacy'
  });
});

module.exports = router;
