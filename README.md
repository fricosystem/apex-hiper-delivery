# Hiper Delivery

Delivery próprio para qualquer comércio (loja online, pedidos, pagamento, notificações e gestão) mais uma rede aberta de entregadores verificados. O plano completo do produto está no documento [Hiper Delivery: plano de implementação](https://claude.ai/artifact/VTe25pApY1xpBytt8U9Ywm).

Este repositório é um monorepo TypeScript com o Firebase como backend completo (Firestore, Authentication, Cloud Functions, Storage e Cloud Messaging), na região de São Paulo (`southamerica-east1`).

## Estrutura

| Pasta             | Pacote             | O quê                                                                         |
| ----------------- | ------------------ | ----------------------------------------------------------------------------- |
| `packages/shared` | `@hiper/shared`    | Tipos, schemas (zod) e regras de negócio usados por Functions, painéis e apps |
| `functions`       | `@hiper/functions` | Cloud Functions (2ª geração)                                                  |
| `firebase`        | `@hiper/firebase`  | Security Rules do Firestore e do Storage, índices e testes no emulador        |
| `apps`            |                    | Painéis Next.js e apps Expo (próximas etapas)                                 |

Ferramentas: pnpm workspaces, Turborepo, Vitest, esbuild e o Firebase Emulator Suite.

## Começando

Requisitos: Node 22, pnpm 10 e Java 21 (para os emuladores).

```bash
pnpm install
pnpm test            # testes unitários (shared e functions)
pnpm test:rules      # Security Rules no emulador: isolamento entre empresas e perfis
pnpm test:integration # Functions no emulador, de ponta a ponta
pnpm emulators       # sobe Auth, Firestore, Functions e Storage com a interface em localhost:4000
```

Até as credenciais reais existirem, tudo roda no projeto de demonstração `demo-hiper-delivery`, que só existe no emulador e não gasta cota.

### Ligando aos projetos reais

O plano prevê três projetos Firebase separados (desenvolvimento, homologação e produção), todos no plano Blaze e com o Firestore em `southamerica-east1`. Depois de criá-los:

```bash
pnpm exec firebase login
pnpm exec firebase use --add   # escolha o projeto e dê o apelido dev, staging ou prod
pnpm exec firebase deploy --only firestore,storage,functions
```

## Isolamento por empresa

Cada empresa (tenant) tem sua árvore em `tenants/{tenantId}/...`. Ao cadastrar a empresa ou adicionar alguém à equipe, uma Cloud Function grava nos custom claims do token a empresa (`tid`) e o perfil (`role`). As Security Rules só liberam leitura e escrita quando o `tid` do token é igual ao do caminho e o perfil tem permissão, sem ler outros documentos (economiza leituras).

| Perfil (`role`) | Produtos e categorias | Custo e fornecedores | Cadastro da empresa       | Equipe                     |
| --------------- | --------------------- | -------------------- | ------------------------- | -------------------------- |
| `owner`         | Lê e edita            | Lê e edita           | Edita, inclusive o fiscal | Gerencia todos             |
| `manager`       | Lê e edita            | Lê e edita           | Edita dados operacionais  | Gerencia abaixo de gerente |
| `finance`       | Lê                    | Lê e edita           | Lê                        | Vê só o próprio            |
| `hr`            | Lê                    | Não vê               | Lê                        | Vê só o próprio            |
| `attendant`     | Lê e pausa produto    | Não vê               | Lê                        | Vê só o próprio            |
| `picker`        | Lê                    | Não vê               | Lê                        | Vê só o próprio            |

Outros claims: `courier` (entregador da rede) e `staff` (equipe interna do Hiper Delivery, que lê o cadastro das empresas mas não os dados internos delas).

Regras que valem para todo o projeto:

- Status da assinatura, plano, equipe, catálogo público e auditoria só são gravados por Functions.
- Custo de compra e fornecedores ficam em `productCosts/{productId}`, separado da ficha do produto, porque as regras valem por documento e não por campo.
- O cliente final só lê `tenants/{id}/catalog`, gerado pela Function `syncCatalog` sem código interno, dados fiscais nem quantidade em estoque.
- Todo documento editável pela equipe leva `createdBy`, `createdAt`, `updatedBy` e `updatedAt`, conferidos pelas regras contra o usuário e a hora do servidor.
- Dinheiro é sempre em centavos inteiros.
- Os testes em `firebase/tests` tentam, com cada perfil da empresa B, ler e gravar dados da empresa A. O CI fica vermelho se algum passar.

## Modelo de dados

```
tenants/{tenantId}                 cadastro da empresa (status, plano, dados legais)
  members/{uid}                    equipe e perfil (só Functions)
  categories/{categoryId}          categorias e subcategorias
  products/{productId}             ficha do produto (sem custo)
  productCosts/{productId}         custo de compra, custo médio, fornecedores
  catalog/{productId}              vitrine pública (só Functions)
  auditLog/{entryId}               quem fez o quê (só Functions, lido pelo dono)
publicStores/{slug}                endereço da loja → empresa (leitura pública)
memberships/{uid}                  usuário → empresa, fonte da verdade dos claims
users/{uid}                        perfil pessoal (cliente, lojista, entregador)
```

A ficha do produto segue as abas do painel: Identificação (código interno, vários GTIN/EAN com validação do dígito verificador, SKU, marca, categoria, fotos, unidade, variações e adicionais), Preços (venda e promoção com período), Estoque (atual, mínimo, máximo, localização, peso, conversão de embalagem), Fiscal (NCM, CEST, CFOP, origem, CST ou CSOSN, alíquotas), Logística (peso, dimensões, frágil, temperatura) e Venda online (visível, ordem, maior de 18, receita, máximo por pedido). Os schemas ficam em `packages/shared/src/models`.

## Cloud Functions

| Function          | Tipo                  | O que faz                                                                       |
| ----------------- | --------------------- | ------------------------------------------------------------------------------- |
| `createTenant`    | Callable              | Cria a empresa em teste de 14 dias, o endereço da loja e torna quem chamou dono |
| `addMember`       | Callable              | Adiciona à equipe uma pessoa que já tem conta, com o perfil escolhido           |
| `setMemberRole`   | Callable              | Muda o perfil ou remove da equipe; a empresa nunca fica sem dono                |
| `syncCatalog`     | Gatilho em `products` | Mantém a vitrine pública e as palavras-chave de busca                           |
| `syncPublicStore` | Gatilho em `tenants`  | Leva nome, logo e status da empresa ao endereço público da loja                 |

Depois de `createTenant`, `addMember` ou `setMemberRole`, o app renova o token (`getIdToken(true)`) para receber os novos claims. O documento `members/{uid}` tem `claimsUpdatedAt`, que o app pode escutar para saber quando renovar.

O deploy envia só `functions/dist`, gerado pelo esbuild com `@hiper/shared` embutido.
