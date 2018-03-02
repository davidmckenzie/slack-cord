var auth = require('./auth.json');
var _ = require("underscore");
var logger = require('winston');
    logger.level = 'debug';
    logger.info('Initializing bot');
var request = require("request");


const { RtmClient, CLIENT_EVENTS, RTM_EVENTS, WebClient } = require('@slack/client');
// An access token (from your Slack app or custom integration - usually xoxb)
const token = auth.token;
var channels = auth.channels;
var chanArr = [];
const appData = {};

const rtm = new RtmClient(token, {
  dataStore: false,
  useRtmConnect: true,
});

// Need a web client to find a channel where the app can post a message
const web = new WebClient(token);

let groupListPromise = web.groups.list();
groupListPromise.then((res) => {
    res.groups.forEach(function(v){
    logger.debug(`ID: ${v.id} Name: ${v.name}`);
    });
    for (i in channels) {
        var found = _.find(res.groups, function(obj) { return obj.name === channels[i].name});
        if (found) {
            channels[i].id = found.id;
            logger.info(`Found group ${channels[i].name} with ID ${channels[i].id}`);
            chanArr.push(channels[i].id);
        } else {
            logger.warn(`Couldn't find group ${channels[i].name}`);
        }
    }
})

// Load the current channels list asynchrously
let channelListPromise = web.channels.list();

channelListPromise.then((res) => {
    res.channels.forEach(function(v){ 
        logger.debug(`ID: ${v.id} Name: ${v.name}`);
    });
    for (i in channels) {
        var found = _.find(res.channels, function(obj) { return obj.name === channels[i].name});
        if (found) {
            channels[i].id = found.id;
            logger.info(`Found channel ${channels[i].name} with ID ${channels[i].id}`);
            chanArr.push(channels[i].id);
        } else {
            logger.warn(`Couldn't find channel ${channels[i].name}`);
        }
    }
});

rtm.on(RTM_EVENTS.MESSAGE, (message) => {
  // Log the message
  logger.debug('New message: ', message);
  if (chanArr.indexOf(message.channel) > -1) {
    var obj = _.find(channels, function (obj) { return obj.id === message.channel; });
    var post_data = {};
        post_data.username = obj.name;
    if (message.subtype) {
        if (message.subtype == 'file_share') {
            // download and attach an image
            logger.info(`Sendning file upload: ${message.text}`);
            var fileUrl = message.file.url_private;
            var fileName;
            if (message.file.name) {
                fileName = message.file.name;
            } else {
                fileName = 'upload.'+message.file.filetype;
            }
            var mimeType = message.file.mimetype;

            request({
                'url': fileUrl,
                'method': 'GET',
                'encoding': null,
                headers:{
                    Authorization: ` Bearer ${token}`
                }
              }, function(err, res, body) {
                if(err) console.log(err);
                var contentType = res.headers['content-type'];
                var req = request.post(obj.webhook, function (err, resp, body) {
                    if (err) {
                        console.log('Error posting webhook!');
                        console.log(err);
                    } else {
                        console.log('webhook posted\n');
                    }
                });
                var form = req.form();
                    form.append('username', obj.name);
                    //form.append('content', '@everyone');
                    form.append('file', body, {
                        filename: fileName,
                        contentType: mimeType
                    });
              });
        } else if (message.subtype == 'bot_message' || message.subtype == 'me_message') {
            // send text post
            var textParse;
            if (message.text) {
                textParse = message.text.replace(/<!everyone>/gi, "@everyone");
            } else {
                textParse = 'undefined';
            }
            logger.info(`#${obj.name}: ${message.text}`);
            if (obj.everyone == true) {
                post_data.content = `@everyone **#${obj.name}**: ${textParse}`;
            } else {
                post_data.content = `**#${obj.name}**: ${textParse}`;
            }
            var url = obj.webhook;
            var options = {
              method: 'post',
              body: post_data,
              json: true,
              url: url
            }
            request(options, function (err, res, body) {
                if (err) {
                  logger.error('error posting json: ', err)
                  throw err
                }
                var headers = res.headers;
                var statusCode = res.statusCode;
                logger.info('Webhook fired, statusCode: ', statusCode);
            });
        } else {
            logger.info(`Ignoring message subtype: ${message.subtype}, text ${message.text}`);
        }
    } else if (message.text && message.text != '') {
        var textParse = message.text.replace(/<!everyone>/gi, "@everyone");
        logger.info(`#${obj.name}: ${message.text}`);
        if (obj.everyone == true) {
            post_data.content = `@everyone **#${obj.name}**: ${textParse}`;
        } else {
            post_data.content = `**#${obj.name}**: ${textParse}`;
        }
        var url = obj.webhook;
        var options = {
          method: 'post',
          body: post_data,
          json: true,
          url: url
        }
        request(options, function (err, res, body) {
            if (err) {
              logger.error('error posting json: ', err)
              throw err
            }
            var headers = res.headers;
            var statusCode = res.statusCode;
            logger.info('Webhook fired, statusCode: ', statusCode);
        });
    } else {
        logger.info(`Ignoring message with no content: ${message}`);
    }
  }
});

// Start the connecting process
rtm.start();