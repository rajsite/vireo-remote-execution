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

app.use('/client/ni-webvi-resource-v0', express.static('node_modules/webvi-npm/ni-webvi-resource-v0'));
app.use("/client", express.static('RemoteExectionClient/Builds/Web Server/Configuration1/RemoteExecutionClient', {
  index: ['Main.html', 'index.html']
}));

app.post('/vireos', bodyParser.json(), function (req, res) {
  var viaCode = req.body.viaCode;
  var vireoRunner = new VireoRunner(viaCode);

  res.send({
    instanceId: vireoRunner.instanceId
  });
});

app.use('/vireos/:instanceId', function (req, res, next) {
  var vireoRunner = VireoRunner.getVireoRunner(req.params.instanceId);
  if (vireoRunner === undefined) {
    res.status(404).send({
      error: 'Could not find vireo instance: ' + req.params.instanceId
    });
    return;
  }

  req.vireoRunner = vireoRunner;
  next();
});

app.get('/vireos/:instanceId', function (req, res) {
  var vireoRunner = req.vireoRunner;
  res.send({
    state: vireoRunner.state,
    printLog: vireoRunner.printLog,
    errorLog: vireoRunner.printErrorLog
  });
});

app.get('/vireos/:instanceId/controls', function (req, res) {
  var vireoRunner = req.vireoRunner;
  // Vireo returns controls as an object with name, value.
  // Transform to an array of objects for easier parsing in some languages
  var controls = vireoRunner.getAllControls();
  var filteredControls = Object.keys(controls).filter((controlName) => /^dataItem_/.test(controlName)).map((controlName) => ({
      name: controlName,
      value: controls[controlName]
  }));
  res.send({
    state: vireoRunner.state,
    controls: filteredControls
  });
});

app.post('/vireos/:instanceId/run', function (req, res) {
  var vireoRunner = req.vireoRunner;
  vireoRunner.run();
  res.send({
    state: vireoRunner.state
  });
});

// listen for requests :)
var listener = app.listen(process.env.PORT || 3000, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
