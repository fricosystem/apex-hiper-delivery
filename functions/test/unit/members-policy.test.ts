import { describe, expect, it } from 'vitest';
import { roleChangeDenial, type RoleChange } from '../../src/members-policy';

const change = (over: Partial<RoleChange>): RoleChange => ({
  actorUid: 'a',
  actorRole: 'owner',
  targetUid: 'b',
  targetRole: 'attendant',
  newRole: 'manager',
  ownerCount: 1,
  ...over,
});

describe('roleChangeDenial', () => {
  it('dono promove atendente a gerente', () => {
    expect(roleChangeDenial(change({}))).toBeNull();
  });

  it('gerente muda atendente para financeiro', () => {
    expect(roleChangeDenial(change({ actorRole: 'manager', newRole: 'finance' }))).toBeNull();
  });

  it('gerente não promove a gerente nem mexe em outro gerente ou no dono', () => {
    expect(roleChangeDenial(change({ actorRole: 'manager', newRole: 'manager' }))).not.toBeNull();
    expect(
      roleChangeDenial(
        change({ actorRole: 'manager', targetRole: 'manager', newRole: 'attendant' }),
      ),
    ).not.toBeNull();
    expect(
      roleChangeDenial(change({ actorRole: 'manager', targetRole: 'owner', newRole: null })),
    ).not.toBeNull();
  });

  it('gerente pode sair da empresa, mas não mudar o próprio perfil', () => {
    const self = { actorRole: 'manager', targetUid: 'a', targetRole: 'manager' } as const;
    expect(roleChangeDenial(change({ ...self, newRole: null }))).toBeNull();
    expect(roleChangeDenial(change({ ...self, newRole: 'attendant' }))).not.toBeNull();
  });

  it('atendente e financeiro não gerenciam a equipe', () => {
    expect(roleChangeDenial(change({ actorRole: 'attendant', newRole: 'picker' }))).not.toBeNull();
    expect(roleChangeDenial(change({ actorRole: 'finance', newRole: null }))).not.toBeNull();
  });

  it('a empresa nunca fica sem dono', () => {
    const lastOwner = { targetUid: 'a', targetRole: 'owner', ownerCount: 1 } as const;
    expect(roleChangeDenial(change({ ...lastOwner, newRole: 'manager' }))).not.toBeNull();
    expect(roleChangeDenial(change({ ...lastOwner, newRole: null }))).not.toBeNull();
    expect(roleChangeDenial(change({ ...lastOwner, ownerCount: 2, newRole: null }))).toBeNull();
  });
});
