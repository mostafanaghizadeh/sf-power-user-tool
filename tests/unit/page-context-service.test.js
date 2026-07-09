import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock storage + config so services import cleanly in a node test env.
vi.mock('../../src/storage/storage-manager.js', () => ({
  StorageManager: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
}));

import { PageContextService } from '../../src/services/page-context-service.js';

describe('PageContextService._cleanPath', () => {
  const c = PageContextService._cleanPath;
  it('strips session tokens but keeps functional params', () => {
    expect(c('/sf/admin?bplte_company=X&_s.crb=abc')).toBe('/sf/admin');
    expect(c('/acme?fbacme_n=my_forms&bplte_company=X')).toBe('/acme?fbacme_n=my_forms');
    expect(c('/sf/learning?Treat-As=WEB&_s.crb=z')).toBe('/sf/learning?Treat-As=WEB');
  });
  it('returns null for external (non-slash) URLs', () => {
    expect(c('https://external.example.com')).toBeNull();
    expect(c('javascript:void(0)')).toBeNull();
  });
  it('leaves a clean path untouched', () => {
    expect(c('/sf/home')).toBe('/sf/home');
  });
});

describe('PageContextService.readPageHeader whitelist', () => {
  beforeEach(() => {
    globalThis.window = {
      pageHeaderJsonData: {
        baseUrl: 'https://hcm-us20-sales.hr.cloud.sap',
        companyId: 'SFCPART002234',
        companyName: 'Demo Co',
        uiVersion: 'V12',
        fioriEnabled: true,
        settings: { releaseVersionNumber: '2606SD.2026', securityPolicyEnabled: 'false' },
        pageInfo: { moduleId: 'ADMIN', pageId: 'ADMIN' },
        // sensitive — must NOT appear in output
        userInfo: { firstName: 'Mostafa', personId: 6535, userName: 'Admin_MNA' },
        proxyBean: { url: '' },
      },
    };
  });

  it('returns only whitelisted fields and no PII', () => {
    const ctx = PageContextService.readPageHeader();
    expect(ctx.companyId).toBe('SFCPART002234');
    expect(ctx.settings.releaseVersionNumber).toBe('2606SD.2026');
    expect(ctx.pageInfo.moduleId).toBe('ADMIN');
    // PII / non-whitelisted must be absent
    expect(ctx.userInfo).toBeUndefined();
    expect(ctx.proxyBean).toBeUndefined();
    expect(ctx.settings.securityPolicyEnabled).toBeUndefined();
    const flat = JSON.stringify(ctx).toLowerCase();
    expect(flat.includes('mostafa')).toBe(false);
    expect(flat.includes('6535')).toBe(false);
    expect(flat.includes('admin_mna')).toBe(false);
  });

  it('returns null when the global is absent', () => {
    globalThis.window = {};
    expect(PageContextService.readPageHeader()).toBeNull();
  });
});
