# Supabase Authentication & Database Redesign Plan

## 🎯 **Project Overview**
Transform the itinerary app from localStorage-based state management to a proper user authentication system with Supabase database storage. Users will sign in with Google, have persistent accounts, and access their itinerary history.

## 📋 **Complete Implementation Checklist**

### **Phase 1: Supabase Setup & Database Schema**

#### ✅ **1.1 Supabase Project Setup**
- [x] Verify Supabase project is active and accessible
- [x] Note down Supabase project URL and anon key
- [ ] Ensure Supabase MCP connection is working

#### ✅ **1.2 Database Schema Design**
- [ ] Create `users` table
  ```sql
  CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    google_id TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  ```

- [ ] Create `itineraries` table
  ```sql
  CREATE TABLE itineraries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_city TEXT NOT NULL,
    guests INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    budget_from INTEGER,
    budget_to INTEGER,
    number_of_options INTEGER DEFAULT 3,
    additional_options JSONB DEFAULT '[]'::jsonb,
    raw_content TEXT,
    processed_content JSONB,
    images JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'error')),
    canva_design_url TEXT,
    slides_presentation_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  ```

- [ ] Create indexes for performance
  ```sql
  CREATE INDEX idx_itineraries_user_id ON itineraries(user_id);
  CREATE INDEX idx_itineraries_created_at ON itineraries(created_at DESC);
  CREATE INDEX idx_users_google_id ON users(google_id);
  ```

#### ✅ **1.3 Row Level Security (RLS)**
- [ ] Enable RLS on `users` table
  ```sql
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ```

- [ ] Enable RLS on `itineraries` table
  ```sql
  ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
  ```

- [ ] Create RLS policies for users
  ```sql
  -- Users can only see their own data
  CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);
  
  CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);
  ```

- [ ] Create RLS policies for itineraries
  ```sql
  -- Users can only access their own itineraries
  CREATE POLICY "Users can view own itineraries" ON itineraries
    FOR SELECT USING (auth.uid() = user_id);
  
  CREATE POLICY "Users can insert own itineraries" ON itineraries
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  
  CREATE POLICY "Users can update own itineraries" ON itineraries
    FOR UPDATE USING (auth.uid() = user_id);
  
  CREATE POLICY "Users can delete own itineraries" ON itineraries
    FOR DELETE USING (auth.uid() = user_id);
  ```

### **Phase 2: Authentication System Overhaul**

#### ✅ **2.1 Supabase Client Setup**
- [x] Install Supabase client if not already installed
- [x] Install `@supabase/ssr` package for Next.js integration
- [x] Create `lib/supabase.ts` for client configuration
- [x] Create `lib/database.ts` with CRUD operations
- [ ] Add Supabase environment variables to `.env.local`

#### ✅ **2.2 Replace NextAuth with Supabase Auth**
- [x] Create Supabase Auth provider component (`components/auth-provider.tsx`)
- [x] Update main layout to use Supabase auth provider
- [ ] Remove NextAuth dependencies and configuration
  - [ ] Delete `app/api/auth/[...nextauth]/route.ts`
  - [ ] Remove `next-auth` imports from components
  - [ ] Remove old NextAuth provider file

#### ✅ **2.3 Update Authentication Components**
- [x] Create sign-in page component (`app/auth/signin/page.tsx`)
- [x] Create auth callback page (`app/auth/callback/page.tsx`)
- [x] Create protected route wrapper component (`components/protected-route.tsx`)
- [x] Update homepage to redirect authenticated users
- [ ] Add authentication guards to itinerary pages

### **Phase 3: Database Integration**

#### ✅ **3.1 Create Database Service Layer**
- [ ] Create `lib/database.ts` with CRUD operations
  ```typescript
  // User operations
  export async function createUser(userData: UserData): Promise<User>
  export async function getUserById(id: string): Promise<User | null>
  export async function updateUser(id: string, updates: Partial<UserData>): Promise<User>
  
  // Itinerary operations
  export async function createItinerary(itineraryData: ItineraryData): Promise<Itinerary>
  export async function getItinerariesByUser(userId: string): Promise<Itinerary[]>
  export async function getItineraryById(id: string): Promise<Itinerary | null>
  export async function updateItinerary(id: string, updates: Partial<ItineraryData>): Promise<Itinerary>
  export async function deleteItinerary(id: string): Promise<void>
  ```

#### ✅ **3.2 Create TypeScript Types**
- [ ] Create `types/database.ts` with all type definitions
  ```typescript
  export interface User {
    id: string
    email: string
    full_name?: string
    avatar_url?: string
    google_id?: string
    created_at: string
    updated_at: string
  }
  
  export interface Itinerary {
    id: string
    user_id: string
    title: string
    destination: string
    departure_city: string
    guests: number
    start_date: string
    end_date: string
    budget_from?: number
    budget_to?: number
    number_of_options: number
    additional_options: string[]
    raw_content?: string
    processed_content?: any
    images?: any[]
    status: 'generating' | 'generated' | 'error'
    canva_design_url?: string
    slides_presentation_url?: string
    created_at: string
    updated_at: string
  }
  ```

### **Phase 4: Application Flow Redesign**

#### ✅ **4.1 Landing Page & Authentication**
- [ ] Update `app/page.tsx` to check authentication status
- [ ] If not authenticated, show "Continue with Google" button
- [ ] If authenticated, redirect to dashboard or itinerary creation

#### ✅ **4.2 Itinerary Creation Flow**
- [ ] Update `app/itinerary/page.tsx` to require authentication
- [ ] Save form data to database when user submits
- [ ] Create database record with `status: 'generating'`
- [ ] Update record with generated content when complete
- [ ] Add URL routing with itinerary ID: `/itinerary/[id]`

#### ✅ **4.3 Itinerary History & Management**
- [x] Create itinerary list page (`app/itineraries/page.tsx`)
- [x] Update "Past Itineraries" button to navigate to list
- [x] Display user's itinerary history with:
  - [x] Thumbnail/preview
  - [x] Destination & dates
  - [x] Status indicators
  - [x] Quick actions (view, share, delete)

#### ✅ **4.4 Individual Itinerary View**
- [x] Create dynamic route `app/itinerary/[id]/page.tsx`
- [x] Load itinerary data from database by ID
- [x] Check user ownership (RLS will handle this)
- [x] Display itinerary with all generated content
- [x] Show Canva/Slides integration buttons if authenticated

### **Phase 5: API Routes Overhaul**

#### ✅ **5.1 Update Itinerary Generation API**
- [ ] Modify `app/api/itinerary/route.ts` to:
  - [ ] Require authentication (check Supabase session)
  - [ ] Save initial record to database
  - [ ] Update record with generated content
  - [ ] Return itinerary ID for routing

#### ✅ **5.2 Create Itinerary Management APIs**
- [ ] Create `app/api/itineraries/route.ts` (GET user's itineraries)
- [ ] Create `app/api/itineraries/[id]/route.ts` (GET/PUT/DELETE single itinerary)
- [ ] Update slides and Canva APIs to save URLs to database

#### ✅ **5.3 Update External Integration APIs**
- [ ] Modify `app/api/slides-oauth/route.ts` to:
  - [ ] Save presentation URL to database
  - [ ] Associate with correct itinerary record
- [ ] Modify Canva API similarly

### **Phase 6: UI/UX Improvements**

#### ✅ **6.1 Navigation & Layout Updates**
- [ ] Add user avatar/menu to header
- [ ] Add navigation between create/history pages
- [ ] Update dashboard layout for authenticated users

#### ✅ **6.2 Loading & Error States**
- [ ] Add loading states for database operations
- [ ] Add error handling for failed operations
- [ ] Add success notifications for completed actions

#### ✅ **6.3 Responsive Design & Accessibility**
- [ ] Ensure all new pages are responsive
- [ ] Add proper ARIA labels and keyboard navigation
- [ ] Test with screen readers

### **Phase 7: Data Migration & Cleanup**

#### ✅ **7.1 Remove Legacy Code**
- [ ] Remove localStorage-related code
- [ ] Remove old state management logic
- [ ] Clean up unused dependencies

#### ✅ **7.2 Testing & Quality Assurance**
- [ ] Test complete user flow:
  - [ ] Sign up with Google
  - [ ] Create new itinerary
  - [ ] View itinerary history
  - [ ] Generate Canva/Slides
  - [ ] Access saved itineraries
- [ ] Test error scenarios
- [ ] Test performance with multiple itineraries

### **Phase 8: Deployment & Production**

#### ✅ **8.1 Environment Configuration**
- [ ] Add Supabase environment variables to Vercel
- [ ] Test authentication in production environment
- [ ] Verify database connections work in production

#### ✅ **8.2 Security Review**
- [ ] Review RLS policies
- [ ] Audit API endpoints for proper authentication
- [ ] Test unauthorized access scenarios

## 🔄 **Implementation Order**

1. **Start with Phase 1** (Database schema) - Foundation
2. **Phase 2** (Authentication) - Core functionality
3. **Phase 3** (Database integration) - Data layer
4. **Phase 4** (App flow) - User experience
5. **Phase 5** (API updates) - Backend logic
6. **Phase 6** (UI improvements) - Polish
7. **Phase 7 & 8** (Cleanup & deployment) - Finalization

## 📝 **Key Benefits After Implementation**

✅ **Persistent user accounts**
✅ **Cross-device access to itineraries**
✅ **Proper data relationships and integrity**
✅ **Scalable architecture**
✅ **Better security with RLS**
✅ **Professional user experience**
✅ **Easy itinerary sharing and management**

## 🚨 **Important Notes**

- Keep current localStorage logic as fallback during transition
- Test each phase thoroughly before moving to the next
- Backup any existing data before starting migration
- Consider implementing feature flags for gradual rollout

---

This plan transforms your app into a professional, scalable application with proper user management and data persistence! 🚀