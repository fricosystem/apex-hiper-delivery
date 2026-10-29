# App do cliente

App do Hiper Delivery para o cliente final, em Expo (SDK 58) com Expo Router: Android, iOS e web a partir do mesmo código. Usa os tipos e as regras de `@hiper/shared` (preço com variações e adicionais, frete, horário de funcionamento), as mesmas que a Function `createOrder` usa no servidor.

## Telas

| Rota                           | O quê                                                                     |
| ------------------------------ | ------------------------------------------------------------------------- |
| `/`                            | Lojas abertas, busca por nome ou link, pedido em andamento                |
| `/loja/[slug]`                 | Vitrine: horário, taxa, pedido mínimo, categorias, busca, catálogo        |
| `/loja/[slug]/produto/[id]`    | Produto com variações obrigatórias, adicionais, observação e quantidade   |
| `/carrinho`                    | Carrinho de uma loja só, conferido com o catálogo atual                   |
| `/checkout`                    | Entrega ou retirada, endereço com mapa e rota, frete, telefone, pagamento |
| `/pedido/[tenantId]/[orderId]` | Acompanhamento ao vivo com linha do tempo e entregador no mapa            |
| `/pedidos`                     | Histórico em todas as lojas                                               |
| `/conta`, `/perfil`            | Dados, endereços, sair e exclusão da conta                                |
| `/enderecos/novo`              | Endereço pelo CEP (ViaCEP), ponto no mapa (Nominatim) e ajuste do pino    |

## Leituras no Firestore

- Lojas, catálogo e histórico: consultas paginadas (20, 24 e 15 por página), sem escuta.
- Tempo real só no acompanhamento: um documento (o pedido) enquanto ele está ativo e a tela aberta, e a posição do entregador só com o pedido em "Saiu para entrega".
- O carrinho fica no aparelho; preços são reconferidos numa leitura ao abrir o carrinho e recalculados pelo servidor ao criar o pedido.

## Rodando

```bash
cp .env.example .env
pnpm --filter @hiper/customer web        # navegador
pnpm --filter @hiper/customer start      # Expo, para Android e iOS (precisa de development build por causa do MapLibre)
pnpm --filter @hiper/customer web:demo   # sem backend: dados de exemplo e pedido que anda sozinho
pnpm --filter @hiper/customer export:web # build estático da versão web
```

Com `EXPO_PUBLIC_USE_EMULATORS=1` o app fala com os emuladores (`pnpm emulators` na raiz).

## Serviços gratuitos

- Mapa: MapLibre (`@maplibre/maplibre-react-native` no celular, `maplibre-gl` na web) com o estilo do OpenFreeMap. Se os tiles não carregarem, o mapa cai para um fundo liso e continua mostrando rota e marcadores.
- Rotas e distância: OSRM. O servidor público serve para desenvolvimento; em produção use uma instância própria (`EXPO_PUBLIC_OSRM_URL` e `OSRM_URL` nas Functions). Sem resposta, a distância é estimada em linha reta vezes 1,3.
- CEP: ViaCEP. Ponto no mapa: Nominatim (1 consulta por segundo no servidor público).

## Ainda não feito (próximas partes da Etapa 8)

- Pix (depende do gateway da Etapa 5); hoje aparece como "em breve".
- Login nativo com Google e Apple no celular (precisa das credenciais do projeto); na web o Google entra por popup.
- Notificações push de status, chat com a loja e o entregador, notas fiscais na tela do pedido.
- Build e publicação pelo EAS nas lojas.
