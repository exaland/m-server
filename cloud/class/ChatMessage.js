'use strict';
const _           = require('lodash');
const ChatChannel = require('./ChatChannel');
const ParseObject = Parse.Object.extend('ChatMessage');
const User        = require('./User');
const UserData    = require('./UserData');
const MasterKey   = {useMasterKey: true};

module.exports = {
    beforeSave:    beforeSave,
    createMessage: createMessage,
    getMessages:   getMessages,
    afterSave:     afterSave,
};

function beforeSave(req, res) {
    const comment = req.object;
    const user    = req.user;

    if (!user) {
        return res.error('Not Authorized');
    }

    if (!comment.existed()) {
        var acl = new Parse.ACL();
        acl.setPublicReadAccess(true);
        acl.setRoleWriteAccess('Admin', true);
        acl.setWriteAccess(user, true);
        comment.setACL(acl);
        comment.set('isInappropriate', false);

        UserData
            .getByUser(user)
            .then(profile => comment.set('user', user).set('profile', profile))
            .then(res.success);
    } else {
        return res.success();
    }

}


function createMessage(req, res) {
    const user   = req.user;
    const params = req.params;

    ChatChannel
        .get(params.channelId)
        .then(channel => {
            let form = {
                message: params.message,
                user:    user,
                channel: channel
            };
            return new ParseObject().save(form, MasterKey)
        })
        .then(res.success)
        .catch(res.error);
}

function get(objectId) {
    return new Parse.Query(ParseObject).get(objectId);
}

function pendingRead(channel) {
    return Parse.Query(ParseObject)
        .equalTo('isRead', false)
        .equalTo('channel', channel)
        .count(MasterKey)
}

function updateQtdTotal(channel) {
    return pendingRead(channel)
        .then(total => channel.set('pending', total))
        .then(channel => channel.save())
}


function afterSave(req, res) {
    const channel = req.object.get('channel');
    const user    = req.user;

    // Trim our message to 140 characters.
    const message = req.object.get('message').substring(0, 140);

    channel.set('message', message).save(MasterKey);

    // Send Push messages
    channel
        .relation('users')
        .query()
        .find(MasterKey)
        .then(users => _.filter(users, _user => user.id != _user.id).map(user => sendPushMessage(message, req.user, user, channel.id)))
        .then(() => updateQtdTotal(channel))
        .then(() => {
            console.log('push sent. args received: ' + JSON.stringify(arguments) + '\n');
            res.success({
                status: 'push sent',
                ts:     Date.now()
            });
        }).catch(res.error);


}


function sendPushMessage(message, user, toUser, channel) {
    // Create message to push
    let dataMessage = {
        title:           user.get('name'),
        alert:           message,
        badge:           'Increment',
        event:           'chat',
        chat:            channel,
        icon:            'icon.png',
        iconColor:       '#045F54',
        uri:             'https://photogram.codevibe.io/chat/' + channel.id,
        AnotherActivity: true
    };

    // Get user sent
    let photo = user.get('photo');

    // Get photo user
    if (photo) {
        dataMessage.image = photo.url();
    }
    let pushMessage = {
        channels: [toUser.get('username')],
        data:     dataMessage
    };
    return Parse.Push.send(pushMessage, MasterKey);
}

function getMessages(req, res) {
    const user      = req.user;
    const channelId = req.params.channelId;
    console.log('user', user);

    if (!user) {
        return res.error('Not Authorized');
    }

    if (!channelId) {
        return res.error('Not Channel');
    }

    ChatChannel
        .get(channelId)
        .then(find)
        .then(parseMessages)
        .then(res.success)
        .catch(res.error);
}

function find(channel) {
    return new Parse.Query(ParseObject).equalTo('channel', channel).include(['user,channel,image,image.profile'])
        .find(MasterKey);
}

// Transform Methods
function parseMessages(messages) {
    let _messages = [];
    messages.map(message => {
        let obj = {
            _id:       message.id,
            message:   message.get('message'),
            channel:   message.get('channel').id,
            image:     message.get('image'),
            audio:     message.get('audio'),
            file:      message.get('file'),
            user:      User.parseUser(message.get('user')),
            createdAt: message.createdAt
        };
        _messages.push(obj);
    })
    return _messages
}
