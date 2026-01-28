# Ghana Waste Facilities Database Migration

## Overview

This migration adds **comprehensive Ghana waste management facilities** to the existing `disposal_centers` table, including:
- Major landfills across all regions
- IRECOP/ACARP recycling plants
- E-waste facilities
- Waste-to-energy treatment plants
- Regional Zoomlion offices

## Files

| File | Purpose |
|------|---------|
| `add-ghana-waste-facilities.sql` | **Main migration script** - Run this to add facilities |
| `ghana_waste_facilities_database.sql` | Reference database (standalone, for backup) |
| `ghana_waste_facilities.json` | JSON format for frontend/API use |

## How to Apply Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the contents of `add-ghana-waste-facilities.sql`
5. Click **Run** to execute

### Option 2: Supabase CLI

```bash
# If you have Supabase CLI configured
supabase db push --db-url "your-database-url" < scripts/add-ghana-waste-facilities.sql
```

### Option 3: Direct PostgreSQL

```bash
psql "your-database-connection-string" -f scripts/add-ghana-waste-facilities.sql
```

## What the Migration Does

### 1. Adds New Columns (if not exist)
```sql
- region VARCHAR(100)
- district VARCHAR(150)
- operating_hours VARCHAR(100)
- phone VARCHAR(100)
- rating DECIMAL(2,1)
- capacity_notes TEXT
- status VARCHAR(50)
```

### 2. Inserts Facilities

| Category | Count | Examples |
|----------|-------|----------|
| Landfills | 12 | Oblogo, Dompoase, Sofokrom, Tamale |
| IRECOP/Recycling Plants | 4 | ACARP, KCARP, Sunyani, Nalerigu |
| E-Waste | 1 | Electro Recycling Ghana |
| Treatment Plants | 2 | Safi Sana, Sofokrom Fecal Treatment |
| Regional Centers | 8 | Zoomlion offices, Jekora, Nelplast |

### 3. Creates Indexes
```sql
- idx_disposal_centers_region
- idx_disposal_centers_status
```

## Verification

After running the migration, verify with:

```sql
-- Check total count
SELECT COUNT(*) FROM disposal_centers;

-- Check by region
SELECT region, COUNT(*) 
FROM disposal_centers 
GROUP BY region 
ORDER BY COUNT(*) DESC;

-- Check by center type
SELECT center_type, COUNT(*) 
FROM disposal_centers 
GROUP BY center_type;
```

## UI Changes

The `DisposalModal` component has been enhanced to:

1. **Filter by center type** - Buttons at top: All, Landfill, Recycling, E-Waste, etc.
2. **Display region/district** - Shows location hierarchy
3. **Center type badges** - Color-coded badges (amber=landfill, green=recycling, etc.)
4. **Phone contact** - Click-to-call for facilities with phone numbers
5. **Waste types** - Shows accepted waste types

## Rollback

To remove the added facilities (keeps existing data):

```sql
DELETE FROM disposal_centers 
WHERE region IS NOT NULL 
AND created_at > '2026-01-01';
```

## Data Sources

- Wikipedia (coordinates)
- ResearchGate academic papers
- Zoomlion Ghana official website
- Ghana Streets OpenAlfa database
- IRECOP/ACARP official websites
- EPA Ghana

## Support

For issues with this migration, check:
1. Supabase connection is working
2. PostGIS extension is enabled
3. Table `disposal_centers` exists

---

**Last Updated:** January 2026
