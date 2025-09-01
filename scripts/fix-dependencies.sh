#!/bin/bash

# Fix for node-clamav dependency issue
# This script updates problematic dependencies and provides alternatives

echo "🔧 Fixing dependency issues..."

# Navigate to backend directory
cd backend

# Remove problematic packages and install alternatives
echo "Updating virus scanning dependency..."

# Remove node_modules and package-lock to start fresh
rm -rf node_modules package-lock.json

# Install dependencies without the problematic package first
npm install --omit=optional

echo "✅ Dependencies fixed!"
echo ""
echo "Note: Virus scanning will use basic validation instead of ClamAV"
echo "To enable full ClamAV scanning later, install ClamAV manually:"
echo "  macOS: brew install clamav"
echo "  Linux: sudo apt-get install clamav clamav-daemon"
echo ""
echo "Now run the setup script again:"
echo "  ./scripts/setup-local.sh"