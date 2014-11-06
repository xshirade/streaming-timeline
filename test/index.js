/***
  General modules here
  request - To use the same cookie in the other request, set option {jar: true}
***/

var request = require('request').defaults({jar: true});
var fs = require('fs');
var qs = require('querystring');
var path = require('path');
var assert = require('assert');
var async = require('async');
var http = require('http');


/***
  Shortcuts command and global variables which are necessary to do test
***/
var l = console.log;
var e = console.error;
var rootPath = path.join(__dirname + '/..');
var index, server;


/*** 
  Getting session id from cookie which was added by express session
***/
function getSID (cookie) {
  return qs.parse(cookie, '&', '=')['connect.sid'].slice(2).split('.')[0];
};

/***
  obj which include enviromental variables
***/
var env = {
  id: process.env['NODE_USER_ID'],
  consumer_key: process.env['NODE_CONSUMER_KEY'],
  consumer_secret: process.env['NODE_CONSUMER_SECRET'],
  token: process.env['NODE_TOKEN_KEY'],
  token_secret: process.env['NODE_TOKEN_SECRET']
}

/***
  For using Twitter RESTful API by 'request' module
***/
var oauth = {
  id: env.id,
  consumer_key: env.consumer_key,
  consumer_secret: env.consumer_secret,
  token: env.token,
  token_secret: env.token_secret
};


/***
  Test user data which will be stored into session store
***/
var user = {
  id: env.id,  
  token: env.token,
  tokenSecret: env.token_secret
}

/***
  profile data shich will be used for twitter strategy
***/
var profile = {
  id: env.id,
  displayName: 'TEST USER',
  username: 'TEST USER',
  token: env.token,
  tokenSecret: env.token_secret
}

/***
  The followings are test codes of index.js
***/
describe('Test of index.js - server', function () {
  before(function (done) {
    async.series([
      function (callback) {
        index = require(path.join(rootPath + '/index'));
        callback();
      }, function (callback) {
        index.db.connect('mongodb://localhost/test');
        callback();
      }, function (callback) {
        server = index.server.listen(3000, 'localhost');
        callback();
      }, function (callback) {
        done();
        callback();
      }
    ]);
  });

  describe('unit test', function () {
    it('function trimTweets', function (done) {
      var now = Date();
      var timeline = [{
        created_at: now,
        id:1,
        text:'1',
        user: {
          id: 1,
          name: '1',
          screen_name: '1',
          profile_image_url: 'dummyURL'
        }
      },{
        created_at: now,
        id:2,
        text:'2',
        user: {
          id: 2,
          name: '2',
          screen_name: '2',
          profile_image_url: 'dummyURL'
        }
      },{
        created_at: now,
        id:3,
        text:'3',
        user: {
          id: 3,
          name: '3',
          screen_name: '3',
          profile_image_url: 'dummyURL'
        }
      }
      ];
      assert.deepEqual(timeline, index.trimTweets(timeline));
      done();
    });

    it('twitter strategy', function (done) {
      function dummy (arg1, arg2) {
        assert.strictEqual(arg1, null);
        assert.strictEqual(arg2.id, profile.id);
        assert.strictEqual(arg2.name, profile.displayName);
        assert.strictEqual(arg2.screenName, profile.username);
        assert.strictEqual(arg2.token, profile.token);
        assert.strictEqual(arg2.tokenSecret, profile.tokenSecret);
        done();
      };
      index.ts._verify(oauth.token, oauth.token_secret, profile, dummy);
    });
  });

  describe('normal cases', function () {
    it('/, should return index.html generated by jade', function (done) {
      request.get('http://localhost:3000/', function (error, response, body) {
        if (error) e(error);
        assert.strictEqual(response.statusCode, 200);
        var html = fs.readFileSync(path.join(rootPath + '/test/html/index.html'));
        assert.equal(body, html.toString());
        done();
      });
    });

    it('/home, should return statusCode 401', function (done) {
      request.get({url: 'http://localhost:3000/home'}, function (error, response, body) {
        if(error) e(error);
        assert.strictEqual(response.statusCode, 401);
        assert.strictEqual(body, 'Unauthorized. Redirecting to /');
        var sid = getSID(response.req._headers.cookie);
        index.sessionStore.set(sid, {cookie: {expires: null}, passport: {user: user}}, function (error) {
          if(error) e(error);
          done();
        });
      });
    });

    it('/oauth/twitter/auth, should return statusCode 200 and twitter auth page', function (done) {
      this.timeout(10 * 1000);
      request.get('http://localhost:3000/oauth/twitter/auth', function (error, response, body) {
        if (error) e(error);
        assert.strictEqual(response.statusCode, 200);
        //var html = fs.readFileSync(path.join(rootPath + '/test/html/oauth.html'));
        //assert.equal(body, html.toString());
        done();
      });
    });

    it('/home, should return statusCode 200 and home.html generated by jade', function (done) {
      request.get({url: 'http://localhost:3000/home'}, function (error, response, body) {
        if(error) e(error);
        assert.strictEqual(response.statusCode, 200);
        var html = fs.readFileSync(path.join(rootPath + '/test/html/home.html'));
        assert.equal(body, html.toString());
        done();
      });
    });

    it('/logout, should return statusCode 200 and redirect /', function (done) {
      request.get('http://localhost:3000/logout', function (error, response, body) {
        if (error) e(error);
        assert.strictEqual(response.statusCode, 200);
        var html = fs.readFileSync(path.join(rootPath + '/test/html/index.html'));
        assert.strictEqual(body, html.toString());
        done();
      });
    });

    it('/css/cover.css, should return content of cover.css', function (done) {
      request.get('http://localhost:3000/css/cover.css', function (error, response, body) {
        if (error) e(error);
        assert.strictEqual(response.statusCode, 200);
        var css = fs.readFileSync(path.join(__dirname + '/../views/css/cover.css'));
        assert.strictEqual(body, css.toString());
        done();
      });
    });
  });

  describe('abnormal cases', function () {
    it('/get, should returns 404 not found', function (done) {
      request.get('http://localhost:3000/get', function (error, response, body) {
        if (error) e(error);
        assert.strictEqual(response.statusCode, 404);
        assert.strictEqual(body, 'Not Found');
        done();
      });
    });

    it('/post, should returns 400 bad request', function (done) {
      request.post('http://localhost:3000/post', function (error, response, body) {
        if (error) e(error);
        assert.strictEqual(response.statusCode, 400);
        assert.strictEqual(body, 'Bad Request');
        done();
      });
    });

    it('/put, should returns 400 bad request', function (done) {
      request.put('http://localhost:3000/put', function (error, response, body) {
        if (error) e(error);   
        assert.strictEqual(response.statusCode, 400);
        assert.strictEqual(body, 'Bad Request');
        done();
      });
    });

    it('/delete, should returns 400 bad request', function (done) {
      request.del('http://localhost:3000/delete', function (error, response, body) {
        if (error) e(error);
        assert.strictEqual(response.statusCode, 400);
        assert.strictEqual(body, 'Bad Request');
        done();
      });
    });
  });

  describe('socketio test', function () {
    var socket, tweetId, expectedTimeline;
    before(function (done) {
      request.get({url: 'http://localhost:3000/home'}, function (error, response, body) {
        if(error) e(error);
        cookie = response.req._headers.cookie;
        var sid = getSID(response.req._headers.cookie);
        index.sessionStore.set(sid, {cookie: {expires: null}, passport: {user: user}}, function (error) {
          if(error) e(error);
          var myAgent = new http.Agent();
          myAgent._addRequest = myAgent.addRequest;
          myAgent.addRequest = function(req, host, port, localAddress) {
            var old = req._headers.cookie;
            req._headers.cookie = cookie + (old ? '; ' + old : '');
            req._headerNames['cookie'] = 'Cookie';
            return myAgent._addRequest(req, host, port, localAddress);
          };
          var client = require('socket.io-client');
          socket = client.connect('http://localhost:3000', { agent: myAgent});
          socket.on('connect', function () {
            done();
          });
        });
      });
    });

    it('socket.on("init") should get 5 most recent tweets by using RESTful API', function (done) {
      this.timeout(10 * 1000);
      socket.emit('init');
      socket.on('init', function (timeline){
        var url = 'https://api.twitter.com/1.1/statuses/home_timeline.json?';
        url += qs.stringify({count: 5, contributor_details: false, include_entities: false});
        request.get({url:url, oauth:oauth, json:true}, function (error, response, body) {
          // expextedTimeline to be used later to confirm expected tweet is fetch from server
          if (error) e(error);
          expectedTimeline = index.trimTweets(body);
          assert.deepEqual(timeline, expectedTimeline);
          done();
        });
      });
    });

    it('socket.on("supplemental tweet") should get fifth tweet from user\'s timeline stored in db', function (done) {
      socket.emit('tweet');
      socket.on('supplemental tweet', function (tweet){
        assert.deepEqual(tweet, expectedTimeline[4]);
        done();
      });
    });

    it('socket.on("new tweet") should get new tweet info', function (done) {
      this.timeout(5 * 1000);
      var text = 'test tweet';
      socket.on('new tweet', function (tweet){
        assert.equal(tweet.text, text);
        assert.equal(tweet.user.id, user.id);
        done();
      });
      var url = 'https://api.twitter.com/1.1/statuses/update.json?';
      url += qs.stringify({status: text, trim_user: true});
      request.post({url:url, oauth:oauth, json:true}, function (error, response, tweet) {
        tweetId = tweet.id_str;
      });
    });

    it('socket.on("delete tweet") should get deleted tweet info', function (done) {
      this.timeout(5 * 1000);
      socket.on('delete tweet', function (tweet){
        assert.equal(tweet.id, tweetId);
        assert.equal(tweet.user_id, user.id);
        done();
      });
      var url = 'https://api.twitter.com/1.1/statuses/destroy/' + tweetId + '.json?trim_user=true';
      request.post({url:url, oauth:oauth, json:true}, function (error, response, tweet) {
      });
    });

    it('socket.on("unconnect") should get true', function (done) {
      socket.emit('unconnect');
      socket.on('unconnect', function (msg) {
        assert.equal(msg, true);
        done();
      });
    });
  });

  after(function (done) {
    index.sessionStore.clear(function (error) {
      index.db.disconnect();
      process.exit();
      done();
    });
  });
});