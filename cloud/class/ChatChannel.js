'use strict';
const _           = require('lodash');
const ParseObject = Parse.Object.extend('ChatChannel');
const ChatMessage = Parse.Object.extend('ChatMessage');
const User        = require('./User');
const UserData    = require('./UserData');
const MasterKey   = {useMasterKey: true};

module.exports = {
    get:               get,
    getChatChannels:   getChatChannels,
    getChatChannel:    getChatChannel,
    createChatChannel: createChatChannel,
};


function get(objectId) {
    return new Parse.Query(ParseObject).equalTo('objectId', objectId).first(MasterKey);
}

function createChatChannel(req, res) {
    const user   = req.user;
    const params = req.params;
    const users  = req.params.users;

    if (!user) {
        return res.error('Not Authorized');
    }

    if (!users) {
        return res.error('Not users');
    }

    users.push(user.id);

    console.log(users)

    // Define new Parse Object in memory
    let channel = new ParseObject();

    if (params.name) {
        channel.set('name', params.name);
    }

    channel.set('usersIds', users);

    new Parse.Promise.when(users.map(user => User.get(user)))
        .then(users => {
            users.map(user => channel.relation('users').add(user))
            return new Parse.Promise.when(users.map(user => UserData.getByUser(user)))
        })
        .then(users => users.map(user => channel.relation('profiles').add(user)))
        .then(() => channel.save())
        .then(res.success)
        .catch(res.error);

}

function getChatChannel(req, res) {
    console.log('get channel');
    const user = req.user;

    console.log('user', user);


    // Multi Promise
    get(req.params.channelId).then(_channel => {

        new Parse.Query(ChatMessage)
            .descending('createdAt')
            .equalTo('channel', _channel)
            .include('user')
            .first(MasterKey)
            .then(message => {

                let obj = {
                    id:        _channel.id,
                    createdAt: _channel.createdAt,
                    updatedAt: _channel.updatedAt,
                    profiles:  [],
                    users:     [],
                    message:   message,
                    obj:       _channel
                };
                console.log('obj', obj);

                _channel.relation('users').query().find(MasterKey).then(_users => {
                    // obj.users = _.filter(_users, _user => user.id != _user.id);
                    obj.users = _users.map(user => User.parseUser(user));

                    console.log('obj -- final', obj);
                    res.success(obj);

                }).catch(res.error);

            });

    }).catch(res.error);
}

function getChatChannels(req, res) {
    console.log('get channel');
    const user = req.user;

    console.log('user', user);

    new Parse.Query(ParseObject)
        .containedIn('users', [user])
        .find(MasterKey)
        .then(_data => {

            let _result = [];

            if (!_data || _data.length < 1) {
                res.success(_result);
            }

            let cb = _.after(_data.length, () => {
                res.success(_result);
            });

            _.each(_data, _channel => {
                let obj = {
                    id:        _channel.id,
                    _id:       _channel.id,
                    createdAt: _channel.createdAt,
                    updatedAt: _channel.updatedAt,
                    profiles:  [],
                    users:     [],
                    message:   null,
                    obj:       _channel
                };
                console.log('obj', obj);

                _channel.relation('users').query().find(MasterKey).then(_users => {
                    //obj.users = _.filter(_users, _user => user.id != _user.id);
                    obj.users = _.map(_users, user => require('../class/User').parseUser(user));

                    new Parse.Query(ChatMessage)
                        .descending('createdAt')
                        .equalTo('channel', _channel)
                        .include('user')
                        .first(MasterKey)
                        .then(message => {
                            if (message) {
                                obj.message   = message;
                                obj.createdAt = message.createdAt;
                            }
                            console.log('obj -- final', obj);
                            _result.push(obj);
                            cb();
                        }).catch(error => {
                        console.log('not message', error);
                        _result.push(obj);
                        cb();
                    }).catch(res.error);

                }).catch(res.error);
            });
        }).catch(res.error);
}