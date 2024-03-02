#!/bin/bash

# Intermediate CA:
openssl genrsa -out ./myCA/intermediateCA/private/ca_intermediate.key 4096
openssl req -config ./myCA/ca_intermediate.cnf -key ./myCA/intermediateCA/private/ca_intermediate.key -new -sha256 -out ./myCA/intermediateCA/csr/ca_intermediate.csr -subj "/C=SE/ST=Scania/L=Malmo/O=MyOrg/OU=/CN=Intermediate CA"
openssl ca -config ./myCA/ca_root.cnf -extensions v3_intermediate_ca -days 3650 -notext -md sha256 -in ./myCA/intermediateCA/csr/ca_intermediate.csr -out ./myCA/intermediateCA/certs/ca_intermediate.crt

# Create Certificate Bundle / Certificate Chain.
cat ./myCA/intermediateCA/certs/ca_intermediate.crt ./myCA/rootCA/certs/ca.crt > ./myCA/intermediateCA/certs/ca-chain.crt.pem
