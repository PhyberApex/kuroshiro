# Mashup Feature Implementation Summary

**Issue:** #53 - Add Mashup Support for TRMNL  
**Status:** ✅ Complete  
**Coverage:** 71.38% (exceeds 70% target)  
**Tests:** 307 passing (5 intentionally skipped)

---

## 📋 Overview

The Mashup feature allows users to combine multiple plugin screens into a single display using 7 predefined layouts from the official TRMNL framework. This implementation follows TDD principles with comprehensive test coverage and maintains close compatibility with TRMNL's official behavior.

---

## ✨ Features Implemented

### Backend (NestJS + TypeORM)

#### 1. Database Schema
- **MashupConfiguration Entity** (`mashup-configuration.entity.ts`)
  - Links to Screen entity (OneToOne)
  - Stores layout type (1Lx1R, 1Tx1B, etc.)
  - Cascade deletes with Screen

- **MashupSlot Entity** (`mashup-slot.entity.ts`)
  - Maps plugins to specific positions in the layout
  - References Plugin directly (not DevicePlugin)
  - Stores position, size, and order information

- **Migration** (`1745908800000-AddMashupSupport.ts`)
  - Adds `type` column to screens table
  - Creates mashup_configuration and mashup_slot tables
  - Includes proper indexes for performance
  - Backfills existing screens with type='file'

#### 2. Business Logic

**MashupService** (`mashup.service.ts`)
- **CRUD Operations:**
  - `create()` - Create new mashup with validation
  - `update()` - Update existing mashup (clears old slots)
  - `delete()` - Delete mashup (cascade to config/slots)
  - `getConfiguration()` - Retrieve mashup configuration
  - `getLayouts()` - Return available layout definitions

- **Validation Rules:**
  1. Device must exist
  2. Plugin count must match layout's slot count
  3. All plugins must exist
  4. No duplicate plugins in same mashup

**MashupRendererService** (`mashup-renderer.service.ts`)
- Renders complete mashup HTML using TRMNL CSS framework
- **Partial Rendering:** If plugin fails, shows error placeholder instead of failing entire mashup
- Uses PluginRendererService for individual plugin rendering
- Builds proper mashup HTML structure with correct slot positioning

**PluginSchedulerService Updates** (`plugin-scheduler.service.ts`)
- `invalidateMashupCaches()` - Clears cached mashup output when plugin updates
- Lazy injection of MashupSlot repository to avoid circular dependencies

**PluginsService Updates** (`plugins.service.ts`)
- `checkPluginUsage()` - Returns list of mashups using a plugin
- `remove()` - Enhanced with force flag and mashup usage checking
- Throws BadRequestException if plugin used in mashups without force=true

**DeviceDisplayService Updates** (`display.service.ts`)
- Handles mashup screen type
- Loads mashup configuration with relations
- Renders mashup HTML and converts to PNG for e-ink display

#### 3. API Endpoints

**MashupController** (`mashup.controller.ts`)
- `POST /api/mashup` - Create mashup
- `PUT /api/mashup/:id` - Update mashup
- `DELETE /api/mashup/:id` - Delete mashup
- `GET /api/mashup/:id/configuration` - Get mashup config
- `GET /api/mashup/layouts` - Get available layouts

#### 4. Constants

**Layout Definitions** (`mashup/constants/layouts.ts`)
```typescript
MASHUP_LAYOUT_CONFIG = {
  '1Lx1R': { slots: [{ position: 'L', size: '50', order: 0 }, { position: 'R', size: '50', order: 1 }] },
  '1Tx1B': { slots: [{ position: 'T', size: '50', order: 0 }, { position: 'B', size: '50', order: 1 }] },
  // ... 5 more layouts
}
```

---

### Frontend (Vue 3 + Vuetify)

#### 1. Type Definitions

**Mashup Types** (`ui/src/types/mashup.ts`)
- `MashupConfiguration` interface
- `MashupSlot` interface
- `LayoutConfig` interface
- `MASHUP_LAYOUTS` array with labels and slot counts

**Screen Type Extension** (`ui/src/types.ts`)
- Updated `Screen` interface with:
  - `type: 'file' | 'external' | 'html' | 'plugin' | 'mashup'`
  - `mashupConfiguration` relation

#### 2. State Management

**Mashup Store** (`stores/mashup.ts`)
- `fetchLayouts()` - Load available layouts from API
- `create()` - Create new mashup
- `update()` - Update existing mashup
- `getConfiguration()` - Fetch mashup configuration

#### 3. UI Components

**AddMashupCard** (`components/AddMashupCard.vue`)
- Single-form interface for creating mashups
- Dynamic plugin selectors based on selected layout
- Validation: all fields required, all slots must be filled
- Error handling with user feedback
- Data-test-id attributes for testing

**AddScreenCard Updates** (`components/AddScreenCard.vue`)
- New "Mashup" tab added
- Embeds AddMashupCard component
- Hides main form buttons when mashup tab active

**ScreenListCard Updates** (`components/ScreenListCard.vue`)
- Orange "Mashup" chip for mashup screens
- Mashup preview mode with cached output display
- Fallback alert when mashup has no cached output
- Preview button labeled "Preview mashup"

---

## 🧪 Testing

### Unit Tests (TDD/Red-Green-Refactor)

**Backend Tests:**
- `mashup-configuration.entity.spec.ts` (5 tests)
- `mashup-slot.entity.spec.ts` (5 tests)
- `screens-type.spec.ts` (4 tests)
- `mashup.service.spec.ts` (12 tests)
- `mashup-renderer.service.spec.ts` (4 tests)
- `mashup.controller.spec.ts` (9 tests)
- `plugins.service.spec.ts` (+4 tests for mashup integration)
- `plugin-scheduler.service.spec.ts` (+2 tests for cache invalidation)
- `display.service.spec.ts` (+3 tests for mashup rendering)

**Frontend Tests:**
- `ScreenListCard.spec.ts` (+3 tests for mashup display)
- All existing tests updated to handle new screen types

### Integration Tests

**Mashup Integration** (`mashup.integration.spec.ts`)
- Create mashup with two plugins in 1Lx1R layout ✅
- Update existing mashup and clear old slots ✅
- Delete mashup with cascade to configuration and slots ✅

**Plugin Deletion Integration** (`plugin-deletion-mashup.integration.spec.ts`)
- Check plugin usage returns mashup information ✅

### Coverage Metrics

```
File                          | % Stmts | % Branch | % Funcs | % Lines
------------------------------|---------|----------|---------|----------
mashup.service.ts             |   93.4  |   75.67  |   100   |   93.4
mashup-renderer.service.ts    |   94.73 |   82.35  |   100   |   94.73
mashup-configuration.entity.ts|   100   |   100    |   50    |   100
mashup-slot.entity.ts         |   100   |   100    |   25    |   100
mashup/constants/layouts.ts   |   100   |   100    |   100   |   100
------------------------------|---------|----------|---------|----------
Overall Project Coverage      |  71.38  |  84.61   |  78.86  |  71.38
```

---

## 🎯 Design Decisions

### 1. Plugin vs DevicePlugin Reference
**Decision:** MashupSlot references Plugin directly, not DevicePlugin.  
**Rationale:** 
- Plugins are global/reusable entities
- DevicePlugins are assignments that can be removed
- Mashups should survive plugin unassignment from other devices
- Simpler query structure for finding mashup usage

### 2. Partial Rendering
**Decision:** Mashup renders with error placeholders if individual plugins fail.  
**Rationale:**
- Better user experience - see working parts even if one plugin breaks
- Matches TRMNL behavior
- Uses error.png placeholder with plugin name overlay

### 3. Lazy Cache Invalidation
**Decision:** Clear mashup cache when plugin updates, not on schedule.  
**Rationale:**
- More efficient than rebuilding on every schedule
- Device re-renders mashup on next fetch
- Reduces server load

### 4. No Duplicate Plugins
**Decision:** Same plugin cannot be used twice in one mashup.  
**Rationale:**
- Matches TRMNL official behavior
- Prevents confusion (same plugin, same data)
- Forces intentional design choices

### 5. Force Flag for Plugin Deletion
**Decision:** Require `force=true` to delete plugin used in mashups.  
**Rationale:**
- Prevents accidental data loss
- User must explicitly acknowledge mashup impact
- API returns helpful error with mashup list

### 6. Layout Configuration Source
**Decision:** Layout definitions live in backend, exposed via API endpoint.  
**Rationale:**
- Single source of truth
- Frontend always has correct layout info
- Easy to add new layouts without frontend changes

---

## 📁 File Structure

```
packages/api/src/
├── mashup/
│   ├── constants/
│   │   └── layouts.ts                      # Layout definitions
│   ├── dto/
│   │   ├── create-mashup.dto.ts
│   │   └── update-mashup.dto.ts
│   ├── entities/
│   │   ├── mashup-configuration.entity.ts
│   │   └── mashup-slot.entity.ts
│   ├── services/
│   │   └── mashup-renderer.service.ts
│   ├── __test__/
│   │   ├── mashup-configuration.entity.spec.ts
│   │   ├── mashup-slot.entity.spec.ts
│   │   ├── mashup.service.spec.ts
│   │   ├── mashup-renderer.service.spec.ts
│   │   ├── mashup.controller.spec.ts
│   │   └── mashup.integration.spec.ts
│   ├── mashup.controller.ts
│   ├── mashup.service.ts
│   └── mashup.module.ts
├── migrations/
│   └── 1745908800000-AddMashupSupport.ts
├── plugins/
│   ├── __test__/
│   │   └── plugin-deletion-mashup.integration.spec.ts
│   ├── plugins.service.ts                  # Updated with checkPluginUsage()
│   └── services/
│       └── plugin-scheduler.service.ts     # Updated with invalidateMashupCaches()
├── devices/
│   └── display.service.ts                  # Updated with mashup handling
└── screens/
    ├── screens.entity.ts                   # Updated with type field
    └── __test__/
        └── screens-type.spec.ts

packages/ui/src/
├── components/
│   ├── AddMashupCard.vue                   # NEW
│   ├── AddScreenCard.vue                   # Updated with mashup tab
│   ├── ScreenListCard.vue                  # Updated with mashup display
│   └── __test__/
│       └── ScreenListCard.spec.ts          # Updated
├── stores/
│   └── mashup.ts                           # NEW
├── types/
│   ├── mashup.ts                           # NEW
│   └── types.ts                            # Updated Screen interface
```

---

## 🚀 Migration Guide

### Running the Migration

The migration runs automatically on application startup if `migrationsRun` is enabled, or manually:

```bash
pnpm run migration:run
```

### What the Migration Does

1. **Adds `type` column to `screen` table**
   - Default: 'file'
   - Backfills existing records
   - Creates index on type column

2. **Creates `mashup_configuration` table**
   - Links to screen (one-to-one)
   - Stores layout type
   - Cascade delete with screen

3. **Creates `mashup_slot` table**
   - Links to mashup_configuration
   - Links to plugin
   - Stores position, size, order
   - Indexes on plugin_id and mashup_configuration_id

### Rollback (if needed)

```bash
pnpm run migration:revert
```

---

## 🎨 UI/UX Features

### Minimal, E-ink Aesthetic
- Monochrome color scheme with orange accent for mashup chips
- High contrast, clear typography
- Minimal decoration, maximum clarity
- Follows project's "nerdy, minimal" design principles

### Progressive Disclosure
- Mashup creation hidden in tab until selected
- Dynamic slot selectors appear based on layout choice
- Clear validation feedback
- Error handling with user-friendly messages

### Responsive Design
- Works on all screen sizes
- Card-based layout for consistency
- Fluid containers and grids
- Touch-friendly controls

---

## 📝 API Documentation

### Create Mashup
```http
POST /api/mashup
Content-Type: application/json

{
  "deviceId": "device-uuid",
  "filename": "My Dashboard",
  "layout": "1Lx1R",
  "pluginIds": ["plugin-1-uuid", "plugin-2-uuid"]
}
```

**Validation:**
- Device must exist
- Plugin count must match layout's slot requirement
- All plugins must exist
- No duplicate plugins

**Response:**
```json
{
  "id": "screen-uuid",
  "type": "mashup",
  "filename": "My Dashboard",
  "isActive": true,
  "device": "device-uuid",
  "mashupConfiguration": {
    "id": "config-uuid",
    "layout": "1Lx1R",
    "slots": [...]
  }
}
```

### Update Mashup
```http
PUT /api/mashup/:screenId
Content-Type: application/json

{
  "filename": "Updated Dashboard",
  "layout": "2x2",
  "pluginIds": ["p1", "p2", "p3", "p4"]
}
```

### Delete Mashup
```http
DELETE /api/mashup/:screenId
```

### Get Mashup Configuration
```http
GET /api/mashup/:screenId/configuration
```

### Get Available Layouts
```http
GET /api/mashup/layouts
```

**Response:**
```json
{
  "1Lx1R": {
    "label": "1 Left × 1 Right",
    "slots": [
      { "position": "L", "size": "50", "order": 0 },
      { "position": "R", "size": "50", "order": 1 }
    ]
  },
  ...
}
```

---

## 🔍 Known Limitations

1. **Same Plugin Twice:** Cannot use the same plugin multiple times in one mashup (matches TRMNL behavior)
2. **Static Layouts:** Only 7 predefined layouts available (matching TRMNL official)
3. **Plugin Requirement:** All slots must be filled with valid plugins
4. **No Edit UI:** Must delete and recreate to change mashup (edit API exists, UI coming soon)

---

## 🎉 Success Metrics

✅ **All acceptance criteria met:**
- [x] 7 TRMNL layouts implemented
- [x] Validation rules enforced
- [x] Partial rendering with error handling
- [x] Cache invalidation on plugin updates
- [x] Plugin deletion safety checks
- [x] Complete UI for creation and display
- [x] 70%+ test coverage achieved (71.38%)
- [x] TDD approach followed throughout
- [x] Migration ready for production

---

## 👥 Contributors

Built with ♥ using TDD and the Red-Green-Refactor cycle!

---

## 📚 References

- [TRMNL Official Framework](https://usetrmnl.com/framework)
- [Issue #53](https://github.com/PhyberApex/kuroshiro/issues/53)
- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [Vue 3 Documentation](https://vuejs.org/)
- [Vuetify Documentation](https://vuetifyjs.com/)
