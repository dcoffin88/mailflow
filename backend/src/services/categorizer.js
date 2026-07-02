import { query } from './db.js';
import { detectCategoryFromHeaders } from './messageParser.js';

// In-memory cache of social domains per user. Populated on first use,
// invalidated when the user updates their category_list_sources.
// Structure: Map<userId, { domains: Set<string>, expiry: number }>
const socialDomainCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateSocialDomainCache(userId) {
  socialDomainCache.delete(userId);
}

// Cache for per-user global categorization preference (from users.preferences JSONB).
// Structure: Map<userId, { value: boolean, expiry: number }>
const globalCategorizationCache = new Map();

export async function getGlobalCategorizationEnabled(userId) {
  const cached = globalCategorizationCache.get(userId);
  if (cached && cached.expiry > Date.now()) return cached.value;
  const result = await query(
    "SELECT (preferences->>'categorizationEnabled')::boolean AS val FROM users WHERE id = $1",
    [userId]
  );
  const value = result.rows[0]?.val === true;
  globalCategorizationCache.set(userId, { value, expiry: Date.now() + CACHE_TTL_MS });
  return value;
}

export function invalidateGlobalCategorizationCache(userId) {
  globalCategorizationCache.delete(userId);
}

// Known built-in social domain sets bundled with the app.
// Users enable these by name; domains are resolved here, not in the DB.
const BUILTIN_SETS = {
  social_networks: [
    'facebookmail.com', 'notification.facebook.com', 'facebookappmail.com',
    'twitteremail.com', 'mail.twitter.com', 'x.com',
    'linkedin.com', 'notifications.linkedin.com',
    'instagrammail.com', 'notification.instagram.com',
    'tiktok.com', 'emailmg.tiktok.com',
    'redditmail.com', 'reddit.com',
    'pinterest.com', 'email.pinterest.com',
    'snapchat.com',
    'discordapp.com', 'discord.com',
  ],
  developer_platforms: [
    'github.com', 'noreply.github.com', 'notifications.github.com',
    'gitlab.com', 'noreply.gitlab.com',
    'npmjs.com', 'stackoverflow.com',
    'hackerrank.com', 'leetcode.com',
  ],
};

async function loadSocialDomains(userId) {
  const cached = socialDomainCache.get(userId);
  if (cached && cached.expiry > Date.now()) return cached.domains;

  const result = await query(
    `SELECT source_type, value, resolved_domains
     FROM category_list_sources
     WHERE user_id = $1 AND enabled = true`,
    [userId]
  );

  const domains = new Set();
  for (const row of result.rows) {
    if (row.source_type === 'manual') {
      domains.add(row.value.toLowerCase().trim());
    } else if (row.source_type === 'builtin') {
      const set = BUILTIN_SETS[row.value];
      if (set) set.forEach(d => domains.add(d));
    } else if (row.source_type === 'url' && Array.isArray(row.resolved_domains)) {
      row.resolved_domains.forEach(d => domains.add(d.toLowerCase().trim()));
    }
  }

  socialDomainCache.set(userId, { domains, expiry: Date.now() + CACHE_TTL_MS });
  return domains;
}

// Determines the category for a single message given its parsed headers,
// sender address, and the user's social domain set.
// Returns 'primary' | 'newsletter' | 'promotion' | 'automated' | 'social'.
export function classifyMessage(parsedHeaders, fromEmail, socialDomains) {
  // Social check first — user intent overrides header-based detection.
  if (socialDomains && socialDomains.size > 0 && fromEmail) {
    const addr = fromEmail.toLowerCase().trim();
    const atIdx = addr.indexOf('@');
    const domain = atIdx >= 0 ? addr.slice(atIdx + 1) : null;
    if (socialDomains.has(addr)) return 'social';
    if (domain && socialDomains.has(domain)) return 'social';
  }

  const headerCategory = detectCategoryFromHeaders(parsedHeaders);
  return headerCategory ?? 'primary';
}

// Assigns a category to a message and writes it to the DB.
// Used during IMAP sync for new messages when categorization is enabled.
export async function categorizeAndStore(messageId, parsedHeaders, fromEmail, userId) {
  const socialDomains = await loadSocialDomains(userId);
  const category = classifyMessage(parsedHeaders, fromEmail, socialDomains);
  if (category !== 'primary') {
    await query('UPDATE messages SET category = $1 WHERE id = $2', [category, messageId]);
  }
  return category;
}

// Backfills categories for all uncategorized messages belonging to an account.
// Fetches headers from DB (is_bulk + from_email are already stored) and applies
// header-based detection without an IMAP round-trip. Social domain matching
// requires a separate header fetch and is handled in imapManager.refreshCategories().
export async function backfillCategories(accountId, userId) {
  const socialDomains = await loadSocialDomains(userId);

  // Process in batches of 500 to avoid memory pressure.
  const BATCH = 500;
  let offset = 0;
  let processed = 0;

  for (;;) {
    const result = await query(
      `SELECT id, from_email, is_bulk
       FROM messages
       WHERE account_id = $1
         AND category IS NULL
         AND is_deleted = false
       ORDER BY date DESC
       LIMIT $2 OFFSET $3`,
      [accountId, BATCH, offset]
    );
    if (!result.rows.length) break;

    const ids = [];
    const categories = [];

    for (const row of result.rows) {
      // For backfill without re-fetching IMAP headers, derive from is_bulk
      // (which already encodes the newsletter signal) and social domain check.
      let category = 'primary';

      if (socialDomains && socialDomains.size > 0 && row.from_email) {
        const addr = row.from_email.toLowerCase().trim();
        const atIdx = addr.indexOf('@');
        const domain = atIdx >= 0 ? addr.slice(atIdx + 1) : null;
        if (socialDomains.has(addr) || (domain && socialDomains.has(domain))) {
          category = 'social';
        }
      }

      if (category === 'primary' && row.is_bulk) {
        category = 'newsletter';
      }

      if (category !== 'primary') {
        ids.push(row.id);
        categories.push(category);
      }
    }

    if (ids.length > 0) {
      await query(
        `UPDATE messages SET category = v.category
         FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS category) AS v
         WHERE messages.id = v.id`,
        [ids, categories]
      );
    }

    processed += result.rows.length;
    offset += BATCH;
    if (result.rows.length < BATCH) break;
  }

  return processed;
}

export { BUILTIN_SETS, loadSocialDomains };
