"use strict";

var express = require('express');
var router = express.Router();
var request = require('request');
const FB_VERIFY = process.env.FB_VERIFY;
const PAGE_ACCESS = process.env.PAGE_ACCESS_TOKEN;  

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
            sendMessageToUser(sender, "echo: " + text.substring(0, 200))
        }
    }
    res.sendStatus(200)
})

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