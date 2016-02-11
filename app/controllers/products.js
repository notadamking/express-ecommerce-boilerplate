var express = require('express'),
    router = express.Router(),
    fs = require('fs'),
    multer = require('multer'),
    upload = multer({dest: './public/img'}),
    mime = require('mime'),
    mongoose = require('mongoose'),
    Product = mongoose.model('Product'),
    Category = mongoose.model('Category');

module.exports = function (app) {
  app.use('/', router);
};

/* Endpoint to view products */
router.get('/products', function(req, res, next) {
  Product.find(function(err, products) {
    if(err) return next(err);
    res.render('products', {
      title: 'Products',
      products: products
    });
  });
});

/* Endpoint to post a new product */
router.post('/products', upload.single('image'), function(req, res, next) {
  var product = new Product({
    name: req.body.name,
    category: req.body.category,
    description: req.body.description,
    price: req.body.price * 100,
    active: req.body.active
  });
  var file_ext = mime.extension(req.file.mimetype);
  var thumbnail_url = 'img/' + product.SKU + '.' + file_ext;
  product.thumbnail_image_url = 'http://localhost:3000/' + thumbnail_url;
  product.save(function(err) {
    if(err) return next(err);
    res.redirect('/products');
  });
  var target_path = './public/' + thumbnail_url;
  fs.renameSync(req.file.path, target_path);
});

/* Endpoint to search products */
router.get('/products/search', function(req, res, next) {
  var query = req.query.q;
  Product.find({ name: new RegExp(query, 'i')}, function(err, products) {
    if(err) return next(err);
    console.log("\nProducts: ", products);
    res.render('products', {
      title: 'Products',
      products: products
    });
  });
});

/* Endpoint to view individual product */
router.get('/products/:product_SKU', function(req, res, next) {
  Product.findOne({ SKU: req.params.product_SKU }, function(err, product) {
    if(err) return next(err);
    res.render('products/product', {
      title: product.name,
      product: product
    });
  });
});

/* Endpoint to update a product */
router.put('/products/:product_SKU', function(req, res,  next) {
  Product.findOneAndUpdate({ SKU: req.params.product_SKU }, {
    name: req.body.name,
    category: req.body.category,
    price: req.body.price * 100,
    description: req.body.description,
    active: req.body.active
  }, function(err, product) {
    if(err) return next(err);
    if(!product) {
      req.flash('error', 'No product found with SKU: ' + req.params.product_SKU);
    } else {
      req.flash('info', 'Product ' + req.params.product_SKU + ' successfully updated.');
    }
    res.redirect('/products/' + req.params.product_SKU);
  })
});

/* Endpoint to delete a product */
router.delete('/products/:product_SKU', function(req, res, next) {
  Product.remove({ SKU: req.params.product_SKU }, function(err) {
    if(err) return next(err);
    req.flash('info', 'Product ' + req.params.product_SKU + ' successfully deleted.');
    res.redirect('/products');
  });
});

/* Endpoint to view products by category */
router.get('/products/category/:category_id', function(req, res, next) {
  Product.find({ category: req.params.category_id.toLowerCase() }, function(err, products) {
    if(err) return next(err);
    if(!products) {
      res.sendStatus(404);
    }
    res.render('products', {
      title: 'Products - ' + req.params.category_id,
      products: products
    });
  });
});

/* Endpoint to view products by parent category */
router.get('/products/category/parent/:category_id', function(req, res, next) {
  Category
    .find({ parent: req.params.category_id })
    .sort({ _id: 1 })
    .exec(function(err, categories) {
      if(err) return next(err);
      res.json({ categories: categories });
    });
});

/* Endpoint to advanced search products */
router.get('/products/advanced_search', function(req, res, next) {

});
