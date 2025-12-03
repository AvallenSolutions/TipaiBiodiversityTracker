# Tipai Biodiversity Tracker

A mobile-first Progressive Web App (PWA) for logging and tracking biodiversity sightings at the Tipai property. Built with React, TypeScript, Supabase, and AI-powered species identification using Google Gemini.

## 🌟 Features

### Core Functionality
- **📱 Mobile-First PWA**: Installable on Android and iOS devices, works offline
- **👥 Three User Roles**:
  - **Naturalist**: Full admin access to view and manage all sightings
  - **Staff**: Long-term accounts with email/password login
  - **Guest**: Simple email registration for visitors

### Sighting Logging
- **📸 Media Capture**: Take photos/videos or record audio directly in the app
- **🤖 AI Species Identification**: Powered by Google Gemini 2.0 Flash for automatic species recognition
- **📍 GPS Tracking**: Automatic location capture with coordinates and accuracy
- **🗂️ 7 Categories**: Mammal, Bird, Lizard, Insect, Plant, Trace, Fungi
- **📝 Quick Notes**: Add observations and additional details

### Data Management
- **💾 Offline Storage**: Uses IndexedDB to store sightings when offline
- **🔄 Auto-Sync**: Automatically syncs to cloud database when connection is restored
- **🔐 Unique IDs**: Each sighting gets a UUID + SHA-256 hash for verification
- **📊 Dashboard**: View all sightings filtered by category, date, location

### Technical Features
- **🔒 Row Level Security**: Supabase RLS ensures data privacy
- **🌐 Real-time Updates**: See sightings from all users (Naturalist role)
- **📦 Cloud Storage**: Photos and audio stored in Supabase Storage
- **🎨 Beautiful UI**: TailwindCSS with custom Tipai green theme

## 🏗️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **AI**: Google Gemini 2.0 Flash API
- **PWA**: Vite PWA Plugin + Service Workers
- **Offline Storage**: IndexedDB (via idb library)
- **Routing**: React Router v6
- **Icons**: Lucide React

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- A Supabase account (free tier works)
- A Google Cloud account with Gemini API access

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/AvallenSolutions/TipaiBiodiversityTracker.git
cd TipaiBiodiversityTracker
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```

4. **Set up Supabase database**
- Go to your Supabase project dashboard
- Open the SQL Editor
- Copy and paste the entire contents of `supabase-schema.sql`
- Run the SQL to create tables, policies, and storage buckets

5. **Create your first Naturalist account**
- Run the app: `npm run dev`
- Sign up through the app
- Go to Supabase Dashboard → Authentication → Users
- Find your user and update the `raw_user_meta_data` to include:
```json
{
  "user_role": "naturalist",
  "full_name": "Your Name"
}
```
- In SQL Editor, run:
```sql
UPDATE profiles
SET user_role = 'naturalist', full_name = 'Your Name'
WHERE email = 'your-email@example.com';
```

6. **Start the development server**
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## 📖 Detailed Setup Guide

For comprehensive setup instructions including mobile testing, production deployment, and troubleshooting, see [SETUP.md](./SETUP.md).

## 🎯 Usage

### Logging a Sighting

1. **Log in** with your account (Naturalist/Staff/Guest)
2. Click **"New Sighting"** button
3. **Select category** (Mammal, Bird, etc.)
4. **Take photo/video or record audio** (optional)
5. **Review details**:
   - GPS coordinates are captured automatically
   - AI will identify the species from the photo
   - Add notes if needed
6. **Save** - Works offline! Will sync when back online

### Viewing Sightings

- Dashboard shows all your sightings (or all sightings for Naturalists)
- Filter by category
- See AI identification results and confidence scores
- View photos, location coordinates, and timestamps

### Offline Mode

- All sightings are saved locally when offline
- Pending sync counter shows how many need uploading
- Auto-syncs when connection is restored
- Manual sync button available

## 🗂️ Project Structure

```
TipaiBiodiversityTracker/
├── public/               # Static assets
├── src/
│   ├── components/       # React components
│   │   ├── Auth/        # Login and authentication
│   │   └── Sighting/    # Category selection, media capture, form
│   ├── contexts/        # React contexts (AuthContext)
│   ├── lib/             # Libraries (Supabase client, IndexedDB)
│   ├── pages/           # Page components (Dashboard, NewSighting)
│   ├── services/        # Business logic (sync service)
│   ├── types/           # TypeScript types
│   ├── utils/           # Utilities (crypto, geolocation, Gemini)
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── supabase-schema.sql  # Database schema
├── SETUP.md             # Detailed setup guide
└── package.json
```

## 🔑 Key Features Explained

### UUID + Hash Verification

Each sighting gets a unique identifier plus a SHA-256 hash:
```typescript
hash = SHA256(id + userId + timestamp + latitude + longitude)
```
This creates a non-replicable, traceable record that can be verified for integrity.

### AI Species Identification

Uses Google Gemini 2.0 Flash with multimodal input:
- Sends photo to Gemini with category context
- Receives species name, common name, confidence score, and description
- Optimized for Indian wildlife

### Offline-First Architecture

1. Sightings saved to IndexedDB when offline
2. Photos/audio stored as Blobs in IndexedDB
3. Auto-sync when connection detected
4. Shows pending sync count in dashboard

### Progressive Web App (PWA)

- Installable on home screen (Android/iOS)
- Works offline after first visit
- Push notifications (can be added)
- App-like experience

## 🔒 Security

- **Row Level Security (RLS)**: Users can only see their own sightings (except Naturalists)
- **Secure Auth**: Supabase handles authentication and password management
- **Storage Policies**: Users can only upload/view their own media (except Naturalists)
- **Environment Variables**: API keys stored securely in `.env` (not committed to git)

## 🎨 User Roles & Permissions

| Feature | Guest | Staff | Naturalist |
|---------|-------|-------|------------|
| Log sightings | ✅ | ✅ | ✅ |
| View own sightings | ✅ | ✅ | ✅ |
| View all sightings | ❌ | ❌ | ✅ |
| Edit sightings | ❌ | ❌ | ✅ |
| Delete sightings | ❌ | ❌ | ✅ |
| Long-term account | ❌ | ✅ | ✅ |

## 🚢 Deployment

### Build for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` folder.

### Deploy to Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

### Deploy to Netlify

1. Connect your Git repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables

## 🐛 Troubleshooting

### Camera not working
- Ensure HTTPS is enabled (or use localhost for development)
- Check browser permissions for camera
- On mobile, ensure the browser has camera permissions in device settings

### GPS not working
- Check browser/device location permissions
- Enable location services on device
- May not work well indoors

### Offline sync not working
- Check browser console for errors
- Ensure IndexedDB is supported
- Clear browser data and try again

### Gemini API errors
- Verify API key is correct in `.env`
- Check API quota limits in Google Cloud Console
- Ensure billing is enabled (free tier has limits)

## 📱 Browser Support

- **Chrome/Edge**: Full support ✅
- **Safari (iOS)**: Full support ✅
- **Firefox**: Full support ✅
- **Opera**: Full support ✅

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software owned by Tipai Property.

## 👥 Authors

- **Development**: Claude AI Assistant
- **Product Owner**: Tipai Team

## 🙏 Acknowledgments

- Supabase for the excellent backend platform
- Google for Gemini AI API
- The React and Vite teams
- TailwindCSS for beautiful styling
- All the open-source libraries that made this possible

## 📧 Support

For questions or issues, please open an issue in this repository or contact the Tipai team.

---

**Built with 💚 for biodiversity conservation at Tipai**
