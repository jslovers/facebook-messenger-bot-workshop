"use strict";

var express = require('express');
var router = express.Router();
var request = require('request');
const Wit = require('node-wit').Wit;
const log = require('node-wit').log;
const FB_VERIFY = process.env.FB_VERIFY;
const PAGE_ACCESS = process.env.PAGE_ACCESS_TOKEN;
const WIT_TOKEN = process.env.WIT_TOKEN;

const sessions = {};
const findOrCreateSession = (fbid) => {
    let sessionId;
    // Let's see if we already have a session for the user fbid
    Object.keys(sessions).forEach(k => {
        if (sessions[k].fbid === fbid) {
            // Yep, got it!
            sessionId = k;
        }
    });
    if (!sessionId) {
        // No session found for user fbid, let's create a new one
        sessionId = new Date().toISOString();
        sessions[sessionId] = {
            fbid: fbid,
            context: {}
        };
    }
    return sessionId;
};

const firstEntityValue = (entities, entity) => {
    const val = entities && entities[entity] &&
        Array.isArray(entities[entity]) &&
        entities[entity].length > 0 &&
        entities[entity][0].value;
    if (!val) {
        return null;
    }
    return typeof val === 'object' ? val.value : val;
};

// Our bot actions
const actions = {
    next_event({
        context,
        entities
    }) {
        return new Promise(function(resolve, reject) {
            context.random = Math.random() * 100000000000000;
            return resolve(context);
        });
    },
    send({
        sessionId
    }, {
        text
    }) {
        const recipientId = sessions[sessionId].fbid;
        if (recipientId) {
            return sendMessageToUser(recipientId, text)
                .then(() => null)
                .catch((err) => {
                    console.error(
                        'Oops! An error occurred while forwarding the response to',
                        recipientId,
                        ':',
                        err.stack || err
                    );
                });
        } else {
            console.error('Oops! Couldn\'t find user for session:', sessionId);
            return Promise.resolve()
        }
    },
};

const wit = new Wit({
    accessToken: WIT_TOKEN,
    actions,
    logger: new log.Logger(log.INFO)
});

router.get('/', function(req, res, next) {
    if (req.query['hub.verify_token'] === FB_VERIFY) {
        res.send(req.query['hub.challenge'])
    }
    res.send('Error, wrong token')
});

router.post('/', function(req, res) {
    let messaging_events = req.body.entry[0].messaging
    for (let i = 0; i < messaging_events.length; i++) {
        let event = req.body.entry[0].messaging[i]
        let sender = event.sender.id
        if (event.message && event.message.text) {
            let text = event.message.text
                // sendMessageToUser(sender, "echo: " + text.substring(0, 200));

            var sessionId = findOrCreateSession(sender);


            wit.runActions(
                    sessionId, // the user's current session
                    text, // the user's message
                    sessions[sessionId].context // the user's current session state
                ).then((context) => {
                    // Our bot did everything it has to do.
                    // Now it's waiting for further messages to proceed.
                    console.log('Waiting for next user messages');

                    // Based on the session state, you might want to reset the session.
                    // This depends heavily on the business logic of your bot.
                    // Example:
                    // if (context['done']) {
                    //   delete sessions[sessionId];
                    // }

                    // Updating the user's current session state
                    sessions[sessionId].context = context;
                })
                .catch((err) => {
                    console.error('Oops! Got an error from Wit: ', err.stack || err);
                })
        }
    }
    res.sendStatus(200)
});

function sendMessageToUser(sender, text) {
    let messageData = {
        text: text
    }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: PAGE_ACCESS
        },
        method: 'POST',
        json: {
            recipient: {
                id: sender
            },
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

module.exports = router;