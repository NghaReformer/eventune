# Product-Based Pricing Implementation

## Overview

This document outlines the implementation of the new product-based pricing structure for Eventune Studios, replacing the old package system with a more flexible product + add-ons model.

## Changes Summary

### Database Changes

#### New Tables Created

1. **config_video_products** - Lyric videos and music videos as add-ons
   - Categories: `lyric_video`, `music_video`
   - Includes pricing in both USD and XAF
   - Tracks additional delivery days

2. **config_addons** - Flexible add-on system
   - Categories: `delivery`, `revision`, `license`, `extra`, `physical`
   - Supports both fixed pricing and percentage-based pricing
   - Examples: Rush delivery, extra revisions, commercial licenses, physical CDs

3. **config_bundles** - Multi-song discount packages
   - Tracks song count and discount percentage
   - Examples: EP Bundle (3 songs, 15% off), Mini Album (5 songs, 20% off), Full Album (10 songs, 30% off)

#### Updated Tables

**config_packages** - Replaced old packages with new song tiers:
- Quick Tune: $35 / 17,500 XAF - 30s-1min songs for jingles/clips
- Single: $99 / 50,000 XAF - 2-3min complete songs (MOST POPULAR)
- Extended: $159 / 80,000 XAF - 3-4min with discovery call
- Epic: $219 / 110,000 XAF - 4-5min with full production

### Migration File

**Location**: `/supabase/migrations/00010_add_product_based_pricing.sql`

This migration:
1. Creates the 3 new tables with proper constraints
2. Enables Row Level Security (RLS) on all new tables
3. Creates public read policies for active products
4. Updates config_packages with new song tiers
5. Seeds video products (6 options)
6. Seeds add-ons (10 options across 5 categories)
7. Seeds bundles (3 options)
8. Updates FAQ entries for new pricing model
9. Creates performance indexes

### TypeScript Type Updates

**Location**: `/src/types/database.types.ts`

Added type definitions for:
- `config_video_products` (Row, Insert, Update)
- `config_addons` (Row, Insert, Update)
- `config_bundles` (Row, Insert, Update)

### Service Layer Updates

**Location**: `/src/services/config.service.ts`

Added new functions:

**Video Products:**
- `getVideoProducts()` - Get all active video products
- `getVideoProductsByCategory(category)` - Filter by lyric_video or music_video
- `getVideoProductBySlug(slug)` - Get single video product

**Add-ons:**
- `getAddons()` - Get all active add-ons
- `getAddonsByCategory(category)` - Filter by category
- `getAddonBySlug(slug)` - Get single add-on
- `calculateAddonPrice(addon, basePrice, currency)` - Calculate price for both fixed and percentage types

**Bundles:**
- `getBundles()` - Get all active bundles
- `getBundleBySlug(slug)` - Get single bundle
- `calculateBundlePrice(bundle, singleSongPrice)` - Calculate total price with discount

**Updated:**
- `getPublicConfig()` - Now includes videoProducts, addons, and bundles
- Realtime subscription now watches new tables for cache invalidation

### Frontend Updates

**Location**: `/src/pages/services.astro`

Complete redesign featuring:

1. **Song Tiers Section** - Base song products with 4 pricing tiers
2. **Video Add-ons Section** - 6 video options grouped by category
3. **Customize Your Order Section** - 10 add-ons organized by:
   - Delivery options (Rush, Express)
   - Revision packs
   - Extra features (Instrumental, Discovery Call)
   - Licenses (Commercial, Full Ownership)
   - Physical products (CD, Vinyl)
4. **Multi-Song Bundles Section** - Volume discounts
5. **Currency Toggle** - Seamless USD/XAF switching

## Pricing Structure

### Song Tiers

| Tier | USD | XAF | Length | Delivery | Revisions | Discovery Call | Instrumental |
|------|-----|-----|--------|----------|-----------|----------------|--------------|
| Quick Tune | $35 | 17,500 | 30s-1min | 5-7 days | 1 | No | No |
| Single | $99 | 50,000 | 2-3min | 7-10 days | 1 | No | No |
| Extended | $159 | 80,000 | 3-4min | 7-10 days | 1 | Yes | No |
| Epic | $219 | 110,000 | 4-5min | 7-10 days | 2 | Yes | Yes |

### Video Add-ons

**Lyric Videos:**
- Basic Lyric: $39 / 20,000 XAF (+2 days)
- Animated Lyric: $79 / 40,000 XAF (+3 days)
- Premium Lyric: $149 / 75,000 XAF (+5 days)

**Music Videos:**
- Slideshow Video: $49 / 25,000 XAF (+2 days)
- Visual Story: $149 / 75,000 XAF (+5 days)
- Custom Music Video: $349 / 175,000 XAF (+10 days)

### Other Add-ons

**Delivery:**
- Rush Delivery (48-72h): +50% of base price
- Express Delivery (4-5 days): +25% of base price

**Revisions:**
- Extra Revision: $25 / 12,500 XAF
- Revision Pack (3): $59 / 30,000 XAF

**Extras:**
- Instrumental Track: $29 / 15,000 XAF
- Discovery Call: $29 / 15,000 XAF

**Licenses:**
- Commercial License: $79 / 40,000 XAF
- Full Ownership Rights: $149 / 75,000 XAF

**Physical:**
- Physical CD: $19 / 10,000 XAF
- Vinyl Record: $49 / 25,000 XAF

### Bundles

| Bundle | Songs | Discount |
|--------|-------|----------|
| EP Bundle | 3 | 15% |
| Mini Album | 5 | 20% |
| Full Album | 10 | 30% |

## Implementation Steps

### 1. Apply Database Migration

```bash
# Using Supabase CLI
supabase db push

# Or using the migration tool of your choice
```

### 2. Verify Data

Check that all new tables are created and seeded:
```sql
SELECT * FROM config_video_products;
SELECT * FROM config_addons;
SELECT * FROM config_bundles;
SELECT * FROM config_packages; -- Should show new song tiers
```

### 3. Update Orders Table (Future Work)

The `orders` table will need modifications to support:
- Selected add-ons (JSON array or separate table)
- Selected video products
- Bundle information
- Total price calculation breakdown

Suggested schema update:
```sql
ALTER TABLE orders ADD COLUMN selected_addons JSONB DEFAULT '[]';
ALTER TABLE orders ADD COLUMN selected_video_product TEXT REFERENCES config_video_products(slug);
ALTER TABLE orders ADD COLUMN bundle_slug TEXT REFERENCES config_bundles(slug);
ALTER TABLE orders ADD COLUMN price_breakdown JSONB; -- { base, addons, video, total }
```

### 4. Update Order Flow Page

**Location**: `/src/pages/order/[occasion].astro`

Needs to be updated to:
1. Show new song tiers instead of old packages
2. Add video product selection step
3. Add other add-ons selection step
4. Calculate total price with all selections
5. Pass selected add-ons to checkout

### 5. Update Checkout Flow

**Location**: `/src/pages/order/checkout.astro`

Needs to:
1. Display selected base tier
2. Display selected add-ons with prices
3. Calculate and display total
4. Store add-on selections in order record

## Benefits of New System

1. **Flexibility** - Customers build their own packages
2. **Scalability** - Easy to add new add-ons without code changes
3. **Transparency** - Clear pricing for each feature
4. **Revenue Optimization** - Higher average order value through add-ons
5. **Competitive Positioning** - Lower entry point ($35 vs $149)
6. **Upsell Opportunities** - Multiple touchpoints for add-ons

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] All seed data is inserted correctly
- [ ] RLS policies work (public can read, admins can modify)
- [ ] TypeScript types compile without errors
- [ ] Services page displays all products correctly
- [ ] Currency toggle switches prices correctly
- [ ] Order flow allows product + add-on selection
- [ ] Checkout calculates total price correctly
- [ ] Price calculation functions handle edge cases
- [ ] Bundle discounts calculate correctly
- [ ] Percentage-based add-ons calculate correctly

## Next Steps

1. **Update Order Flow** - Implement add-on selection in order pages
2. **Update Checkout** - Display breakdown and calculate totals
3. **Admin Dashboard** - Add CRUD for new product types
4. **Analytics** - Track most popular add-ons and bundles
5. **A/B Testing** - Test pricing and bundling strategies
6. **Documentation** - Update customer FAQs with new pricing

## Files Modified

1. `/supabase/migrations/00010_add_product_based_pricing.sql` - NEW
2. `/src/types/database.types.ts` - UPDATED
3. `/src/services/config.service.ts` - UPDATED
4. `/src/pages/services.astro` - COMPLETELY REWRITTEN
5. `/docs/product-based-pricing-implementation.md` - NEW (this file)

## Files That Need Updates (Not Done Yet)

1. `/src/pages/order/[occasion].astro` - Add add-on selection
2. `/src/pages/order/checkout.astro` - Add pricing breakdown
3. Admin dashboard pages - CRUD for new tables
4. Order creation API - Handle add-ons in order creation

---

**Implementation Date**: December 27, 2025
**Status**: Database and frontend pricing display complete. Order flow updates pending.
