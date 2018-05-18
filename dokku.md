# Dokku Digital ocean
https://www.digitalocean.com/community/tutorials/how-to-use-the-digitalocean-dokku-application

# ssh digital ocean
https://www.digitalocean.com/community/tutorials/how-to-use-ssh-keys-with-digitalocean-droplets

cat ~/.ssh/id_rsa.pub | ssh root@[ip_droplet] "cat >> ~/.ssh/authorized_keys"

# zsh terminal theme
sudo apt-get install git-core zsh
wget https://github.com/robbyrussell/oh-my-zsh/raw/master/tools/install.sh -O - | zsh


# Dokku in Digital Ocean
https://www.digitalocean.com/community/tutorials/how-to-use-the-digitalocean-dokku-application

# Dokku Manual
http://dokku.viewdocs.io/dokku/getting-started/installation/

## Plugins
http://dokku.viewdocs.io/dokku/community/plugins/

MongoDB
https://github.com/dokku/dokku-mongo
sudo dokku plugin:install https://github.com/dokku/dokku-mongo.git mongo


## Create Parse Server App
dokku create:app photogram

## Create MongoDB Database and link to app
dokku mongo:create photogram
dokku monto:link photogram photogram

## Set your config

dokku config:set app
SERVER_URL=http://app.host/parse
APP_NAME=App
APP_ID=myAppId
JAVASCRIPT_KEY=PhotogramJavascriptKey
MASTER_KEY=AppMasterKey
MASTER_REST_KEY=APpMasterRestKey

MAILGUN_API_KEY=
MAILGUN_DOMAIN=
MAILGUN_FROM_ADDRESS=

FIREBASE_SENDER_KEY= 
FIREBASE_API_KEY=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
BUCKET_NAME=

# Storage Local
http://dokku.viewdocs.io/dokku~v0.6.3/dokku-storage/

mkdir -p /root/storage/photogram
dokku config:set photogram UPLOAD_LOCAL_PATH=/storage
dokku storage:mount photogram /root/storage/photogram:/app/files
dokku ps:rebuild photogram