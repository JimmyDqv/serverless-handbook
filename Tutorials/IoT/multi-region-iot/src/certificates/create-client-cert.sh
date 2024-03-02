#!/bin/bash

NAME=$1

if [ -z "$NAME" ]
then
      echo "You must enter a device name!"
      exit 1
fi

openssl genrsa -out ./myCA-2/clients/private/$NAME.key 2048
openssl req -config ./myCA-2/ca_intermediate.cnf -key ./myCA-2/clients/private/$NAME.key -new -sha256 -out ./myCA-2/clients/csr/$NAME.csr -subj "/C=SE/ST=Scania/L=Malmo/O=MyOrg/OU=/CN=$NAME"
openssl ca -config ./myCA-2/ca_intermediate.cnf -extensions usr_cert -days 365 -notext -md sha256 -in ./myCA-2/clients/csr/$NAME.csr -out ./myCA-2/clients/certs/$NAME.crt

cp ./myCA-2/clients/certs/$NAME.crt ./clients
cp ./myCA-2/clients/private/$NAME.key ./clients
