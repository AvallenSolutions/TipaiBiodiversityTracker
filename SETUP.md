# Tipai Biodiversity Tracker - Setup Guide

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works fine)
- A Google Cloud account with Gemini API access

## Supabase Setup

### 1. Create a New Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in your project details:
   - Name: `tipai-biodiversity-tracker`
   - Database Password: (save this securely)
   - Region: Choose closest to India
4. Wait for the project to be created (~2 minutes)

### 2. Set Up Database Schema

1. In your Supabase project, go to the SQL Editor
2. Copy the entire contents of `supabase-schema.sql` from this repository
3. Paste it into the SQL Editor and click "Run"
4. This will create:
   - Tables: `profiles`, `sightings`
   - Storage buckets: `sighting-photos`, `sighting-audio`
   - Row Level Security policies
   - Triggers and functions

### 3. Get Your Supabase Credentials

1. Go to Project Settings → API
2. Copy:
   - Project URL (looks like `https://xxxxx.supabase.co`)
   - `anon` `public` key

## Google Gemini API Setup

### 1. Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy your API key

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
cd TipaiBiodiversityTracker
npm install
```

### 2. Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_GEMINI_API_KEY=your-gemini-api-key-here
```

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## First Time User Setup

### Creating the First Naturalist Account

Since the first user needs to be a naturalist (admin), you'll need to manually set this in Supabase:

1. Sign up through the app with your email/password
2. Go to Supabase Dashboard → Authentication → Users
3. Find your user and click on it
4. Click "Edit user"
5. In the "Raw User Meta Data" section, add:
```json
{
  "user_role": "naturalist",
  "full_name": "Your Name"
}
```
6. Save changes
7. In the SQL Editor, run:
```sql
UPDATE profiles
SET user_role = 'naturalist', full_name = 'Your Name'
WHERE email = 'your-email@example.com';
```

Now you can log in as a naturalist with full admin access!

## Testing on Mobile Devices

### Testing on Local Network

1. Find your computer's local IP address:
   - Windows: `ipconfig` (look for IPv4 Address)
   - Mac/Linux: `ifconfig` or `ip addr` (look for inet address)

2. Update `vite.config.ts` to allow network access:
```typescript
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  // ... rest of config
})
```

3. Restart dev server: `npm run dev`

4. On your mobile device (connected to same WiFi), visit:
   `http://YOUR_LOCAL_IP:5173`

### Installing as PWA

1. Open the app in Chrome (Android) or Safari (iOS)
2. Look for "Add to Home Screen" or "Install App" option
3. The app will now work offline!

## Production Deployment

### Build for Production

```bash
npm run build
```

This creates optimized files in the `dist/` folder.

### Deploy Options

**Option 1: Vercel (Recommended)**
```bash
npm install -g vercel
vercel
```

**Option 2: Netlify**
1. Connect your Git repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables in Netlify dashboard

**Option 3: Supabase Storage**
- You can host the static files directly in Supabase Storage

### Set Environment Variables in Production

Make sure to add all environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GEMINI_API_KEY) in your deployment platform's settings.

## User Roles

### Naturalist
- Full admin access
- Can view all sightings from all users
- Can edit and delete any sighting
- Can manage users

### Staff
- Can log sightings
- Can view their own sighting history
- Long-term account with email/password

### Guest
- Simple email registration
- Can log sightings during their visit
- Will receive a summary of their sightings via email

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure your `.env` file exists and contains the correct values
- Restart the dev server after changing `.env`

### Camera not working
- Ensure you're using HTTPS (or localhost for development)
- Check browser permissions for camera access
- On mobile, make sure the browser has camera permissions

### GPS not working
- Check browser permissions for location access
- Ensure location services are enabled on the device
- May not work indoors or in areas with poor GPS signal

### Images not uploading
- Check Supabase Storage policies are correctly set up
- Ensure storage buckets `sighting-photos` and `sighting-audio` exist
- Check file size limits (default is 50MB in Supabase)

### Offline sync not working
- IndexedDB must be supported by the browser
- Check browser console for errors
- Clear browser data and try again

## Support

For issues or questions, create an issue in the repository or contact the development team.
