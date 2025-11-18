#!/bin/bash

echo "=========================================="
echo "Testing all Node.js examples"
echo "=========================================="
echo

cd /Users/yamazaki.yuki/ghq/github.com/kamiazya/web-csv-toolbox/examples

# Test node-main
echo "=========================================="
echo "Test 1: node-main (JavaScript engine)"
echo "=========================================="
cd node-main
pnpm start 2>&1 | head -30
echo
cd ..

# Test node-lite
echo "=========================================="
echo "Test 2: node-lite (WASM sync)"
echo "=========================================="
cd node-lite
pnpm start 2>&1 | head -30
echo
cd ..

# Test node-worker-main
echo "=========================================="
echo "Test 3: node-worker-main (Worker + JS/WASM)"
echo "=========================================="
cd node-worker-main
pnpm start 2>&1 | head -50
echo
cd ..

echo "=========================================="
echo "All Node.js tests complete"
echo "=========================================="
