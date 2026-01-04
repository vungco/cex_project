#!/bin/bash

# Script to test candle queues with random data every 2 seconds
echo "🚀 Starting candle queue test script..."
echo "Press Ctrl+C to stop"
echo ""

# Counter for tracking calls
counter=1

while true; do
    # Generate random volume between 100 and 10000 (using RANDOM % range + min)
    volume_int=$((RANDOM % 9900 + 100))
    volume_dec=$((RANDOM % 100))
    volume="${volume_int}.${volume_dec}"
    
    # Generate random price between 0.0001 and 0.01 (using simpler approach)
    price_base=$((RANDOM % 99 + 1))  # 1-99
    price_decimal=$((RANDOM % 10000 + 1))  # 1-9999
    price="0.$(printf "%04d" $price_decimal)"
    
    # Current timestamp for logging
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$counter] $timestamp - Testing with volume: $volume, price: $price"
    
    # Create JSON payload to avoid escaping issues
    json_payload=$(cat <<EOF
{
  "tokenId": "6dcc0dc0-8025-4ed5-8316-fdb61a93cb14",
  "volume": "$volume",
  "price": $price
}
EOF
)
    
    # Make the curl request
    curl -X POST 'https://bpump-api.bitnetchain.io/api/misc/test-candle-queues' \
      -H "Content-Type: application/json" \
      -d "$json_payload" \
      --silent --show-error
    
    echo ""
    echo "---"
    
    # Increment counter
    ((counter++))
    
    # Wait 2 seconds before next call
    sleep 5
done 