#!/bin/bash

# Aviva Car Insurance Automation Script
# Usage: ./flow_aviva.sh

echo "Starting Aviva Car Insurance automation..."

# Run the Node.js automation script
node -r esbuild-register -r ts-node/register -r tsx/register -r ts-node/esm -r tsx/esm -r ./node_modules/esbuild-register/dist/node-loader.js --loader tsx,ts,tsx,mjs,cjs,mjs flow_aviva.js

echo "Aviva Car Insurance automation completed."