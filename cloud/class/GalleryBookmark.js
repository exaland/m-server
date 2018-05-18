'use strict';
const _               = require('lodash');
const Image           = require('./../helpers/image');
const User            = require('./../class/User');
const Gallery         = require('./Gallery');
const GalleryBookmark = Parse.Object.extend('GalleryBookmark');
const MasterKey       = {useMasterKey: true};

module.exports = {
    feed:            feed,
    bookmarkGallery: bookmarkGallery,
};

function get(bookmarkId) {
    return new Parse.Query(GalleryBookmark).equalTo(bookmarkId).first(MasterKey);
}

function feed(req, res) {
    const params = req.params;
    const user   = req.user;
    const _page  = req.params.page || 1;
    const _limit = req.params.limit || 24;

    let _query = new Parse.Query(GalleryBookmark);

    if (params.filter) {
        _query.contains('words', params.filter);
    }

    if (params.hashtags) {
        _query.containsAll('hashtags', [params.hashtags]);
    }

    if (params.id) {
        _query.equalTo('objectId', params.id);
    }

    // Search
    let text = params.search;
    if (text && text.length > 0) {
        let toLowerCase = w => w.toLowerCase();
        let words       = text.split(/\b/);
        words           = _.map(words, toLowerCase);

        let stopWords = ['the', 'in', 'and'];
        words         = _.filter(words, w => w.match(/^\w+$/) && !_.includes(stopWords, w));

        let hashtags = text.match(/#.+?\b/g);
        hashtags     = _.map(hashtags, toLowerCase);

        if (words) {
            _query.containsAll('words', [words]);
        }

        if (hashtags) {
            _query.containsAll('hashtags', [hashtags]);
        }
    }

    _query
        .descending('createdAt')
        .limit(_limit)
        .equalTo('user', user)
        .skip((_page * _limit) - _limit)
        .include(['gallery,gallery.user'])
        .find(MasterKey)
        .then(_data => {
            let _result = [];

            if (!_data || !_data.length) {
                res.success([]);
            }

            console.log('qtd', _data.length);
            // After run total queries
            let cb = _.after(_data.length, () => res.success(_result));

            // Each result for execute queires logic
            _.each(_data, _item => {
                // Parse Gallery Object
                let obj = Gallery.parseGallery(_item.get('gallery'));
                console.log('obj', obj);
                // Include obj in array result
                _result.push(obj);
                // Finish query
                cb();
            });

        }).catch(res.error);
}


function bookmarkGallery(req, res, next) {
    const user      = req.user;
    const params    = req.params;
    const galleryId = params.galleryId;

    if (!user) {
        return res.error('Not Authorized');
    }

    Gallery.get(galleryId).then(_gallery => {

        new Parse.Query(GalleryBookmark)
            .equalTo('user', user)
            .equalTo('gallery', _gallery)
            .first(MasterKey)
            .then(_bookmark => {
                if (_bookmark) {
                    // unbookmark
                    _bookmark.destroy();
                    res.success({bookmark: false})
                } else {
                    // Bookmark
                    let form = {
                        gallery: _gallery,
                        user:    user
                    };
                    new GalleryBookmark()
                        .save(form, MasterKey)
                        .then(() => res.success({bookmark: true}))
                        .catch(res.error);
                }
            })

    })

}

