#!/bin/bash

# Tipai Biodiversity Tracker - Quick Setup Script
# Run this on your Mac to set up the project locally

echo "🌿 Setting up Tipai Biodiversity Tracker..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the TipaiBiodiversityTracker directory"
    echo "   or download the project files first"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "   Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Creating .env file..."
    cat > .env << 'EOF'
VITE_SUPABASE_URL=https://cojowcpaclcqiyrkbhyv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvam93Y3BhY2xjcWl5cmtiaHl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NzQxMTAsImV4cCI6MjA4MDM1MDExMH0.u8zk5LT_-t3ZDvB-sq0nTwVFALRIrGvqAPUi03TJ5BU
VITE_GEMINI_API_KEY=
EOF
    echo "✅ .env file created with Supabase credentials"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start the development server, run:"
echo "   npm run dev"
echo ""
echo "📱 Then open your browser to: http://localhost:5173/"
echo ""
