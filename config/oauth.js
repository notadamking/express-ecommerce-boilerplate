var ids = {
  facebook: {
    clientID: '894157650704719',
    clientSecret: 'f5a91eeba4aeb896d7e620aaa18fb2ad',
    callbackURL: 'http://localhost:3000/auth/facebook/callback'
  },
  twitter: {
    consumerKey: 'EOoy23pkV5yuC5wSSNTesDAEw',
    consumerSecret: 'clpjwl0iPRMKuUrTJU97Ahx94asTzbWsGZa1SLTfiVfsF3189B',
    callbackURL: "http://localhost:3000/auth/twitter/callback"
  },
  google: {
    clientID: '281645334048-knslf7sg3sfsrgaaesisaajrdct6ehff.apps.googleusercontent.com',
    clientSecret: 'MXlORugBFNN-tuOFyyA5yjEJ',
    callbackURL: 'http://localhost:3000/auth/google/callback'
  },
  instagram: {
    clientID: '348bfda77fb04ab3b9bdd116ea0ca95c',
    clientSecret: 'd1b4d6e42b834f428415b873f476661a',
    callbackURL: 'http://localhost:3000/auth/instagram/callback'
  }
};

module.exports = ids;
