#!/usr/bin/env tsx
// scripts/backfill-instruments-for-deeds.ts
/**
 * Backfill script to create instrument records for existing deeds
 * 
 * This script is idempotent: it skips deeds that already have instruments.
 * Safe to run multiple times.
 * 
 * Usage:
 *   tsx scripts/backfill-instruments-for-deeds.ts [--dry-run] [--batch-size=250]
 */

import { getDb } from "../src/lib/db";
import { deeds, instruments } from "../src/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { createInstrumentForDeed } from "../src/lib/instruments/instrument-factory";

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "250", 10);
const DRY_RUN = process.argv.includes("--dry-run");

async function backfillInstruments() {
  console.log("Starting instrument backfill for deeds...");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log(`Batch size: ${BATCH_SIZE}`);

  const db = await getDb();

  // Find deeds without instruments
  const deedsWithoutInstruments = await db
    .select()
    .from(deeds)
    .where(isNull(deeds.instrumentId));

  const totalCount = deedsWithoutInstruments.length;
  console.log(`Found ${totalCount} deeds without instruments`);

  if (totalCount === 0) {
    console.log("No deeds to process. Exiting.");
    return;
  }

  let processed = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < totalCount; i += BATCH_SIZE) {
    const batch = deedsWithoutInstruments.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} deeds)...`);

    for (const deed of batch) {
      try {
        // Validate context
        if (!deed.trustId && !deed.entityId) {
          console.warn(`  ⚠️  Deed ${deed.id} has neither trustId nor entityId, skipping`);
          skipped++;
          continue;
        }

        if (deed.trustId && deed.entityId) {
          console.warn(`  ⚠️  Deed ${deed.id} has both trustId and entityId, skipping`);
          skipped++;
          continue;
        }

        // Check if instrument already exists (by concreteId)
        const existing = await db
          .select()
          .from(instruments)
          .where(and(
            eq(instruments.concreteId, deed.id),
            eq(instruments.concreteType, "DEED")
          ))
          .limit(1);

        if (existing.length > 0) {
          console.log(`  ✓ Deed ${deed.id} already has instrument ${existing[0].id}, skipping`);
          skipped++;
          continue;
        }

        if (DRY_RUN) {
          console.log(`  [DRY RUN] Would create instrument for deed ${deed.id}`);
          created++;
        } else {
          // Create instrument
          const instrumentId = await createInstrumentForDeed(deed.id, {
            trustId: deed.trustId,
            entityId: deed.entityId,
          });
          console.log(`  ✓ Created instrument ${instrumentId} for deed ${deed.id}`);
          created++;
        }

        processed++;
      } catch (error) {
        console.error(`  ✗ Error processing deed ${deed.id}:`, error);
        errors++;
      }
    }

    // Progress update
    console.log(
      `\nProgress: ${Math.min(i + BATCH_SIZE, totalCount)}/${totalCount} (${Math.round(
        ((Math.min(i + BATCH_SIZE, totalCount) / totalCount) * 100)
      )}%)`
    );
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("Backfill Summary:");
  console.log(`  Total deeds scanned: ${totalCount}`);
  console.log(`  Instruments created: ${created}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Processed: ${processed}`);
  console.log("=".repeat(50));

  if (DRY_RUN) {
    console.log("\n⚠️  This was a DRY RUN. No changes were made.");
    console.log("Run without --dry-run to apply changes.");
  }
}

// Run the backfill
backfillInstruments()
  .then(() => {
    console.log("\nBackfill completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nBackfill failed:", error);
    process.exit(1);
  });
