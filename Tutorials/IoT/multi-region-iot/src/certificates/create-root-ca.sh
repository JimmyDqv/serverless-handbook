#!/bin/bash

# Root CA:
openssl genrsa -out ./myCA/rootCA/private/ca.key 4096
openssl req -config ./myCA/ca_root.cnf -key ./myCA/rootCA/private/ca.key -new -x509 -days 7300 -sha256 -extensions v3_ca -out ./myCA/rootCA/certs/ca.crt -subj "/C=SE/ST=Scania/L=Malmo/O=MyOrg/OU=/CN=Root CA"