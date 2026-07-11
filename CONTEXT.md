# Scheduler — Contexto do Repositório

Agendador inteligente via WhatsApp: conversas automáticas com IA (Sarah),
agendamento, integração com Google Calendar, lembretes, cobrança via Pix.

## Origem

Este repositório nasceu em 2026-07-11 de uma separação do antigo monorepo
`psicoapp` (que continha este produto + o "PsicoApp", gestão clínica de
outro time). São produtos com bancos de dados e infra de deploy fisicamente
separados desde sempre — só o código-fonte estava compartilhado. A
separação eliminou confusão recorrente de agentes de IA entre os dois
produtos. O monorepo antigo continua arquivado no GitHub como referência
histórica (`git log`/`git blame` de antes de 2026-07-11 estão lá, não aqui).

## Estrutura

```
/                    <- frontend (Expo/React Native Web), raiz do repo
backend/             <- API (Express + TypeScript), fila BullMQ/Redis
packages/whatsapp-core/  <- cliente Baileys compartilhado (cópia própria
                            deste repo — o PsicoApp tem a sua; não são
                            sincronizados automaticamente, ver nota abaixo)
desktop/ (dentro da raiz) <- wrapper Electron do frontend
```

## Rodando localmente

```
cd packages/whatsapp-core && npm install && npm run build
cd ../../backend && npm install && npm run dev
cd ..                 && npm install && npm start
```

`backend/package.json` depende de `whatsapp-core` via
`file:../packages/whatsapp-core` — não é um pacote npm workspace nem
publicado, é uma dependência de arquivo local. Se `packages/whatsapp-core`
mudar, rodar `npm run build` lá antes de reinstalar no backend.

## Deploy

- Frontend web: Vercel, via `vercel.json` na raiz (`buildCommand: npm run
  build:web`) — **não é Vite, é Expo Web/Metro**, não presumir
  autodetecção.
- Backend: Railway, via `Dockerfile` na raiz deste repo (`railway.toml`
  aponta pra ele). O Dockerfile builda `packages/whatsapp-core` antes do
  backend — ver comentários no próprio arquivo.

## Acoplamento que sobrevive à separação (regra de negócio, não de código)

- **Regra de ouro do socket Baileys (Erro 440)**: este backend é o
  **dono** da sessão/conexão WhatsApp (mesmo número de negócio usado pelo
  PsicoApp). Não pode haver 2 conexões simultâneas na mesma sessão — o
  PsicoApp roda com `DISABLE_WHATSAPP_BOOT=true` justamente por isso.
- **Filtro de lembrete duplicado**: este backend pula calendários do Google
  chamados `sessões_terapia`/`sessoes_terapia` pra não duplicar lembrete que
  o PsicoApp já manda por conta própria — é só uma convenção de nome, não
  comunicação em tempo real entre os repos.
- **`packages/whatsapp-core` é duplicado**, não compartilhado em tempo real
  com o repo do PsicoApp. Se corrigir um bug do Baileys aqui, replicar
  manualmente no outro repo se aplicável.
