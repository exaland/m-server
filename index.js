'use strict';
const express        = require('express');
const ParseServer    = require('parse-server').ParseServer;
const path           = require('path');
const ParseDashboard = require('parse-dashboard');
const FSFilesAdapter = require('parse-server-fs-adapter');
const S3Adapter      = require('parse-server').S3Adapter;
const fs             = require('fs');
const cors           = require('cors');

// Parse configuration
const PORT            = process.env.PORT || 4040;
const DATABASE_URI    = process.env.MONGO_URL || process.env.DATABASE_URI || process.env.MONGOLAB_URI || process.env.MONGODB_URI || 'mongodb://heroku_b2bqs7tf:fletekbphl10m0alc6ff3u5bod@ds153669.mlab.com:53669/heroku_b2bqs7tf';
const SERVER_URL      = process.env.SERVER_URL || 'https://farmbserv.herokuapp.com/parse';
const APP_ID          = process.env.APP_ID || 'fde3a43c-8f25-44e6-8aa8-3923d78338f1';
const MASTER_KEY      = process.env.MASTER_KEY || 'f1pwD8yE9hRFQrlFXA3SUosh9lgSAATT';
const APP_NAME        = process.env.APP_NAME || 'FarmBooth';
const PARSE_MOUNT     = process.env.PARSE_MOUNT || '/parse';
const CLOUD_CODE_MAIN = process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js';
const REDIS_URL       = process.env.REDIS_URL;

const FIREBASE_SENDER_ID  = process.env.FIREBASE_SENDER_ID;
const FIREBASE_API_KEY     = process.env.FIREBASE_API_KEY;

// Database Ecosystem file
if (!DATABASE_URI) {
    console.log('DATABASE_URI not specified, falling back to localhost.');
}

let ServerConfig = {
    databaseURI             : DATABASE_URI,
    cloud                   : CLOUD_CODE_MAIN,
    appId                   : APP_ID,
    javascriptKey           : JAVASCRIPT_KEY,
    clientKey               : CLIENT_KEY,
    masterKey               : MASTER_KEY,
    serverURL               : SERVER_URL,
    publicServerURL         : SERVER_URL,
    appName                 : APP_NAME,
    verifyUserEmails        : false,
    enableAnonymousUsers    : false,
    allowClientClassCreation: true,
    maxUploadSize           : '20mb',
    liveQuery               : {
        classNames: LIVEQUERY_CLASSNAMES,
    },
};

if (REDIS_URL) {
    ServerConfig.liveQuery['redisURL'] = REDIS_URL;
}

if (FIREBASE_SENDER_ID && FIREBASE_API_KEY) {
    ServerConfig['push'] = {
        android: {
            senderId: FIREBASE_SENDER_ID,
            apiKey  : FIREBASE_API_KEY
        }
    }
}

// File Local
const UPLOAD_LOCAL_PATH = process.env.UPLOAD_LOCAL_PATH;
if (UPLOAD_LOCAL_PATH) {
    ServerConfig.filesAdapter = new FSFilesAdapter({
        filesSubDirectory: UPLOAD_LOCAL_PATH
    });
}

// AWS S3 configuration
const AWS_ACCESS_KEY_ID     = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const BUCKET_NAME           = process.env.BUCKET_NAME;
if (AWS_ACCESS_KEY_ID) {
    ServerConfig.filesAdapter = new S3Adapter(
        AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY,
        BUCKET_NAME, {
            directAccess: true
        }
    );
}

// Mailgun configuration
const MAILGUN_API_KEY      = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN       = process.env.MAILGUN_DOMAIN;
const MAILGUN_FROM_ADDRESS = process.env.MAILGUN_FROM_ADDRESS;
if (MAILGUN_API_KEY) {
    ServerConfig.emailAdapter = {
        module : 'parse-server-simple-mailgun-adapter',
        options: {
            // The address that your emails come from
            fromAddress: MAILGUN_FROM_ADDRESS,
            // Your domain from mailgun.com
            domain     : MAILGUN_DOMAIN,
            // Your API key from mailgun.com
            apiKey     : MAILGUN_API_KEY,

            // Verification email subject
            verificationSubject : 'Please verify your e-mail for %appname%',
            // Verification email body
            verificationBody    : 'Hi,\n\nYou are being asked to confirm the e-mail address %email% with %appname%\n\nClick here to confirm it:\n%link%',
            //OPTIONAL (will send HTML version of email):
            verificationBodyHTML: fs.readFileSync("./email/verificationBody.html", "utf8") || null,

            // Password reset email subject
            passwordResetSubject: 'Password Reset Request for %appname%',
            // Password reset email body
            passwordResetBody   : 'Hi,\n\nYou requested a password reset for %appname%.\n\nClick here to reset it:\n%link%',
            //OPTIONAL (will send HTML version of email):
            //passwordResetBodyHTML: "<!DOCTYPE html><html xmlns=http://www.w3.org/1999/xhtml>........"
        }
    };
}

// Start Parse Server
const api = new ParseServer(ServerConfig);
const app = express();

app.use(cors());

// Serve the Parse API on the /parse URL prefix
app.use(PARSE_MOUNT, api);

app.use(express.static('www'));

app.use((req, res, next) => {
    res.locals.appId     = APP_ID;
    res.locals.serverUrl = SERVER_URL;
    next();
});

app.get('/', (req, res) => res.render('index'));

// Parse Dashboard
const DASHBOARD_URL      = process.env.DASHBOARD_URL || '/dashboard';
const DASHBOARD_USER     = process.env.DASHBOARD_USER || 'admin';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin123';
if (DASHBOARD_USER) {
    const dashboard = new ParseDashboard({
        apps       : [
            {
                appName  : APP_NAME,
                serverURL: SERVER_URL,
                appId    : APP_ID,
                masterKey: MASTER_KEY,
                iconName : 'icon.png'
            }
        ],
        users      : [
            {
                user: DASHBOARD_USER, // Used to log in to your Parse Dashboard
                pass: DASHBOARD_PASSWORD
            }
        ],
        iconsFolder: 'icons'
    }, true);

    // make the Parse Dashboard available at /dashboard
    app.use(DASHBOARD_URL, dashboard);
}

const httpServer = require('http').createServer(app);
httpServer.listen(PORT, () => console.log(ServerConfig));

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
