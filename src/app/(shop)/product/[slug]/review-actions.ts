"use server";

import { getDb, sql } from "@/lib/db";
import { UserFacingError, userErrorMessage } from "@/lib/userError";
import { consumeRateLimit, clientIp } from "@/lib/rateLimit";

/* ============================================================
   PUBLIC CUSTOMER REVIEW SUBMISSION (PDP "Write a review")
   Anyone can submit; the review is saved UNPUBLISHED and only
   appears on the store after an admin approves it in the admin
   Reviews page (IsPublished toggle). Rate-limited per IP.
   Errors cross the action boundary as data (prod strips thrown
   Error messages) — see lib/userError.ts.
   ============================================================ */

export async function submitProductReview(input: {
  productId: string;
  customerName: string;
  rating: number;
  message: string;
  images: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const name = (input.customerName || "").trim();
    const message = (input.message || "").trim();
    const rating = Math.round(Number(input.rating));

    if (!input.productId) throw new UserFacingError("Something went wrong — please reload the page and try again.");
    if (name.length < 2) throw new UserFacingError("Please enter your name.");
    if (name.length > 100) throw new UserFacingError("That name is too long.");
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new UserFacingError("Please choose a star rating.");
    if (message.length < 4) throw new UserFacingError("Please write a short review.");
    if (message.length > 2000) throw new UserFacingError("Your review is too long (max 2000 characters).");

    // Only trust http(s) URLs coming back from our own /api/upload; cap at 5.
    const images = (input.images || [])
      .filter((u) => typeof u === "string" && /^https?:\/\//.test(u))
      .slice(0, 5);

    // Serverless-safe throttle: max 3 review submissions per IP per 10 minutes.
    const ip = await clientIp();
    if (ip) {
      const { allowed } = await consumeRateLimit(`review:${ip}`, 3, 600);
      if (!allowed) throw new UserFacingError("You're posting reviews too quickly. Please try again in a few minutes.");
    }

    const pool = await getDb();

    // Guard against orphan/probing reviews — the product must exist.
    const prod = await pool
      .request()
      .input("pid", sql.UniqueIdentifier, input.productId)
      .query(`SELECT Id FROM Products WHERE Id = @pid`);
    if (!prod.recordset[0]) throw new UserFacingError("Product not found.");

    // Held for approval: IsPublished = false until an admin publishes it.
    const res = await pool
      .request()
      .input("ProductId", sql.UniqueIdentifier, input.productId)
      .input("CustomerName", sql.NVarChar(200), name)
      .input("Rating", sql.Int, rating)
      .input("Message", sql.NVarChar(sql.MAX), message)
      .query(`INSERT INTO Reviews (ProductId, CustomerName, Rating, Message, IsPublished, SortOrder)
              VALUES (@ProductId, @CustomerName, @Rating, @Message, false, 0)
              RETURNING Id`);
    const id = res.recordset[0].Id as string;

    for (let i = 0; i < images.length; i++) {
      await pool
        .request()
        .input("Rid", sql.UniqueIdentifier, id)
        .input("Url", sql.NVarChar(1000), images[i])
        .input("Sort", sql.Int, i)
        .query(`INSERT INTO ReviewImages (ReviewId, Url, SortOrder) VALUES (@Rid, @Url, @Sort)`);
    }

    return { ok: true };
  } catch (err) {
    const msg = userErrorMessage(err);
    if (msg) return { ok: false, error: msg };
    // Real bug — let it surface (and stay loud in logs).
    throw err;
  }
}
