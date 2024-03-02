#!/bin/bash

mkdir -p ./myCA/rootCA/{certs,crl,newcerts,private,csr}
mkdir -p ./myCA/intermediateCA/{certs,crl,newcerts,private,csr}
mkdir -p ./myCA/server/{certs,crl,newcerts,private,csr}
mkdir -p ./myCA/clients/{certs,crl,newcerts,private,csr}

# Needed to keep track of the last serial number that was used to issue a certificate
echo 1000 > ./myCA/rootCA/serial
echo 1000 > ./myCA/intermediateCA/serial

# This is incremented each time a new Certificate Revocation List (CRL) is generated.
echo 0100 > ./myCA/rootCA/crlnumber 
echo 0100 > ./myCA/intermediateCA/crlnumber

# Create index.txt file which is a database of sorts that keeps track of the certificates that have been issued by the CA
touch ./myCA/rootCA/index.txt
touch ./myCA/intermediateCA/index.txt