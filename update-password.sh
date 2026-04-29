#!/bin/bash
echo "========================================="
echo "Update TiDB Password in .env.local"
echo "========================================="
echo ""
echo "Current password in .env.local: 3nKcgeu00nKCsOmF"
echo ""
echo "To update the password:"
echo "1. Get the correct password from TiDB Cloud Dashboard"
echo "2. Edit .env.local and replace the password in DATABASE_URL"
echo "3. Format: mysql://2PrXrw5SH4HNXii.root:NEW_PASSWORD@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test?ssl={\"rejectUnauthorized\":true}"
echo ""
echo "After updating, run: npm run db:push"

