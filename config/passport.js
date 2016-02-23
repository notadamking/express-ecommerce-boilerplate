var passport = require('passport'),
    oauth = require('./oauth.js'),
    FacebookStrategy = require('passport-facebook').Strategy,
    TwitterStrategy = require('passport-twitter').Strategy,
    GoogleStrategy = require('passport-google-oauth2').Strategy,
    User = require('../app/models/user');

module.exports = function(app, passport) {
  // Serializes a user to the session
  passport.serializeUser(User.serializeUser());

  // Establishes a session and stores the user in the req.user object
  passport.deserializeUser(User.deserializeUser());

  // Creates a new LocalStrategy to authenticate Users
  passport.use(User.createStrategy());

  passport.use(new FacebookStrategy({
    clientID: oauth.facebook.clientID,
    clientSecret: oauth.facebook.clientSecret,
    callbackURL: oauth.facebook.callbackURL,
    profileFields: [ 'email' ]
  }, function handle_token(accessToken, refreshToken, profile, done) {
    User.findOneAndUpdate({ email: profile.emails[0].value }, {
      facebook: {
        oauth_id: profile.id,
        token: accessToken
      }
    }, function(err, user) {
      if(err) console.log(err);
      if(!user) {
        user = new User({
          facebook: {
            oauth_id: profile.id,
            token: accessToken
          },
          email: profile.emails[0].value
        });
        user.save(function(err) {
          if(err) console.log(err);
          done(err, user);
        });
      } else {
        done(err, user);
      }
    });
  }));

  // TODO: Waiting on twitter to allow elevated permissions (email)
  passport.use(new TwitterStrategy({
    consumerKey: oauth.twitter.consumerKey,
    consumerSecret: oauth.twitter.consumerSecret,
    callbackURL: oauth.twitter.callbackURL,
    includeEmail: true,
  }, function (accessToken, refreshToken, profile, done) {
    User.findOneAndUpdate({ email: profile.emails[0].value }, {
      twitter: {
        oauth_id: profile.id,
        token: accessToken
      }
    }, function(err, user) {
      if(err) console.log(err);
      if(!user) {
        user = new User({
          twitter: {
            oauth_id: profile.id,
            token: accessToken
          },
          email: profile.emails[0].value
        });
        user.save(function(err) {
          if(err) console.log(err);
          done(err, user);
        });
      } else {
        done(err, user);
      }
    });
  }));

  passport.use(new GoogleStrategy({
    clientID: oauth.google.clientID,
    clientSecret: oauth.google.clientSecret,
    callbackURL: oauth.google.callbackURL,
    scope: [ 'email' ]
  }, function (accessToken, refreshToken, profile, done) {
    User.findOneAndUpdate({ email: profile.emails[0].value }, {
      google: {
        oauth_id: profile.id,
        token: accessToken
      }
    }, function(err, user) {
      if(err) console.log(err);
      if(!user) {
        user = new User({
          google: {
            oauth_id: profile.id,
            token: accessToken
          },
          email: profile.emails[0].value
        });
        user.save(function(err) {
          if(err) console.log(err);
          done(err, user);
        });
      } else {
        done(err, user);
      }
    });
  }));
}
