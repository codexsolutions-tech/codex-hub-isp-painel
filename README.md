# HUB ISP — Painel do Provedor (com suporte a API)

Mesmo painel de antes, agora com `store.js` preparado para consumir a **API
real** (a mesma do hub/PWA) via **JWT**, mantendo o modo mock como fallback.

## Como ligar sua API

Tudo se resolve em **duas linhas**, no topo de `js/store.js`:

```js
const CONFIG = {
  API_BASE: "https://api.seudominio.com", // troque pela URL real
  USE_API: false, // true = consome a API real; false = localStorage (mock)
};
```

Enquanto `USE_API` for `false`, o painel roda 100% sozinho (sem backend),
igual antes. No dia em que suas rotas existirem, é só trocar para `true` e
ajustar `API_BASE` — **nenhum outro arquivo precisa mudar**. `index.html` e
`css/style.css` são exatamente os mesmos de antes.

## Contrato de rotas

A rota de **login já está confirmada** e implementada exatamente como a API
devolve:

```
POST {API_BASE}/login/painel/token
Body: { "usuario": "admin.fortal", "senha": "123.fortal", "codigoProvedor": 1 }

200 OK
{
  "statusCode": 200,
  "message": "Token retornado com sucesso.",
  "data": {
    "token": "eyJhbGciOi...",
    "provedor": {
      "Id": "8ce1e0bb-296c-4f2e-8fa2-07643a266da0",
      "Codigo": "8CE1E0B",
      "Empresa": "FORTAL PROVEDOR TELECOM LTDA",
      "NomeFantasia": "FORTAL TELECOM",
      "CodigoProvedor": "1",
      "Status": "ATIVO",
      "Gerenciador": "RECEITANET",
      "CodigoApiGerenciador": "128",
      "ChaveApiGerenciador": "...",
      "NomeAdministrador": "Arlene Melo",
      "CpfCnpj": "51.214.012/0001-50",
      "DominioIxc": null,
      "Usuario": "admin.fortal"
    }
  }
}
```

Duas particularidades desse formato, já tratadas em `store.js`:

1. **O login exige `codigoProvedor`**, não só usuário/senha — por isso a tela
   de login ganhou um terceiro campo ("Código do provedor"). É o mesmo número
   mostrado (desabilitado) na aba "Provedor" do painel. Depois do cadastro, o
   toast de sucesso já avisa esse código para o usuário anotar.
2. **O provedor volta em PascalCase** (`Empresa`, `CodigoProvedor`...), dentro
   de um envelope `{ statusCode, message, data }`. A função
   `normalizarProvedor()` em `store.js` converte isso para o formato interno
   em snake_case que o resto do painel usa — então nada em `app.js` precisou
   saber dessa diferença.

As demais rotas ainda não foram confirmadas — os paths abaixo são um
**palpite razoável** seguindo a mesma convenção da rota de login. Ajuste
dentro de cada função do `store.js` quando definir os endpoints reais (a
função `request()` já centraliza `fetch`, headers e tratamento de erro/401
para todas elas):

| Rota | Método | Body | Retorno |
|---|---|---|---|
| `/login/painel/token` | POST | `{ usuario, senha, codigoProvedor }` | `{ token, provedor }` ✅ confirmado |
| `/provedores` | POST | dados do cadastro inicial | `{ token, provedor }` (auto-login) — a confirmar
| `/provedores/me` | GET | — (Bearer token) | `provedor` |
| `/provedores/me` | PATCH | campos alterados | `provedor` atualizado |
| `/temas/me` | GET | — (Bearer token) | `tema` ou `null` |
| `/temas/me` | PUT | dados do tema | `tema` atualizado (upsert) |
| `/banners` | GET | — (Bearer token, escopo = provedor do token) | `[banner]` |
| `/banners` | POST | dados do banner | `banner` criado |
| `/banners/:id` | PATCH | campos alterados | `banner` atualizado |
| `/banners/:id` | DELETE | — | `204` |
| `/parcerias` | GET/POST/PATCH/DELETE | igual a `/banners` | igual a `/banners` |

`provedor` e `tema` devem ter os mesmos campos do schema que você já usa
(`empresa`, `gerenciador`, `codigo_api_gerenciador`, `chave_api_gerenciador`,
`codigo_provedor`, `nome_administrador`, `cnpj`, `status`, `nome_fantasia`,
`dominio_ixc` / `tag`, `accent`, `accent2`, `logo_url`, `glyph`,
`codigo_provedor_fk`).

Se suas rotas reais tiverem outro formato (paths diferentes, wrapper tipo
`{ statusCode, data }`, etc.), é só ajustar dentro de cada função do
`store.js` — a função `request()` no topo do arquivo já centraliza o
`fetch`, os headers e o tratamento de erro/401 para todas elas.

## O que o `request()` já faz por você

```js
async function request(path, options = {}) {
  const token = localStorage.getItem(DB_KEYS.token);
  const res = await fetch(`${CONFIG.API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  if (res.status === 401) {
    localStorage.removeItem(DB_KEYS.token);
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  if (!res.ok) throw new Error(/* mensagem do backend, se houver */);
  return res.json();
}
```

- Anexa o token automaticamente em toda chamada.
- Em `401`, limpa o token e lança um erro — o painel volta pra tela de login
  no próximo carregamento.
- Erros do backend (4xx/5xx) viram `Error` com a mensagem que a API mandar
  (tenta ler `{ message }` do corpo; se não houver, usa o texto puro).

## Testado

- Sintaxe validada (`node --check`) em `store.js` e `app.js`.
- Simulei a chamada real de `/login/painel/token` com `fetch` mockado
  devolvendo **o payload exato do seu print** — confirmei a URL chamada, o
  body enviado (`usuario`, `senha`, `codigoProvedor` como número) e que o
  provedor normalizado bate certinho com o que `preencherTabProvedor()`
  espera (`empresa`, `nome_fantasia`, `codigo_provedor`, `status`, etc.).
- Rodei o fluxo completo em modo mock (login, cadastro, criar banner) depois
  das mudanças, para garantir que nada quebrou.
- Todos os `id` referenciados no JS batem com o HTML atualizado (com o novo
  campo "Código do provedor" no login).

## Estrutura

```
hubisp-painel/
├─ index.html      (inalterado)
├─ css/style.css   (inalterado)
├─ js/store.js     ← ARQUIVO QUE VOCÊ EDITA para plugar a API
└─ js/app.js       ajustado só para "await" nas chamadas ao Store
```
