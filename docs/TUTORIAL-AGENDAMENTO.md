# Tutorial — Agendamento de postagens (via Zernio)

Depois que **todas as peças de uma linha são aprovadas pelo cliente**, a linha
vai automaticamente para a coluna **"A Postar"** na Produção. A partir daí o SOIE
monta o agendamento e publica nas redes de cada cliente usando o **Zernio** (uma
API que fala com Instagram, Facebook, TikTok, LinkedIn, YouTube e outras).

O modelo é simples:

- **1 chave da agência** (`ZERNIO_API_KEY`) para toda a plataforma.
- **1 "profile" por cliente** no Zernio (o SOIE cria sozinho na 1ª conexão).
- Em cada profile, você **conecta as redes daquele cliente, uma por uma**.

---

## 1. Criar a conta e pegar a chave (uma vez)

1. Crie uma conta em **https://zernio.com** (tem free tier).
2. No painel do Zernio, vá em **API / Developers** e copie a **API key** (Bearer token).
3. No **Vercel** → projeto **soie-web** → **Settings → Environment Variables**,
   adicione:
   - **Name:** `ZERNIO_API_KEY`
   - **Value:** a chave copiada
   - **Environments:** Production (e Preview, se testar no preview)
4. **Redeploy** o soie-web para a chave entrar em vigor.

> Sem essa chave, o SOIE ainda deixa você montar e salvar o plano de
> agendamento (data + legenda por peça); só não publica de verdade.

---

## 2. Conectar as redes de cada cliente (um por um)

Isso é feito **por cliente**, dentro da tela de agendamento:

1. Na **Produção**, abra uma linha que está em **"A Postar"** e clique em
   **"📅 Agendar postagens"**.
2. No topo, em **"Redes do cliente"**, clique em **"Conectar instagram"**
   (ou a rede desejada). Abre uma aba do Zernio pedindo o login **da conta
   daquele cliente** naquela rede — faça login e autorize.
3. Repita para cada rede que o cliente usa (Instagram, Facebook, TikTok…).
4. Volte ao SOIE e clique em **"Atualizar contas"** — as contas conectadas
   aparecem com um ✓.

> Cada cliente é um profile isolado no Zernio, então repita esse passo **uma
> vez por cliente**. Depois de conectado, fica salvo — não precisa reconectar a
> cada linha editorial.

---

## 3. Agendar as postagens

Ainda na tela **"📅 Agendar postagens"**, para cada peça você define:

- **Data/hora** — o dia e horário da publicação.
- **Canal** — a rede em que essa peça vai (deve ter uma conta conectada).
- **Legenda** — clique em **"✨ Gerar com IA"** (a IA escreve com base na copy e
  no tema aprovados) ou escreva manualmente.

Depois:

- **"Salvar plano"** — guarda o agendamento no SOIE (sem publicar).
- **"Agendar no Zernio →"** — envia cada peça (com data e canal conectado) para
  o Zernio, que publica no horário marcado. As peças agendadas ficam marcadas
  como **"agendada"**; se algo falhar, aparece **"falhou"** com o motivo.

---

## Observações

- A **mídia** (arte/vídeo) fica no banco (Neon) e é servida por uma URL pública
  que o Zernio busca na hora de publicar — não precisa subir nada em outro lugar.
- Peças **sem data** ou **sem conta conectada** para o canal são puladas (e
  sinalizadas) — o resto é agendado normalmente.
- Reagendar: ajuste a data/legenda e clique de novo. Peças que já foram
  agendadas (têm id no Zernio) não são reenviadas em duplicidade.
