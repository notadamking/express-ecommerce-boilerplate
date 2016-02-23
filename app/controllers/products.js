var express = require('express'),
    router = express.Router(),
    multer = require('multer'),
    upload = multer({dest: './public/img'}),
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
    res.render('products/catalogue', {
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
    variants: [{
      title: req.body.name,
      description: req.body.description,
      price: req.body.price * 100,
      active: req.body.active
    }]
  });
  product.addImageFromFile(undefined, req.file, true, function(err) {
    if(err) return next(err);
    res.redirect('/products');
  });
});

/* Endpoint to search products */
router.get('/products/search', function(req, res, next) {
  var query = req.query.q;
  Product.find({ name: new RegExp(query, 'i')}, function(err, products) {
    if(err) return next(err);
    console.log("\nProducts: ", products);
    res.render('products/catalogue', {
      title: 'Products',
      products: products
    });
  });
});

/* Endpoint to view individual product */
router.get('/products/:product_id', function(req, res, next) {
  Product.findOne({ _id: req.params.product_id }, function(err, product) {
    if(err) return next(err);
    res.render('products/product', {
      title: product.name,
      product: product
    });
  });
});

/* Endpoint to update a product */
router.put('/products/:product_id', function(req, res,  next) {
  Product.findOneAndUpdate({ _id: req.params.product_id }, {
    name: req.body.name,
    category: req.body.category,
    price: req.body.price * 100,
    description: req.body.description,
    active: req.body.active
  }, function(err, product) {
    if(err) return next(err);
    if(!product) {
      req.flash('error', 'No product found with id: ' + req.params.product_id);
    } else {
      req.flash('info', 'Product ' + req.params.product_id + ' successfully updated.');
    }
    res.redirect('/products/' + req.params.product_id);
  })
});

/* Endpoint to delete a product */
router.delete('/products/:product_id', function(req, res, next) {
  Product.remove({ _id: req.params.product_id }, function(err) {
    if(err) return next(err);
    req.flash('info', 'Product ' + req.params.product_id + ' successfully deleted.');
    res.redirect('/products');
  });
});

/* Endpoint to post a new image for a product */
router.post('/products/:product_id/images', upload.single('image'), function(req, res, next) {
  Product.findOne({ _id: req.params.product_id }, function(err, product) {
    if(err) return next(err);
    if(!product) {
      req.flash('error', 'No product with that id exists.');
      res.redirect('/products');
    } else {
      product.addImageFromFile(req.body.variant_SKU, req.file, req.body.thumbnail, function(err) {
        if(err) return next(err);
        res.redirect('/products/' + req.params.product_id);
      });
    }
  });
});

/* Endpoint to remove an image from a product */
router.delete('/products/:product_id/images/:image_url', function(req, res, next) {
  Product.findOne({ _id: req.params.product_id }, function(err, product) {
    if(err) return next(err);
    if(!product) {
      req.flash('error', 'No product with that id exists.');
      res.redirect('/products');
    } else {
      product.removeImage(req.body.variant_SKU, decodeURIComponent(req.params.image_url), function(err) {
        if(err) return next(err);
        res.redirect('/products/' + req.params.product_id);
      });
    }
  });
});

/* Endpoint to post a new variant for a product */
router.post('/products/:product_id/variants', upload.single('image'), function(req, res, next) {
  Product.findOne({ _id: req.params.product_id }, function(err, product) {
    if(err) return next(err);
    if(!product) {
      req.flash('error', 'No product with that id exists.');
      res.redirect('/products');
    } else {
      var variant = {
        title: req.body.title,
        SKU: req.body.SKU,
        description: req.body.description,
        price: req.body.price * 100,
        active: req.body.active,
        attributes: req.body.attributes
      };
      product.addVariant(variant, req.file, function(err) {
        if(err) return next(err);
        res.redirect('/products/' + req.params.product_id);
      });
    }
  });
});

/* Endpoint to remove a variant from a product */
router.delete('/products/:product_id/variants/:variant_SKU', function(req, res, next) {
  Product.findOne({ _id: req.params.product_id }, function(err, product) {
    if(err) return next(err);
    if(!product) {
      req.flash('error', 'No product with that id exists.');
      res.redirect('/products');
    } else {
      product.removeVariant(req.params.variant_SKU, function(err) {
        if(err) return next(err);
        res.redirect('/products/' + req.params.product_id);
      });
    }
  });
});

/* Endpoint to view products by category */
router.get('/products/category/:category_id', function(req, res, next) {
  Product.find({ category: req.params.category_id.toLowerCase() }, function(err, products) {
    if(err) return next(err);
    if(!products) {
      res.sendStatus(404);
    }
    res.render('products/catalogue', {
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
