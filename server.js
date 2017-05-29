// server.js
// calls a WebVI using the vireo runtime

// init project
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var fs = require('fs');
var VireoRunner = require('./vireoRunner');

// load library to measure response time (optional)
var responseTime = require('response-time');
app.use(responseTime());

// Library to render markdown documents, used to render README.md as the index page (optional)
var remarkable = require('express-remarkable');
app.engine('md', remarkable(app));
app.set('views', __dirname);
app.get('/', function (req, res) {
  res.render('README.md');
});

// load an XMLHTTPRequest implementation into the global scope
// this allows Vireo to make network requests in the node environment
// optional if the WebVI does not utilize the HTTP gvis
global.XMLHttpRequest = require('xhr2').XMLHttpRequest;


app.post('/vireos', bodyParser.json(), function (req, res) {
  var viaCode = req.body.viaCode;
  var vireoRunner = new VireoRunner(viaCode);

  res.send({
    instanceId: vireoRunner.instanceId
  });
});

app.post('/vireos/:instanceId/run', function (req, res) {
  var vireoRunner = VireoRunner.getVireoRunner(req.params.instanceId);
  if (vireoRunner === undefined) {
    res.status(404).send({
      error: 'Could not find vireo instance: ' + req.params.instanceId
    });
  }

  vireoRunner.run();
  res.send({
    status: vireoRunner.status
  });
});

// listen for requests :)
var listener = app.listen(process.env.PORT || 3000, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
