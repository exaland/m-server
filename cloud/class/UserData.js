'use strict';
const _           = require('lodash');
const ParseObject = Parse.Object.extend('UserData');
const MasterKey   = {useMasterKey: true};

module.exports = {
    get:           get,
    getByUser:     getByUser,
    parseUserData: parseUserData
}

function get(objectId) {
    return new Parse.Query(ParseObject).equalTo('objectId', objectId).first(MasterKey);
}

function getByUser(user) {
    return new Parse.Query(ParseObject).equalTo('user', user).first(MasterKey);
}

function parseUserData(_userData) {
    if (_userData) {
        let obj = {
            id:              _userData.get('user').id,
            _id:             _userData.get('user').id,
            name:            _userData.get('name'),
            email:           _userData.get('email'),
            username:        _userData.get('username'),
            followersTotal:  _userData.get('followersTotal'),
            followingsTotal: _userData.get('followingsTotal'),
            galleriesTotal:  _userData.get('galleriesTotal'),
            status:          _userData.get('status'),
            isFollow:        false,
            galleries:       [],
            createdAt:       _userData.createdAt,
            market:          _userData.get('market'),
            isMember:        _userData.get('isMember'),
            lat:             _userData.get('lat'),
            long:            _userData.get('long'),
            latestPost:      _userData.get('latestPost'),
            vendor:          _userData.get('vendor'),
            views:           _userData.get('views'),
        };
        if (_userData.get('photo')) {
            obj.photo = _userData.get('photo').url();
        }
        return obj;
    }
}