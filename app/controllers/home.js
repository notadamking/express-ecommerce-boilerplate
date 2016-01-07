var express = require('express'),
  router = express.Router(),
  marko = require('marko'),
  mongoose = require('mongoose'),
  Article = mongoose.model('Article');

module.exports = function (app) {
  app.use('/', router);
};

var indexTemplate = marko.load(require.resolve('../views/index.marko'));
router.get('/', function (req, res, next) {
  Article.find(function (err, articles) {
    if (err) return next(err);
    indexTemplate.render({
      $global: {locals: req.app.locals},
      title: 'Generator-Express MVC',
      articles: articles
    }, res);
  });
});
