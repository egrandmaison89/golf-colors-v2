# Stack Proposal for Golf Colors v2

## Recommended Stack

### Frontend Framework
**React 18+ with TypeScript**

**Why**:
- You're already familiar with React from v1
- TypeScript adds type safety and better developer experience
- React 18 has improved performance and concurrent features
- Large ecosystem and community support
- Industry standard

**Alternative Considered**: Next.js
- **Why Not**: SSR/SSG not needed for this app. Adds complexity without clear benefit.

---

### Build Tool
**Vite**

**Why**:
- Fast development server (HMR)
- Excellent TypeScript support
- Modern ES modules
- Smaller bundle sizes
- Simple configuration

**Alternative Considered**: Create React App
- **Why Not**: Slower, less modern, being phased out by React team.

---

### Styling
**Tailwind CSS**

**Why**:
- Utility-first, fast to develop
- Consistent design system
- Small bundle size (purges unused styles)
- Great developer experience
- Widely adopted

**Alternative Considered**: CSS Modules, Styled Components
- **Why Not**: Tailwind is faster to develop with, less runtime overhead.

---

### Routing
**React Router v6**

**Why**:
- Standard for React SPAs
- Simple API
- Good TypeScript support
- Handles protected routes well

---

### Backend / Database / Auth
**Supabase**

**Why**:
- You're already using it in v1
- PostgreSQL database (powerful, reliable)
- Built-in authentication
- Real-time subscriptions (if needed)
- Storage for headshots
- Row Level Security for data access control
- REST API + client libraries

**No Alternative Considered**: This is a constraint from v1.

---

### State Management
**React Context API + Custom Hooks**

**Why**:
- Built into React (no external dependency)
- Sufficient for our needs (auth + minimal global state)
- Simpler than Redux/Zustand
- Less boilerplate

**Alternatives Considered**:
- **Redux**: Overkill for this app's state needs
- **Zustand**: Good option, but Context is sufficient and simpler

---

### Form Handling
**React Hook Form** (if needed for complex forms)

**Why**:
- Minimal re-renders
- Good TypeScript support
- Simple API
- Small bundle size

**Note**: Only add if forms become complex. Start with controlled inputs.

---

### HTTP Client
**Supabase JavaScript Client**

**Why**:
- Official client for Supabase
- Type-safe with TypeScript
- Handles auth automatically
- Real-time subscriptions built-in

---

### Development Tools
- **TypeScript**: Strict mode for type safety
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Path Aliases**: `@/` for `src/` (cleaner imports)

---

### Deployment
**Netlify** (same as v1)

**Why**:
- Simple deployment
- Good for React SPAs
- Environment variable management
- Free tier sufficient

---

## Package Dependencies

### Core
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0"
}
```

### TypeScript
```json
{
  "typescript": "^5.3.0",
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0"
}
```

### Supabase
```json
{
  "@supabase/supabase-js": "^2.38.0"
}
```

### Styling
```json
{
  "tailwindcss": "^3.4.0",
  "autoprefixer": "^10.4.16",
  "postcss": "^8.4.32"
}
```

### Build Tool
```json
{
  "vite": "^5.0.0",
  "@vitejs/plugin-react": "^4.2.0"
}
```

### Development
```json
{
  "eslint": "^8.55.0",
  "@typescript-eslint/eslint-plugin": "^6.15.0",
  "@typescript-eslint/parser": "^6.15.0",
  "prettier": "^3.1.0"
}
```

### Optional (Add if needed)
```json
{
  "react-hook-form": "^7.49.0",  // Only if forms get complex
  "date-fns": "^2.30.0"          // For date formatting
}
```

---

## What Changes from v1?

### Confirmed Changes
1. **TypeScript**: v1 may have had minimal TS. v2 will be fully typed.
2. **Architecture**: Feature-based organization instead of mixed patterns.
3. **State Management**: Explicit patterns (Context + hooks) instead of scattered state.
4. **Documentation**: Comprehensive docs explaining decisions.

### Likely Same (Need to Verify)
- React (probably same version or upgrade to 18)
- Supabase (same)
- Netlify deployment (same)
- Tailwind (may have been used in v1)

### To Verify from v1
- Check `package.json` to see what was actually used
- Check if Vite was already used or if it was CRA
- Check TypeScript usage level

---

## Justification Summary

This stack is:
- **Modern but Conservative**: Uses proven technologies, not bleeding edge
- **Familiar**: Builds on what you know (React, Supabase)
- **Maintainable**: Clear patterns, good tooling
- **Production-Ready**: All tools are battle-tested
- **Simple**: No unnecessary complexity

The goal is **boring technology that works**, not the latest shiny thing.

---

## Questions to Answer Before Implementation

1. **Does v1 already use Vite?** (Check v1 `package.json`)
2. **Does v1 use TypeScript?** (Check v1 `tsconfig.json`)
3. **Does v1 use Tailwind?** (Check v1 `tailwind.config.js`)
4. **What's the exact database schema in v1?** (Need to replicate or migrate)

These answers will inform:
- Whether we're upgrading or starting fresh
- Migration strategy for data/schema
- Exact feature parity requirements

