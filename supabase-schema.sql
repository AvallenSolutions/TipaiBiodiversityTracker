-- Tipai Biodiversity Tracker Database Schema
-- Execute this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE user_role AS ENUM ('naturalist', 'staff', 'guest');
CREATE TYPE category_type AS ENUM ('mammal', 'bird', 'lizard', 'insect', 'plant', 'trace', 'fungi');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  user_role user_role NOT NULL DEFAULT 'guest',
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sightings table
CREATE TABLE sightings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unique_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category category_type NOT NULL,
  species_name TEXT,
  common_name TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  location_accuracy DECIMAL(10, 2),
  photo_url TEXT,
  audio_url TEXT,
  notes TEXT,
  ai_identification JSONB,
  ai_confidence DECIMAL(5, 2),
  sighted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced BOOLEAN DEFAULT true
);

-- Create indexes for better query performance
CREATE INDEX idx_sightings_user_id ON sightings(user_id);
CREATE INDEX idx_sightings_category ON sightings(category);
CREATE INDEX idx_sightings_sighted_at ON sightings(sighted_at DESC);
CREATE INDEX idx_sightings_location ON sightings(latitude, longitude);
CREATE INDEX idx_sightings_unique_hash ON sightings(unique_hash);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sightings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Naturalists can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_role = 'naturalist'
    )
  );

-- Sightings policies
CREATE POLICY "Users can insert their own sightings"
  ON sightings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own sightings"
  ON sightings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Naturalists can view all sightings"
  ON sightings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_role = 'naturalist'
    )
  );

CREATE POLICY "Naturalists can update all sightings"
  ON sightings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_role = 'naturalist'
    )
  );

CREATE POLICY "Naturalists can delete all sightings"
  ON sightings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_role = 'naturalist'
    )
  );

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, user_role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'user_role', 'guest')::user_role,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('sighting-photos', 'sighting-photos', false);

-- Create storage bucket for audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('sighting-audio', 'sighting-audio', false);

-- Storage policies for photos
CREATE POLICY "Users can upload their own photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'sighting-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'sighting-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Naturalists can view all photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'sighting-photos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_role = 'naturalist'
    )
  );

-- Storage policies for audio
CREATE POLICY "Users can upload their own audio"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'sighting-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own audio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'sighting-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Naturalists can view all audio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'sighting-audio' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_role = 'naturalist'
    )
  );
