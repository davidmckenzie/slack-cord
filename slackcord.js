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
            logger.info(`Ignoring file upload: ${message.text}`);
        } else if (message.subtype == 'message_replied' || message.subtype == 'bot_message' || message.subtype == 'reply_broadcast' || message.subtype == 'me_message') {
            logger.info(`#${obj.name}: ${message.text}`);
            post_data.content = `**#${obj.name}**: ${message.text}`;
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
        logger.info(`#${obj.name}: ${message.text}`);
        post_data.content = `**#${obj.name}**: ${message.text}`;
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