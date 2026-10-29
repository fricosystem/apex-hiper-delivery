import { describe, expect, it } from 'vitest';
import { withTenantClaims } from '../../src/claims';

describe('withTenantClaims', () => {
  it('grava empresa e perfil preservando outros claims', () => {
    expect(withTenantClaims({ courier: true }, 't1', 'owner')).toEqual({
      courier: true,
      tid: 't1',
      role: 'owner',
    });
  });

  it('remove o vínculo com a empresa', () => {
    expect(
      withTenantClaims({ tid: 't1', role: 'attendant', staff: 'support' }, 't1', null),
    ).toEqual({
      staff: 'support',
    });
    expect(withTenantClaims(undefined, 't1', null)).toEqual({});
  });
});
