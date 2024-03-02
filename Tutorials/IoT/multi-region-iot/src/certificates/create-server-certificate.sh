#!/bin/bash

# Server Certificate
openssl genrsa -out ./myCA/server/private/iot.example.com.key 2048
openssl req -config ./myCA/ca_intermediate.cnf -key ./myCA/server/private/iot.example.com.key -new -sha256 -out ./myCA/server/csr/iot.example.com.csr -subj "/C=SE/ST=Scania/L=Malmo/O=MyOrg/OU=/CN=iot.example.com"
openssl ca -config ./myCA/ca_intermediate.cnf -extensions server_cert -days 375 -notext -md sha256 -in ./myCA/server/csr/iot.example.com.csr -out ./myCA/server/certs/iot.example.com.crt
