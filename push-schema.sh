#!/bin/bash
# Script to push database schema with automatic answer to prompt

cd /Users/apple/Desktop/hero-factory-marketplace/hero-market

# Use expect to handle the interactive prompt
expect << 'EOF'
set timeout 30
spawn npm run db:push
expect {
    "Do you want to truncate marketplace_users table?" {
        send "\r"
        exp_continue
    }
    "Changes applied" {
        puts "\n✅ Schema push successful!"
        exit 0
    }
    timeout {
        puts "\n⏱️  Timeout waiting for prompt"
        exit 1
    }
    eof {
        puts "\n✅ Process completed"
        exit 0
    }
}
EOF

