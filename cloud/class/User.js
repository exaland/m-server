'use strict';
const _               = require('lodash');
const Image           = require('../helpers/image');
const GalleryActivity = require('../class/GalleryActivity');
const UserData        = require('./UserData');
const ParseObject     = Parse.Object.extend('User');
const UserFollow      = Parse.Object.extend('UserFollow');
const Gallery         = Parse.Object.extend('Gallery');
const MasterKey       = {useMasterKey: true};

module.exports = {
    beforeSave:            beforeSave,
    afterSave:             afterSave,
    afterDelete:           afterDelete,
    profile:               profile,
    avatar:                avatar,
    get:                   get,
    createUser:            createUser,
    findUserByEmail:       findUserByEmail,
    findUserByUsername:    findUserByUsername,
    getUsers:              getUsers,
    listUsers:             listUsers,
    updateUser:            updateUser,
    destroyUser:           destroyUser,
    saveFacebookPicture:   saveFacebookPicture,
    follow:                follow,
    isFollow:              isFollow,
    getLikers:             getLikers,
    getFollowers:          getFollowers,
    getFollowing:          getFollowing,
    validateUsername:      validateUsername,
    validateEmail:         validateEmail,
    updateGalleriesTotal:  updateGalleriesTotal,
    incrementFollowers:    incrementFollowers,
    incrementFollowing:    incrementFollowing,
    incrementComment:      incrementComment,
    decrementComment:      decrementComment,
    incrementAlbumGallery: incrementAlbumGallery,
    decrementAlbumGallery: decrementAlbumGallery,
    parseUser:             parseUser,
    updateAvatar:          updateAvatar,
};

function beforeSave(req, res) {
    var user = req.object;

    if (user.existed() && user.dirty('roleName')) {
        return res.error('Role cannot be changed');
    }

    if (!user.get('roleName')) {
        user.set({roleName: 'User'});
    }

    if (!user.get('username')) {
        let username = user.get('email');
        if (username) {
            username = _.split(username, '@');
            user.set('username', username[0]);
        }
    }

    //https://parse.com/docs/js/guide#performance-implement-efficient-searches
    let toLowerCase = w => w.toLowerCase();
    let words       = _.split(user.get('name'), /\b/);
    words           = _.map(words, toLowerCase);
    words           = _.map(words, (item) => {
        if (item) return item;
    });

    // add username
    words.push(user.get('username'));
    user.set('words', words);

    res.success();

}

function afterSave(req, res) {
    var user           = req.object;
    var userRequesting = req.user;

    console.log('user.existed', user.existed());

    UserData.getByUser(user).then(userData => {

        if (userData) {
            userData.set('name', user.get('name'));
            userData.set('status', user.get('status'));
            userData.set('username', user.get('username'));
            userData.set('photo', user.get('photo'));

        } else {

            // if a new user
            const roleACL = new Parse.ACL();
            roleACL.setPublicReadAccess(true);
            roleACL.setWriteAccess(user, true);

            userData = new Parse.Object('UserData', {
                user:     user,
                ACL:      roleACL,
                name:     user.get('name'),
                username: user.get('username'),
                status:   user.get('status'),
                photo:    user.get('photo')
            });

            // Define type increment
            userData.increment('galleriesTotal', 0);
            userData.increment('followersTotal', 0);
            userData.increment('followingsTotal', 0);
            userData.increment('albumTotal', 0);

        }
        userData.save(null, MasterKey);
    });

    if (!user.existed()) {

        new Parse.Query(Parse.Role)
            .equalTo('name', 'Admin')
            .equalTo('users', userRequesting)
            .first().then(function (isAdmin) {

            if (!isAdmin && user.get('roleName') === 'Admin') {
                return Parse.Promise.error(new Parse.Error(1, 'Not Authorized'));
            }

            let roleName = user.get('roleName') || 'User';
            return new Parse.Query(Parse.Role).equalTo('name', roleName).first();
        }).then((role) => {

            if (!role) {
                return Parse.Promise.error(new Parse.Error(1, 'Role not found'));
            }

            role.getUsers().add(user);
            return role.save();
        }).then(() => {
            console.log('success');
        }).catch((error) => {
            console.error('Got an error ' + error.code + ' : ' + error.message);
        });
    }
}

function afterDelete(req, res) {
    res.success();
}

function getLikers(req, res) {
    const params = req.params;

    let objParse;

    console.log('getLikers', params);

    new Parse.Query('Gallery')
        .get(params.galleryId)
        .then(gallery => {

            gallery
                .relation('likes')
                .query()
                .find(MasterKey)
                .then(data => {

                    let _result = [];

                    if (!data.length) {
                        res.success(_result);
                    }

                    let cb = _.after(data.length, () => {
                        res.success(_result);
                    });

                    _.each(data, user => {

                        // User Data
                        new Parse.Query('UserData')
                            .equalTo('user', user)
                            .first(MasterKey)
                            .then(userData => {

                                new Parse.Query('Gallery')
                                    .equalTo('user', user)
                                    .limit(3)
                                    .descending('createdAt')
                                    .find()
                                    .then(galleries => {

                                        let profile       = UserData.parseUserData(userData);
                                        profile.isFollow  = isFollow ? true : false;
                                        profile.galleries = galleries.map(item => Gallery.parseGallery(item));
                                        _result.push(profile);
                                        cb();
                                    });

                            }, res.error);
                    });
                    res.success(users);
                });

        }, error => res.error);
}
function getFollowers(req, res) {
    const params = req.params;

    if (params.username) {
        new Parse.Query(ParseObject)
            .equalTo('username', params.username)
            .first(MasterKey)
            .then(user => {
                new Parse.Query(UserFollow)
                    .equalTo('to', user)
                    .include('user')
                    .find(MasterKey)
                    .then(data => {

                        let _result = [];

                        if (!data.length) {
                            res.success(_result);
                        }

                        let cb = _.after(data.length, () => {
                            res.success(_result);
                        });

                        _.each(data, user => {

                            // User Data
                            new Parse.Query('UserData')
                                .equalTo('user', user.attributes.from)
                                .first(MasterKey)
                                .then(userData => {

                                    new Parse.Query('Gallery')
                                        .equalTo('user', user.attributes.from)
                                        .limit(3)
                                        .descending('createdAt')
                                        .find()
                                        .then(galleries => {

                                            let profile       = UserData.parseUserData(userData);
                                            profile.isFollow  = isFollow ? true : false;
                                            profile.galleries = galleries.map(item => Gallery.parseGallery(item));
                                            console.log('profile', profile);
                                            _result.push(profile);
                                            cb();
                                        });

                                }, res.error);
                        });

                    }, res.error);

            });
    } else {
        new Parse.Query(UserFollow)
            .equalTo('to', req.user)
            .include('user')
            .find(MasterKey)
            .then(data => {

                let _result = [];

                if (!data.length) {
                    res.success(_result);
                }

                let cb = _.after(data.length, () => {
                    res.success(_result);
                });

                _.each(data, user => {

                    // User Data
                    new Parse.Query('UserData')
                        .equalTo('user', user.attributes.to)
                        .first(MasterKey)
                        .then(userData => {

                            new Parse.Query('Gallery')
                                .equalTo('user', user.attributes.to)
                                .limit(3)
                                .descending('createdAt')
                                .find()
                                .then(galleries => {

                                    let profile       = UserData.parseUserData(userData);
                                    profile.isFollow  = isFollow ? true : false;
                                    profile.galleries = galleries.map(item => Gallery.parseGallery(item));
                                    console.log('profile', profile);
                                    _result.push(profile);
                                    cb();
                                });

                        }, res.error);
                });

            }, res.error);

    }
}

function getFollowing(req, res) {
    const params = req.params;

    findUsername(params.username)
        .then(user => {
            new Parse.Query(UserFollow)
                .equalTo('from', user)
                .include(['user'])
                .find(MasterKey)
                .then(userFollows => {

                    let _result = [];

                    if (!userFollows.length) res.success(_result);

                    let cb = _.after(userFollows.length, () => res.success(_result));

                    _.each(userFollows, userFollow => {

                        // User Data
                        new Parse.Query('UserData')
                            .equalTo('user', userFollow.get('to'))
                            .first(MasterKey)
                            .then(userData => {
                                if (userData) {
                                    let profile = UserData.parseUserData(userData);
                                    _result.push(profile);
                                    cb();
                                }
                            }).catch(res.error);
                    });

                }).catch(res.error);

        });
}

function follow(req, res) {
    const params = req.params;
    if (!req.user) {
        return res.error('Not Authorized');
    }

    if (!params.userId) {
        return res.error('Not Authorized');
    }

    get(params.userId)
        .then(toUser => {

            new Parse.Query(UserFollow)
                .equalTo('from', req.user)
                .equalTo('to', toUser)
                .first(MasterKey)
                .then(isFollow => {

                    if (isFollow) {
                        // unfollow
                        Parse.Promise.when([
                            isFollow.destroy(),
                            decrementFollowers(toUser),
                            decrementFollowing(req.user),
                        ]).then(data => res.success('unfollow'))
                            .catch(res.error);
                    } else {

                        // follow
                        let activity = {
                            action:   'is following you',
                            fromUser: req.user,
                            toUser:   toUser,
                        };
                        new UserFollow()
                            .set('from', req.user)
                            .set('to', toUser)
                            .set('date', Date())
                            .save(MasterKey)
                            .then(data => {
                                return Parse.Promise.when([
                                    incrementFollowing(req.user),
                                    incrementFollowers(toUser),
                                    GalleryActivity.create(activity)
                                ]);
                            }).then(data => {
                            console.log('data2', data);
                            res.success('follow');
                        }).catch(res.error);
                    }

                }).catch(res.error);

        }).catch(res.error);

}

function isFollow(req, res) {
    const user   = req.user;
    const params = req.params;
    if (!user) {
        return res.error('Not Authorized');
    }

    if (!params.toUser) {
        return res.error('Not Authorized');
    }
    new Parse.Query(UserFollow)
        .equalTo('from', req.user)
        .equalTo('to', params.to)
        .count(data => {
            if (data > 0) {
                res.success('following');
            } else {
                res.error('not following');
            }
        }).catch(error => {
        res.error('not following');
    });
}

function profile(req, res) {
    const params   = req.params;
    const user     = req.user;
    const username = params.username;

    if (!user) {
        return res.error('Not Authorized');
    }

    if (!username) {
        return res.error('Username required');
    }

    findUsername(username)
        .then(UserData.getByUser)
        .then(toUser => {
            new Parse.Query('UserFollow')
                .equalTo('from', req.user)
                .equalTo('to', toUser)
                .count(MasterKey)
                .then(isFollow => {
                    let profile = UserData.parseUserData(toUser);
                    profile['isFollow'] = isFollow ? true : false;
                    res.success(profile);
                }).catch(res.error);
        }).catch(res.error);
}

function get(userId) {
    return new Parse.Query(Parse.User).equalTo('objectId', userId).first(MasterKey);
}

function avatar(obj) {
    if (obj.facebookimg) {
        return obj.facebookimg;
    } else {
        return obj.img ? obj.img._url : 'img/user.png';
    }
}

function createUser(req, res, next) {
    var data = req.params;
    var user = req.user;

    new Parse.Query(Parse.Role)
        .equalTo('name', 'Admin')
        .equalTo('users', user)
        .first().then(function (adminRole) {

        if (!adminRole) {
            return res.error('Not Authorized');
        } else {

            new Parse.User()
                .set('name', data.name)
                .set('username', data.username)
                .set('email', data.email)
                .set('gender', data.password)
                .set('password', data.password)
                .set('photo', data.photo)
                .set('roleName', data.roleName)
                .signUp()
                .then(objUser => {
                    objUser.setACL(new Parse.ACL(objUser));
                    objUser.save(null, MasterKey);
                    res.success(objUser);
                }, error => res.error(error));
        }
    }, error => res.error(error.message));
}

function findUsername(username) {
    return new Parse.Query(Parse.User).equalTo('username', username).first(MasterKey);
}

function findUserByUsername(req, res, next) {
    const username = req.params.username;

    findUsername(username)
        .then(UserData.getByUser)
        .then(res.success)
        .catch(res.error);
}

function findUserByEmail(req, res, next) {
    new Parse.Query(Parse.User)
        .equalTo('email', req.params.email)
        .first(MasterKey)
        .then(user => res.success(parseUser(user)))
        .catch(res.error);
}

function getUsers(req, res, next) {
    const params = req.params;
    const user   = req.user;
    new Parse.Query(Parse.Role)
        .equalTo('name', 'Admin')
        .equalTo('users', user)
        .first(MasterKey)
        .then(adminRole => {

            if (!adminRole) {
                return res.error('Not Authorized');
            }

            const query = new Parse.Query(Parse.User);

            if (params.filter != '') {
                query.contains('email', params.filter);
            }

            query.descending('createdAt');
            query.limit(params.limit);
            query.skip((params.page * params.limit) - params.limit);

            return Parse.Promise.when(query.find(MasterKey), query.count(MasterKey));
        })
        .then((users, total) => res.success({
            users: users,
            total: total
        }), error => res.error(error.message));
}

function listUsers(req, res, next) {
    const _params = req.params;
    const _page   = req.params.page || 1;
    const _limit  = req.params.limit || 24;

    let _query = new Parse.Query(Parse.User);

    let text = _params.search;
    if (text && text.length > 0) {
        let toLowerCase = w => w.toLowerCase();
        var words       = _params.search.split(/\b/);
        words           = _.map(words, toLowerCase);
        let stopWords   = ['the', 'in', 'and'];
        words           = _.filter(words, w => w.match(/^\w+$/) && !_.includes(stopWords, w));

        if (words) {
            _query.containsAll('words', words);
        }

    }
    console.log('part 1');

    _query
        .descending('createdAt')
        .notContainedIn('objectId', [req.user.id])
        .notContainedIn('roleName', ['admin', 'Admin'])
        .limit(_limit)
        .skip((_page * _limit) - _limit)
        .find(MasterKey)
        .then(data => {

            console.log('part 1');
            let _result = [];
            // If none result
            if (!data.length) res.success(_result);
            // When after result
            let cb = _.after(data.length, () => res.success(_result));
            // Each results query
            _.each(data, user => {
                //  Is Follow query
                new Parse.Query(UserFollow)
                    .equalTo('from', req.user)
                    .equalTo('to', user)
                    .count()
                    .then(isFollow => {

                        new Parse.Query('Gallery')
                            .equalTo('user', user)
                            .limit(3)
                            .descending('createdAt')
                            .find()
                            .then(galleries => {
                                let profile       = parseUser(user);
                                profile.isFollow  = isFollow ? true : false;
                                profile.galleries = galleries.map(item => require('../class/Gallery').parseGallery(item));
                                _result.push(profile);
                                cb();
                            }).catch(res.error);
                    }).catch(res.error);
            });
        }).catch(res.error);
}

function updateAvatar(req, res) {
    const params = req.params;
    const user   = req.user;
    const base64 = params.photo;

    console.log('user', user);
    Image.saveImage(base64).then(_photo => {
        user.set('photo', _photo)
        user.save(null, MasterKey).then(res.success).catch(res.error);
    }).catch(res.error);
}

function updateUser(req, res, next) {
    var data = req.params;
    var user = req.user;

    new Parse.Query(Parse.Role)
        .equalTo('name', 'Admin')
        .equalTo('users', user)
        .first().then(function (adminRole) {

        if (!adminRole) {
            return res.error('Not Authorized');
        }

        return new Parse.Query(Parse.User)
            .equalTo('objectId', data.id)
            .first(MasterKey);
    }).then(objUser => {

        objUser.set('name', data.name);
        objUser.set('username', data.email);
        objUser.set('status', data.status);
        objUser.set('gender', data.gender);
        objUser.set('email', data.email);

        if (data.photo) {
            objUser.set('photo', data.photo);
        }

        if (data.password) {
            objUser.set('password', data.password);
        }

        return objUser.save(null, MasterKey);
    }).then(success => res.success(success), error => res.error(error.message));
}

function destroyUser(req, res, next) {
    var params = req.params;
    var user   = req.user;

    new Parse.Query(Parse.Role)
        .equalTo('name', 'Admin')
        .equalTo('users', user)
        .first().then(adminRole => {

        if (!adminRole) {
            return res.error('Not Authorized');
        }

        return new Parse.Query(Parse.User)
            .equalTo('objectId', params.id)
            .first(MasterKey);
    }).then(objUser => {

        if (!objUser) {
            return res.error('User not found');
        }

        return objUser.destroy(MasterKey);
    }).then(success => res.success(success), error => res.error(error.message));
}

function saveFacebookPicture(req, res, next) {
    const user = req.user;

    if (!user) {
        return res.error('Not Authorized');
    }

    let facebook = user.get('authData').facebook.id;

    if (!facebook) {
        return res.error('Not logged with facebook');
    }

    let profilePictureUrl = 'https://graph.facebook.com/' + facebook + '/picture';
    let photoFile;
    let params            = {
        url:             profilePictureUrl,
        followRedirects: true,
        params:          {type: 'large'}
    };

    return Parse.Cloud.httpRequest(params)
        .then(httpResponse => Image.saveImage(httpResponse.buffer.toString('base64')))
        .then(photo => photoFile = photo)
        .then(() => user.set({'photo': photoFile}).save(null, {sessionToken: user.getSessionToken()}))
        .then(() => UserData.getByUser(user))
        .then(UserData => UserData.set('photo', photoFile).save(null, MasterKey))
        .then(() => parseUser(user))
        .then(res.success)
        .catch(error => res.error(error.message));
}

function validateUsername(req, res) {
    new Parse.Query(Parse.User)
        .equalTo('username', req.params.username)
        .first(MasterKey)
        .then(count => {
            console.log('validateUsername', count);
            if (count) {
                res.error(false);
            } else {
                res.success(true);
            }
        }, res.error);
}

function validateEmail(req, res) {
    new Parse.Query(Parse.User)
        .equalTo('email', req.params.email)
        .first(MasterKey)
        .then(count => {
            console.log('validateEmail', count);
            if (count) {
                res.error(false);
            } else {
                res.success(true);
            }
        }, res.error);
}

// Album Gallery
function incrementAlbumGallery(user) {
    return UserData.getByUser(user).then(user => user.increment('albumTotal', 1).save(null, MasterKey));
}

function decrementAlbumGallery(user) {
    return UserData.getByUser(user).then(user => user.increment('albumTotal', 1).save(null, MasterKey));
}

// Gallery
function updateGalleriesTotal(user, galleriesTotal) {
    return UserData.getByUser(user).then(userData => userData.set('galleriesTotal', galleriesTotal).save(null, MasterKey));
}

//seguidores
function incrementFollowers(user) {
    return UserData.getByUser(user).then(user => user.increment('followersTotal', 1).save(null, MasterKey));
}
function decrementFollowers(user) {
    return UserData.getByUser(user).then(user => user.increment('followersTotal', -1).save(null, MasterKey));
}
//seguindo
function incrementFollowing(user) {
    return UserData.getByUser(user).then(userData => userData.increment('followingsTotal', 1).save(null, MasterKey));
}
function decrementFollowing(user) {
    return UserData.getByUser(user).then(user => user.increment('followingsTotal', -1).save(null, MasterKey));
}
// comment
function incrementComment(user) {
    return UserData.getByUser(user).then(user => user.increment('commentsTotal', 1).save(null, MasterKey));
}

function decrementComment(user) {
    return UserData.getByUser(user).then(user => user.increment('commentsTotal', -1).save(null, MasterKey));
}

function parseUser(user) {
    let obj = {
        id:              user.id,
        _id:             user.id,
        name:            user.get('name'),
        email:           user.get('email'),
        username:        user.get('username'),
        followersTotal:  user.get('followersTotal') || 0,
        followingsTotal: user.get('followingsTotal') || 0,
        galleriesTotal:  user.get('galleriesTotal') || 0,
        status:          user.get('status'),
        isFollow:        false,
        galleries:       [],
        createdAt:       user.createdAt,
        market:          user.get('market'),
        isMember:        user.get('isMember'),
        lat:             user.get('lat'),
        long:            user.get('long'),
        latestPost:      user.get('latestPost'),
        vendor:          user.get('vendor'),
        views:           user.get('views'),
    };
    if (user.get('photo')) {
        obj.photo = user.get('photo').url();
    }
    return obj;
}


