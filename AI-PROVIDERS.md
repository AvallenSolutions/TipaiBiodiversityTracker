# AI Provider Options for Tipai Biodiversity Tracker

The app now supports multiple AI providers for species identification. Choose the one that works best for you!

## Quick Setup (AI is Optional)

**You can use the app without ANY AI provider!** Just leave the API keys empty in your `.env` file and the app will work perfectly - you can manually identify species.

## Supported AI Providers

### Option 1: Google Gemini 2.0 Flash (Recommended) ⭐

**Best for:** Species identification with context, multimodal understanding

**Setup:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key (requires Google account)
3. Add to `.env`:
```
VITE_GEMINI_API_KEY=your_key_here
```

**Pros:**
- Best accuracy for wildlife identification
- Understands context (e.g., "Indian wildlife near tiger reserve")
- Fast and cost-effective
- Free tier available

**Cons:**
- Requires Google account
- Project limits (as you experienced)

---

### Option 2: OpenAI GPT-4 Vision

**Best for:** General image understanding, reliable service

**Setup:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create an API key
3. Add to `.env`:
```
VITE_OPENAI_API_KEY=your_key_here
```

**Cost:** ~$0.01 per image (GPT-4o model)

**Pros:**
- Very reliable
- Good at species identification
- No project limits
- Excellent customer support

**Cons:**
- Requires payment setup (credit card)
- More expensive than Gemini
- Slightly slower

---

### Option 3: Google Cloud Vision API

**Best for:** Simple label detection, basic identification

**Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable Cloud Vision API
3. Create an API key
4. Add to `.env`:
```
VITE_GOOGLE_CLOUD_VISION_KEY=your_key_here
```

**Cost:** $1.50 per 1000 images (first 1000/month free)

**Pros:**
- Separate from AI Studio (no project limit issues)
- Good for basic identification
- Fast

**Cons:**
- Less contextual than Gemini/GPT-4
- Requires Google Cloud billing setup
- Not specialized for wildlife

---

## How to Switch AI Providers

### Method 1: Use the Alternative Implementation (Automatic)

Replace the current `gemini.ts` with the multi-provider version:

```bash
# Backup current version
mv src/utils/gemini.ts src/utils/gemini-original.ts

# Use the multi-provider version
mv src/utils/gemini-alternatives.ts src/utils/gemini.ts
```

The app will automatically use the first available API key in this priority:
1. Gemini (if `VITE_GEMINI_API_KEY` is set)
2. OpenAI (if `VITE_OPENAI_API_KEY` is set)
3. Google Vision (if `VITE_GOOGLE_CLOUD_VISION_KEY` is set)
4. No AI (if none are set)

### Method 2: Manual Entry

If you prefer no AI initially, users can manually enter species names in the notes field.

---

## Workarounds for "Too Many Projects" Issue

### Fix #1: Clean Up Old Google Projects
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select projects you no longer use
3. Go to "Shut down" in project settings
4. Wait 30 days for deletion (or contact support for faster deletion)

### Fix #2: Use a Different Google Account
Create a new Google account just for Gemini API access

### Fix #3: Request Quota Increase
Contact Google Support to increase your project limit

---

## Recommended Setup for You

Since you can't get Gemini right now, here's my recommendation:

### For Testing (Free)
**Use NO AI provider** - The app works perfectly without it! Species can be identified manually.

### For Production (Best Experience)
**Option A: OpenAI GPT-4 Vision** (~$10/month for ~1000 sightings)
- Most reliable
- No project limits
- Excellent species identification

**Option B: Google Cloud Vision** (~$1.50/month for ~1000 sightings)
- Cheaper than OpenAI
- Different quota from AI Studio
- Good enough for basic identification

### For Long-term (When Available)
**Gemini 2.0 Flash** - Best balance of cost and accuracy

---

## Current Status

The app is already configured to work **without any AI**! You can:
- ✅ Log sightings with photos
- ✅ Record GPS coordinates
- ✅ Add manual notes about species
- ✅ View all sightings in dashboard
- ✅ Sync offline data

The AI identification is a **nice-to-have** feature that enhances the experience but isn't required.

---

## Cost Comparison (for ~1000 sightings/month)

| Provider | Monthly Cost | Setup Complexity | Accuracy |
|----------|-------------|------------------|----------|
| **No AI** | Free | Easy | Manual |
| **Gemini** | Free (tier) | Easy | Excellent |
| **OpenAI** | ~$10 | Easy | Excellent |
| **Google Vision** | ~$1.50 | Medium | Good |

---

## Need Help?

Let me know which provider you'd like to use and I'll help you set it up!
