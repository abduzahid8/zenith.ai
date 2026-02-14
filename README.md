# zenyth.ai - React Native App

A productivity/hobby discovery app built with React Native and Expo.

## Features

- 🎯 AI-powered hobby matching based on personality quiz
- ⏱️ 30-minute focus sessions with timer
- 📊 Screen time tracking and analytics
- 🤖 AI coach for personalized guidance
- 📅 Weekly planning and progress tracking

## Tech Stack

- **Framework:** React Native with Expo
- **Navigation:** Expo Router
- **Backend:** Supabase (Auth + Database)
- **AI:** OpenAI GPT-4
- **State Management:** Zustand
- **Styling:** StyleSheet with custom theme system

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Configure `.env` with your API keys:
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `EXPO_PUBLIC_OPENAI_API_KEY` - Used only by the Supabase Edge Function (ai-proxy); the app never sends this key to the client.

4. Start the development server:
```bash
npx expo start
```

## Project Structure

```
├── app/                    # Expo Router routes
├── assets/
│   ├── fonts/             # Gramatika font family
│   └── images/            # App icons and images
├── src/
│   ├── components/        # Reusable UI components
│   ├── screens/           # Screen components
│   ├── services/          # API services (Supabase, AI)
│   ├── store/             # Zustand state stores
│   └── theme/             # Design system (colors, typography)
└── supabase/              # Database migrations
```

## Available Scripts

- `npm start` - Start Expo development server
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator
- `npm run web` - Run in web browser

## Database Setup

Run the following SQL in your Supabase dashboard:

```sql
-- Users table (handled by Supabase Auth)

-- Quiz answers
CREATE TABLE quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  answers JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User hobbies
CREATE TABLE user_hobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  hobby_id TEXT,
  selected_at TIMESTAMP DEFAULT NOW()
);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  hobby_id TEXT,
  duration_seconds INTEGER,
  completed_at TIMESTAMP DEFAULT NOW()
);

-- User profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## License

MIT
