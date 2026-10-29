import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { storagePaths } from '@hiper/shared';
import { A, as, B, createEnv, staffOf } from './setup';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearStorage();
});

const bytes = (size = 1024) => new Uint8Array(size);
const png = { contentType: 'image/png' };
const photo = storagePaths.productPhoto(A, 'p1', 'capa.png');

describe('Storage', () => {
  it('dono da empresa envia foto de produto; qualquer pessoa vê', async () => {
    await assertSucceeds(uploadBytes(ref(staffOf(env, A, 'owner').storage(), photo), bytes(), png));
    await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), photo)));
  });

  it('outra empresa não envia nem apaga foto da empresa A', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), photo), bytes(), png);
    });
    const s = staffOf(env, B, 'owner').storage();
    await assertFails(uploadBytes(ref(s, photo), bytes(), png));
    await assertFails(deleteObject(ref(s, photo)));
  });

  it('atendente não troca fotos', async () => {
    await assertFails(
      uploadBytes(ref(staffOf(env, A, 'attendant').storage(), photo), bytes(), png),
    );
  });

  it('só imagem de até 5 MB na área pública', async () => {
    const s = staffOf(env, A, 'owner').storage();
    await assertFails(uploadBytes(ref(s, photo), bytes(), { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(s, photo), bytes(5 * 1024 * 1024 + 1), png));
  });

  it('arquivos privados só para dono, gerente e financeiro da empresa', async () => {
    const path = storagePaths.tenantPrivate(A, 'nfe/123.xml');
    const xml = { contentType: 'application/xml' };
    await assertSucceeds(
      uploadBytes(ref(staffOf(env, A, 'finance').storage(), path), bytes(), xml),
    );
    await assertSucceeds(getBytes(ref(staffOf(env, A, 'owner').storage(), path)));
    await assertFails(getBytes(ref(staffOf(env, A, 'attendant').storage(), path)));
    await assertFails(getBytes(ref(staffOf(env, B, 'owner').storage(), path)));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), path)));
  });

  it('arquivos pessoais só do próprio usuário', async () => {
    const path = storagePaths.userFile('maria', 'receita.pdf');
    const pdf = { contentType: 'application/pdf' };
    await assertSucceeds(uploadBytes(ref(as(env, 'maria').storage(), path), bytes(), pdf));
    await assertFails(getBytes(ref(as(env, 'joao').storage(), path)));
    await assertFails(getBytes(ref(staffOf(env, A, 'owner').storage(), path)));
  });

  it('caminhos fora do modelo são negados', async () => {
    await assertFails(
      uploadBytes(ref(staffOf(env, A, 'owner').storage(), 'solto.png'), bytes(), png),
    );
  });
});
