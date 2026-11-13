# GIS-Based Cemetery Mapping and Burial Information Management System

**Isabela City, Basilan**

A mobile-first GIS application for cemetery burial information management and public grave-location search, built with React Native (Expo), MapLibre, SQLite, and Supabase/PostGIS.

---

## Project Status

| Phase | Status |
|---|---|
| Feasibility & Technical Validation | 🔲 Not started |
| Requirements & System Design | 🔲 Not started |
| Application Foundation | 🔲 Not started |
| Cemetery Map & GIS Features | 🔲 Not started |
| Offline Map & Data Access | 🔲 Not started |
| Burial Information Management | 🔲 Not started |
| Synchronization | 🔲 Not started |
| Search, Navigation & Integration | 🔲 Not started |
| Testing & Evaluation | 🔲 Not started |
| Refinement & Finalization | 🔲 Not started |

---

## Core Capabilities

### Visitor

- Search burial records by full or partial name
- View approved burial details
- Locate the corresponding burial plot on the cemetery map
- Access previously downloaded maps and cached records **offline**

### Administrator

- Secure login
- Manage cemeteries, sections, burial plots, and burial records
- Draw and edit plot polygons on the map
- Verify changes before they become publicly visible
- Queue permitted offline edits and synchronize when connectivity returns

---

## Architecture Overview

```text
┌─────────────────────────────────────────────┐
│           Android Device (React Native)     │
│  ┌─────────────┐  ┌─────────────┐           │
│  │  MapLibre   │  │  Expo       │           │
│  │  MapView    │  │  SQLite     │           │
│  └─────────────┘  └─────────────┘           │
│  ┌─────────────────────────────────────────┐│
│  │  Sync Queue (pending local changes)     ││
│  └─────────────────────────────────────────┘│
└──────────────────┬──────────────────────────┘
                   │ HTTPS (when online)
┌──────────────────▼──────────────────────────┐
│              Supabase                       │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │  Auth       │  │  Edge Functions      │  │
│  └─────────────┘  └──────────────────────┘  │
│  ┌─────────────────────────────────────────┐│
│  │  PostgreSQL + PostGIS (authoritative)   ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

**Data authority:** The Supabase/PostGIS database is authoritative. The SQLite database on the device is a cache and temporary work area for offline operations.

**Sync model:** Optimistic concurrency with per-record `version` integers. Conflicts are flagged for admin review, never silently overwritten.

---

## Technology Stack

| Component | Technology |
|---|---|
| Mobile framework | React Native + Expo (SDK 52) |
| Language | TypeScript |
| Map rendering | MapLibre React Native |
| Geographic data | GeoJSON (EPSG:4326) |
| Local database | Expo SQLite (with FTS5 for search) |
| Backend | Supabase (Auth, Edge Functions) |
| Spatial database | PostgreSQL + PostGIS |
| Tile provider | MapTiler (Cloud Free / On-prem Free) |
| Build service | EAS Build (cloud APK/AAB) |
| Dev environment | Kali NetHunter on Android |

---

## Offline Scope (Initial)

| Feature | Offline Supported |
|---|---|
| View downloaded map area | ✅ Yes |
| Search cached burial records | ✅ Yes |
| View cached burial details | ✅ Yes |
| Highlight cached plot polygon | ✅ Yes |
| Create/edit burial records | ✅ Queued, synced later |
| Create/edit plot **geometry** | ❌ Requires connectivity |

Geometry edits are intentionally online-only because conflicting polygon changes are the hardest to reconcile and the most damaging if incorrect.

---

## Prerequisites

- Node.js (LTS; verify compatibility with NetHunter)
- Expo CLI
- A Supabase project (free tier is sufficient for development)
- A MapTiler account (free tier) and a map style URL
- An Android device with Expo development build support

---

## Environment Setup

1. Clone the repository.
2. Copy `.env.example` to `.env` and fill in the required values (including `EXPO_PUBLIC_MAPTILER_STYLE_URL`).
3. Install dependencies:

   ```bash
   npm install
   ```

4. Create the Supabase tables by running the migrations in `supabase/migrations/`.
5. Start the development server:

   ```bash
   npx expo start
   ```

6. Build a development APK via EAS:

   ```bash
   eas build --platform android --profile development
   ```

See `docs/setup.md` for detailed NetHunter-specific setup notes (coming in a later file).

---

## Project Structure

```text
cemetery-gis/
├── src/
│   ├── types/           # Shared TypeScript types
│   ├── lib/
│   │   ├── db/          # SQLite schema, migrations, queries
│   │   ├── supabase/    # Backend client
│   │   ├── sync/        # Sync queue and conflict handling
│   │   ├── map/         # MapLibre helpers, offline packs
│   │   └── search/      # Name search (FTS5)
│   ├── screens/         # Visitor and admin screens
│   ├── navigation/      # Navigation configuration
│   └── components/      # Reusable UI components
├── supabase/
│   ├── migrations/      # PostGIS schema (SQL)
│   └── functions/       # Edge functions
├── assets/              # Images, fonts
├── app.json             # Expo config
├── eas.json             # EAS Build profiles
├── tsconfig.json
├── package.json
└── README.md
```

---

## Database Schema (High-Level)

| Table | Purpose |
|---|---|
| `cemeteries` | Cemetery metadata (name, location, boundary) |
| `sections` | Optional subdivisions within a cemetery |
| `plots` | Individual burial plot polygons |
| `burials` | Burial records linked to plots |
| `profiles` | User accounts (admin/visitor roles) |
| `sync_queue` | Local pending changes (device-side only) |
| `audit_log` | Change history for administrative actions |

A plot may have **multiple burial records** (shared/family plots). The schema does not enforce a 1:1 relationship.

Cemeteries are data, not hardcoded constants: the `cemeteries` table is managed through admin screens, and the initial seed is a single row for Isabela City.

---

## Privacy & Authorization

- Cemetery data is collected and displayed **only with documented permission** from the cemetery administrator or local government.
- Visitor-visible fields are restricted to those explicitly approved by the data owner.
- Administrative operations require authentication and role checks enforced at the backend.
- Cached sensitive data must be clearable when access is revoked.
- The system follows applicable Philippine data-protection requirements.

---

## Development Methodology

Agile, iterative development with short cycles. Each iteration produces a working, testable increment. High-risk dependencies (permission, data access, mapping accuracy, MapLibre/NetHunter compatibility, offline tile licensing) are addressed early.

See `PLAN.md` for the full iteration breakdown and acceptance criteria.

---