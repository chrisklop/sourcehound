# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SourceHound is an AI-powered claim debunking application with a ChatGPT-style conversational interface. Built with Next.js 14 and React, the app allows users to have persistent conversations for fact-checking claims with comprehensive source analysis and IP-based session storage.

## Development Commands

### Working Directory
```bash
cd /home/chris/projects/sourcehound  # SourceHound application directory
```

### Core Commands
- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint checks

### Database Commands (Phase 3)
- `npm run db:setup` - Set up PostgreSQL and Redis with Docker
- `npm run db:start` - Start database services
- `npm run db:stop` - Stop database services
- `npm run db:reset` - Reset database and recreate
- `npm run db:migrate` - Run Prisma migrations
- `npm run db:studio` - Open Prisma Studio (GUI)
- `npm run db:seed` - Seed database with sample data

### **IMPORTANT: Database Setup**
🔥 **Phase 3 uses PostgreSQL + Redis** for enhanced persistence and caching. Run `npm run db:setup` first.

## SourceHound Architecture

### Application Structure (Next.js 14 App Router)
- **Main App**: Located in `/home/chris/projects/sourcehound/`
- **App Router**: Uses Next.js 14 app directory structure
- **API Routes**: Server-side API endpoints in `app/api/`
- **Components**: ChatGPT-style UI components with shadcn/ui integration
- **Theme System**: Dark mode default with next-themes

### Core Features

#### ChatGPT-Style Interface
- **Conversational Layout**: Full-screen chat interface with sidebar navigation
- **Message System**: User and assistant message bubbles with avatars
- **Auto-expanding Input**: Textarea that resizes with content
- **Welcome Screen**: Suggested prompts for new conversations
- **Mobile Responsive**: Collapsible sidebar for mobile devices

#### Database-Powered Session Persistence (Phase 3)
- **PostgreSQL Primary**: Persistent storage with full ACID compliance
- **Redis Cache**: High-speed session access and caching layer
- **Hybrid Architecture**: Database persistence + Redis performance
- **Legacy Migration**: Automatic migration from file-based storage
- **IP-Based Identification**: No authentication required for beta users
- **Enhanced Analytics**: Full conversation and usage tracking

#### Conversation Management
- **Multiple Conversations**: Users can maintain multiple chat threads
- **Conversation History**: Full message history preserved
- **Dynamic Titles**: Conversations titled from first user message
- **New Chat Creation**: Start fresh conversations anytime

### Core API Endpoints

#### Session Management
- `GET/POST/DELETE /api/sessions` - IP-based conversation persistence
  - **GET**: Load conversations for current IP
  - **POST**: Save conversations for current IP  
  - **DELETE**: Clear conversations for current IP

#### Fact-Checking API Endpoints
- `POST /api/fact-check-hybrid` - Main hybrid analysis endpoint (Perplexity + Gemini)
- `GET/POST /api/fact-check` - Legacy fact-checking endpoint with progress support
- `POST /api/analyze-claims` - Atomic claim extraction using GPT-4/Claude
- `POST /api/synthesize-verification` - Evidence synthesis and final analysis
- `POST /api/intelligent-fact-check` - Advanced analysis with enhanced sourcing
- `POST /api/enhance-source` - Source credibility enhancement
- `GET /api/fact-check-progress` - Server-sent events for real-time progress
- `GET /api/health` - Health check endpoint
- `GET /api/test` - Development testing endpoint

### Data Flow Architecture

#### Conversation Flow
1. **User Input**: Message entered in chat interface
2. **Session Check**: Load existing conversation or create new one
3. **API Call**: Submit to `/api/fact-check-hybrid` with claim and session ID
4. **Real-time Updates**: Loading state with animated indicators
5. **Response Processing**: Format fact-check results for chat display
6. **Session Save**: Persist updated conversation to IP-based storage

#### Session Persistence Flow
1. **Page Load**: Fetch conversations from `/api/sessions` by IP
2. **User Interaction**: Create/update conversations in state
3. **Auto-Save**: Continuously sync conversations to server
4. **Recovery**: Reload conversations on browser restart

### External API Integration
- **Perplexity AI**: Primary research and source discovery engine
- **Google Gemini**: Secondary analysis engine for cross-validation
- **OpenAI GPT-4**: Claim extraction and synthesis for complex queries
- **Google Fact Check Tools API**: Professional fact-checker reviews
- **Advanced Caching**: File-based cache with similarity matching
- **Hybrid Engine Architecture**: Dual-LLM approach for enhanced accuracy

### Component Architecture

#### Main Components
- `app/page.tsx` - Main ChatGPT-style interface
- `app/api/sessions/route.ts` - IP-based session persistence
- `components/theme-toggle.tsx` - Dark/light mode switcher
- `hooks/use-mobile.tsx` - Mobile device detection
- `hooks/use-toast.ts` - Toast notification system

#### UI Framework
- **Base**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS 4 with dark mode support
- **Animation**: Framer Motion for smooth transitions
- **Icons**: Lucide React icon library

### Technical Implementation Details

#### Session Storage Format
```typescript
interface SessionData {
  conversations: Conversation[]
  lastAccessed: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
}
```

#### IP Detection Strategy
```typescript
// Multiple header fallbacks for IP detection
const xForwardedFor = headersList.get('x-forwarded-for')
const xRealIP = headersList.get('x-real-ip') 
const cfConnectingIP = headersList.get('cf-connecting-ip')
```

#### Response Formatting
- **Verdict**: Clear True/False/Mixed determination with confidence
- **Summary**: Executive summary of findings
- **Key Findings**: Bullet-pointed analysis points
- **Sources**: Up to 5 top-quality sources with links

### Environment Configuration
Create `.env.local` file in the project root:
```bash
PERPLEXITY_API_KEY=your_perplexity_key
GOOGLE_FACTCHECK_API_KEY=your_google_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
```

### Development Patterns

#### State Management
- **Local State**: useState for UI and conversation management
- **Server Persistence**: IP-based session storage via API
- **Real-time Updates**: Optimistic updates with server sync

#### Error Handling
- **Network Failures**: Graceful fallback to localStorage
- **API Errors**: User-friendly error messages in chat
- **Loading States**: Animated indicators during processing

#### Performance Considerations
- **Auto-scroll**: Smooth scrolling to new messages
- **Textarea Resize**: Dynamic height adjustment
- **Session Caching**: Minimize API calls with local state

## File Structure

### Core Application Files
```
/home/chris/projects/sourcehound/
├── app/
│   ├── page.tsx                    # Main ChatGPT-style interface
│   ├── layout.tsx                  # Root layout with theme provider
│   ├── globals.css                 # Global styles
│   └── api/
│       ├── sessions/route.ts       # IP-based session persistence
│       ├── fact-check-hybrid/route.ts # Main hybrid analysis endpoint
│       ├── fact-check/route.ts     # Legacy fact-checking endpoint
│       ├── analyze-claims/route.ts # Atomic claim extraction
│       ├── synthesize-verification/route.ts # Evidence synthesis
│       ├── intelligent-fact-check/route.ts # Advanced analysis
│       ├── enhance-source/route.ts # Source enhancement
│       ├── health/route.ts         # Health check endpoint
│       └── test/route.ts          # Development testing
├── components/
│   ├── ui/                         # shadcn/ui component library
│   └── theme-toggle.tsx            # Theme switcher
├── hooks/
│   ├── use-mobile.tsx              # Mobile device detection
│   └── use-toast.ts                # Toast notifications
├── lib/                            # Utility libraries and database
│   ├── db.ts                       # PostgreSQL/Redis connections
│   ├── cache.ts                    # Redis caching utilities
│   ├── enhanced-cache.ts           # Advanced fact-check caching
│   └── session-manager.ts          # Database session management
├── prisma/                         # Database schema and migrations
│   ├── schema.prisma               # Database models
│   └── seed.js                     # Sample data seeding
├── scripts/
│   └── setup-db.js                 # Database setup automation
├── docker-compose.yml              # Local database services
└── package.json                    # Dependencies and scripts
```

### Key Dependencies (Phase 3)
```json
{
  "dependencies": {
    "next": "^14.2.31",
    "react": "^18",
    "@prisma/client": "^6.14.0",
    "prisma": "^6.14.0", 
    "ioredis": "^5.7.0",
    "redis": "^5.8.2",
    "framer-motion": "latest",
    "next-themes": "latest",
    "lucide-react": "^0.454.0",
    "@radix-ui/react-*": "various",
    "tailwind-merge": "^2.5.5",
    "sonner": "^1.7.4"
  }
}
```

## Database Architecture (Phase 3)

### PostgreSQL Schema
- **Users**: IP-based user identification with optional email
- **Sessions**: Encrypted session data with expiration
- **Conversations**: Chat threads with metadata
- **Messages**: Individual chat messages with fact-check data
- **FactCheckCache**: Intelligent query caching with similarity matching
- **SourceCredibility**: Domain credibility scoring and metadata
- **QueryLogs**: Analytics and usage tracking

### Redis Architecture
- **Session Cache**: Fast session access (`session:{ip}`)
- **FactCheck Cache**: Query results with TTL (`factcheck:{hash}`)
- **Similarity Matching**: Advanced query matching for cache hits
- **Rate Limiting**: API throttling and quota management
- **Real-time Data**: WebSocket session storage

### Hybrid Caching Strategy
1. **L1 Cache (Redis)**: Sub-millisecond access for active data
2. **L2 Cache (PostgreSQL)**: Persistent cache with analytics
3. **Similarity Search**: Intelligent cache hits for related queries
4. **Cache Warming**: Proactive loading of popular queries
5. **TTL Management**: Automatic expiration and cleanup

## Current Status

### Phase 1 - Complete ✅
- **ChatGPT-Style Interface**: Full conversational UI implemented
- **IP-Based Sessions**: Server-side persistence without authentication
- **Conversation History**: Multiple chat threads with titles
- **Backend Integration**: Complete GenuVerity fact-checking pipeline
- **Mobile Support**: Responsive design with collapsible sidebar

### Phase 2 - Complete ✅
- **Canvas-Style Source Browser**: Interactive document viewer with pan/zoom
- **Enhanced Source Visualization**: Advanced charts and credibility analytics
- **Advanced Conversation Management**: Search, export, sharing, and archiving
- **Performance Optimizations**: Virtualized message lists and lazy loading
- **PWA Support**: Offline functionality, installable app, background sync

### Phase 3 - In Progress ⚡ (2/10 complete - 20%)
- ✅ **Database Migration**: PostgreSQL + Redis hybrid architecture
- ✅ **Advanced Caching**: Intelligent similarity-based fact-check caching
- ⏳ **Real-time Collaboration**: WebSocket-based shared sessions
- ⏳ **Authentication System**: User accounts and team management
- ⏳ **API Rate Limiting**: Usage quotas and analytics dashboard
- ⏳ **Webhook System**: Third-party integrations (Slack, Discord)
- ⏳ **Admin Dashboard**: User management and system monitoring
- ⏳ **Multi-language Support**: i18n for global deployment
- ⏳ **Advanced Analytics**: Detailed reporting and trend analysis
- ⏳ **AI Model Selection**: User-configurable AI models

### Enhanced Features (Available at `/enhanced`)
- **Multi-View Interface**: Chat, Analysis, Sources, and Management tabs
- **Interactive Canvas**: Drag-and-drop source exploration with minimap
- **Advanced Analytics**: Source credibility charts, timeline analysis
- **Virtualized Lists**: Performance-optimized for large conversations
- **Offline Capability**: Works without internet connection
- **Export Options**: PDF, TXT, and JSON conversation export
- **Smart Search**: Cross-conversation content search
- **PWA Installation**: Native app-like experience

### Database Infrastructure (Phase 3)
- **PostgreSQL**: ✅ Production-ready schema with migrations
- **Redis**: ✅ High-performance caching layer
- **Docker Services**: ✅ Local development environment
- **Prisma ORM**: ✅ Type-safe database operations
- **Auto Migration**: ✅ Legacy file-based session conversion
- **Health Monitoring**: ✅ Database connection status tracking

### Development Server
- **Status**: ✅ Running successfully  
- **URL**: http://localhost:3000
- **Enhanced URL**: http://localhost:3000/enhanced
- **Database UI**: http://localhost:8080 (Adminer)
- **Build**: ✅ Production build tested and working
- **Dependencies**: ✅ All packages installed and configured
- **Database**: ✅ PostgreSQL + Redis ready (run `npm run db:setup`)

### Deployment Status
- **Local Development**: ✅ Ready for testing
- **Vercel Production**: ✅ https://sourcehound-nexfmd9vr-klop-consulting.vercel.app
- **GitHub Repository**: ✅ https://github.com/chrisklop/sourcehound
- **Production Build**: ✅ Tested and working
- **PWA Features**: ✅ Offline support and installable

## Development Guidelines

### Code Style
- **TypeScript**: Strict type checking enabled
- **Component Pattern**: Functional components with hooks
- **Error Boundaries**: Graceful error handling throughout
- **Accessibility**: ARIA labels and keyboard navigation

### Testing Approach
- **Manual Testing**: Development server for interactive testing
- **Build Validation**: Production build must succeed
- **Cross-browser**: Test in Chrome, Firefox, Safari

### Debugging
- **Console Logging**: All API routes use consistent prefixes
- **Network Tab**: Monitor API calls and session persistence
- **Local Storage**: Fallback data visible in browser DevTools

---

**Remember: SourceHound is local-only until deployment is explicitly requested.**