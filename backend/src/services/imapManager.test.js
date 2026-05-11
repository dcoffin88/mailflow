import { describe, it, expect, vi } from 'vitest';

vi.mock('imapflow', () => ({ ImapFlow: vi.fn() }));
vi.mock('./db.js', () => ({ query: vi.fn() }));
vi.mock('./messageParser.js', () => ({ parseMessage: vi.fn(), buildSnippetFromHtml: vi.fn() }));
vi.mock('../routes/oauth.js', () => ({ refreshMicrosoftToken: vi.fn() }));
vi.mock('./emailSanitizer.js', () => ({ sanitizeEmail: vi.fn() }));
vi.mock('./encryption.js', () => ({ decrypt: vi.fn() }));
vi.mock('./pushNotifications.js', () => ({ sendPushToUser: vi.fn() }));
vi.mock('../utils/redact.js', () => ({ redactEmail: vi.fn() }));
vi.mock('./hostValidation.js', () => ({ resolveForConnection: vi.fn() }));

import { providerProfile } from './imapManager.js';

const account = (imap_host, oauth_provider = null) => ({ imap_host, oauth_provider });

// ── providerProfile — host detection ─────────────────────────────────────────

describe('providerProfile — host detection', () => {
  it.each([
    ['imap.gmail.com'],
    ['imap.googlemail.com'],
  ])('detects google for %s', host => {
    expect(providerProfile(account(host)).pushesFlags).toBe(false);
    expect(providerProfile(account(host)).speculativeFetch).toBe(false);
    expect(providerProfile(account(host)).snippetIndex).toBe(false);
  });

  it.each([
    ['imap.mail.yahoo.com'],
    ['imap.ymail.com'],
    ['smtp.mail.yahoo.com'],
  ])('detects yahoo for %s', host => {
    expect(providerProfile(account(host)).speculativeFetch).toBe(false);
    expect(providerProfile(account(host)).pushesFlags).toBe(true);
    expect(providerProfile(account(host)).snippetIndex).toBe(true);
  });

  it.each([
    ['imap.mail.me.com'],
    ['imap.icloud.com'],
    ['mail.apple.com'],
  ])('detects apple for %s', host => {
    expect(providerProfile(account(host)).speculativeFetch).toBe(true);
    expect(providerProfile(account(host)).batchSize).toBe(200);
  });

  it.each([
    ['outlook.office365.com'],
    ['imap.hotmail.com'],
    ['imap.live.com'],
  ])('detects microsoft for %s', host => {
    expect(providerProfile(account(host)).speculativeFetch).toBe(true);
    expect(providerProfile(account(host)).pushesFlags).toBe(true);
  });

  it('falls back to generic for an unknown host', () => {
    const p = providerProfile(account('mail.purelymail.com'));
    expect(p.speculativeFetch).toBe(true);
    expect(p.pushesFlags).toBe(true);
    expect(p.snippetIndex).toBe(true);
  });
});

// ── providerProfile — oauth_provider detection ────────────────────────────────

describe('providerProfile — oauth_provider fallback', () => {
  it('detects google via oauth_provider when host is empty', () => {
    expect(providerProfile(account('', 'google')).pushesFlags).toBe(false);
  });

  it('detects yahoo via oauth_provider when host is empty', () => {
    expect(providerProfile(account('', 'yahoo')).speculativeFetch).toBe(false);
  });

  it('detects microsoft via oauth_provider when host is empty', () => {
    expect(providerProfile(account('', 'microsoft')).pushesFlags).toBe(true);
  });

  it('detects apple via oauth_provider when host is empty', () => {
    expect(providerProfile(account('', 'apple')).batchSize).toBe(200);
  });
});

// ── providerProfile — skipFolderPatterns ─────────────────────────────────────

describe('providerProfile — skipFolderPatterns', () => {
  it('google skips All Mail, Starred, Important', () => {
    const { skipFolderPatterns } = providerProfile(account('imap.gmail.com'));
    expect(skipFolderPatterns.some(p => '[Gmail]/All Mail'.toLowerCase().includes(p))).toBe(true);
    expect(skipFolderPatterns.some(p => '[Gmail]/Starred'.toLowerCase().includes(p))).toBe(true);
    expect(skipFolderPatterns.some(p => '[Gmail]/Important'.toLowerCase().includes(p))).toBe(true);
  });

  it('yahoo has no skip patterns', () => {
    expect(providerProfile(account('imap.mail.yahoo.com')).skipFolderPatterns).toHaveLength(0);
  });

  it('generic has no skip patterns', () => {
    expect(providerProfile(account('mail.purelymail.com')).skipFolderPatterns).toHaveLength(0);
  });
});

// ── providerProfile — robustness ──────────────────────────────────────────────

describe('providerProfile — robustness', () => {
  it('handles null imap_host gracefully', () => {
    expect(() => providerProfile({ imap_host: null, oauth_provider: null })).not.toThrow();
  });

  it('handles missing fields gracefully', () => {
    expect(() => providerProfile({})).not.toThrow();
  });

  it('is case-insensitive for host matching', () => {
    expect(providerProfile(account('IMAP.GMAIL.COM')).pushesFlags).toBe(false);
  });
});
