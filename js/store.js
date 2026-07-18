
// "http://192.168.1.21:3010/v1",
// "http://192.168.18.188:3010/v1",

const CONFIG = {
  API_BASE: "https://codex-hub-isp-api-production.up.railway.app/v1", 
  USE_API: true,

};

const DB_KEYS = {
  provedores: "hubisp_provedores",
  temas: "hubisp_temas",
  banners: "hubisp_banners",
  anuncios: "hubisp_anuncios",
  indicacoes: "hubisp_indicacoes",
  sessao: "hubisp_sessao", // modo mock: guarda o id do provedor logado
  token: "hubisp_token", // modo API: guarda o JWT
  provedorCache: "hubisp_provedor_cache", // modo API: cache do provedor logado
};

const GERENCIADORES = ["RECEITANET", "IXCSOFT"];

/* ------------------------------ utilidades ------------------------------ */
function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function agoraISO() {
  const d = new Date();
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const micro = pad(d.getMilliseconds() * 1000, 6);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${micro}+00`;
}

function ler(chave) {
  try {
    const v = localStorage.getItem(chave);
    return v ? JSON.parse(v) : [];
  } catch {
    return [];
  }
}
function gravar(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

/* --------------------------------------------------------------------------
 * A API real devolve o provedor em PascalCase, dentro de um envelope
 * { statusCode, message, data }. O restante do painel (app.js) trabalha com
 * o formato interno em snake_case (mesmo schema que você já usava). Estas
 * duas funções fazem essa ponte, para não precisar mexer em mais nada.
 * ------------------------------------------------------------------------*/

// extrai o "data" do envelope { statusCode, message, data }, validando o status
function extrairData(json) {
  if (json && typeof json === "object" && "data" in json) {
    if (json.statusCode != null && (json.statusCode < 200 || json.statusCode >= 300)) {
      throw new Error(json.message || "Erro na requisição.");
    }
    return json.data;
  }
  return json;
}

// converte o provedor vindo da API (PascalCase) para o formato interno do painel
function normalizarProvedor(raw) {
  if (!raw) return null;
  // já está no formato interno (ex.: veio do modo mock) -> devolve como está
  if ("codigo_provedor" in raw) return raw;
  return {
    id: raw.Id,
    codigo: raw.Codigo,
    empresa: raw.Empresa,
    nome_fantasia: raw.NomeFantasia ?? null,
    codigo_provedor: raw.CodigoProvedor != null ? Number(raw.CodigoProvedor) : null,
    status: raw.Status || "ATIVO",
    gerenciador: raw.Gerenciador,
    codigo_api_gerenciador: raw.CodigoApiGerenciador != null ? Number(raw.CodigoApiGerenciador) : null,
    chave_api_gerenciador: raw.ChaveApiGerenciador ?? null,
    nome_administrador: raw.NomeAdministrador,
    cnpj: raw.CpfCnpj,
    dominio_ixc: raw.DominioIxc ?? null,
    usuario: raw.Usuario,
  };
}

/* ------------------------------ chamada HTTP (modo API) ------------------------------ */
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

  const texto = await res.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* corpo não era JSON */ }

  if (res.status === 401) {
    localStorage.removeItem(DB_KEYS.token);
    localStorage.removeItem(DB_KEYS.provedorCache);
    throw new Error((json && json.message) || "Sessão expirada. Faça login novamente.");
  }
  if (!res.ok) {
    throw new Error((json && json.message) || texto || `Erro ${res.status}`);
  }
  return json;
}

/* ---- seed do modo mock: um provedor de exemplo para o painel não abrir vazio ---- */
function seed() {
  if (CONFIG.USE_API) return;
  if (localStorage.getItem("hubisp_seeded")) return;
  const provedores = [
    {
      idx: 1,
      id: "",
      created_at: "",
      empresa: "",
      gerenciador: "",
      codigo_api_gerenciador: 0,
      chave_api_gerenciador: "",
      codigo_provedor: 1,
      nome_administrador: "",
      cnpj: "",
      status: "",
      nome_fantasia: "",
      dominio_ixc: null,
      usuario: "",
      senha: "",
    },
  ];
  const temas = [
    {
      idx: 0,
      id: 1,
      created_at: "",
      tag: "Internet Fibra",
      accent: "#DB5F00",
      accent2: "#DB5FFF",
      logo_url: "",
      glyph: null,
      codigo_provedor_fk: 1,
    },
  ];
  const banners = [
    { id: uid(), provedor_id: "f2f68d52-cff0-44b0-bf26-606c9d5f1049", selo: "INDIQUE E GANHE", titulo: "Indique um amigo e ganhe desconto", subtitulo: "R$ 30 off na sua próxima fatura por indicação.", cta: "Indicar agora", cor1: "#6C4CF1", cor2: "#9B7BFF", emoji: "🎁", link: "" },
    { id: uid(), provedor_id: "f2f68d52-cff0-44b0-bf26-606c9d5f1049", selo: "UPGRADE", titulo: "Turbine para 500 Mega", subtitulo: "Mais velocidade pelo mesmo preço no 1º mês.", cta: "Quero turbinar", cor1: "#2563EB", cor2: "#22B8CF", emoji: "⚡", link: "" },
  ];
  const parcerias = [
    { id: uid(), provedor_id: "f2f68d52-cff0-44b0-bf26-606c9d5f1049", nome: "Streaming+", beneficio: "Filmes e séries inclusos", emoji: "🎬", cor: "#F7415A", link: "" },
    { id: uid(), provedor_id: "f2f68d52-cff0-44b0-bf26-606c9d5f1049", nome: "Deezer", beneficio: "3 meses de música grátis", emoji: "🎧", cor: "#6C4CF1", link: "" },
  ];

  const indicacoes = [
    {
      id: uid(),
      provedor_id: "f2f68d52-cff0-44b0-bf26-606c9d5f1049",
      cliente: "João Silva",
      indicado: "Maria Oliveira",
      contato: "(85) 99999-1111",
      mensagem: "Olá Maria, conheça essa internet."
    },
    {
      id: uid(),
      provedor_id: "f2f68d52-cff0-44b0-bf26-606c9d5f1049",
      cliente: "Carlos Souza",
      indicado: "Pedro Lima",
      contato: "(85) 98888-2222",
      mensagem: "Excelente provedor, recomendo."
    }
  ];


  gravar(DB_KEYS.provedores, provedores);
  gravar(DB_KEYS.temas, temas);
  gravar(DB_KEYS.banners, banners);
  gravar(DB_KEYS.parcerias, parcerias);
  localStorage.setItem("hubisp_seeded", "1");


}
seed();

/* ============================== PROVEDORES ==============================
 * Contrato sugerido da API (ajuste às rotas reais quando existirem):
 *   POST   /auth/login          { usuario, senha }        -> { token, provedor }
 *   POST   /provedores          { cadastro inicial }       -> { token, provedor }  (auto-login)
 *   GET    /provedores/me       (Bearer token)             -> provedor
 *   PATCH  /provedores/me       { patch }                  -> provedor atualizado
 * ==========================================================================*/
const Provedores = {
  // --------- modo mock (localStorage) ---------
  _listarMock() { return ler(DB_KEYS.provedores); },
  _buscarPorUsuarioMock(usuario) {
    return this._listarMock().find((p) => p.usuario?.toLowerCase() === usuario.toLowerCase()) || null;
  },
  _proximoCodigoMock() {
    const lista = this._listarMock();
    return lista.length ? Math.max(...lista.map((p) => p.codigo_provedor || 0)) + 1 : 1;
  },

  // --------- API pública (mesma assinatura nos dois modos) ---------

  async cadastrar({ empresa, gerenciador, cnpj, nome_administrador, usuario, senha }) {
    if (CONFIG.USE_API) {
      // ajuste o path abaixo quando a rota de cadastro estiver definida
      const json = await request("/painel/provedor/cadastrar", {
        method: "POST",
        body: JSON.stringify({ empresa, gerenciador, cnpj, nomeAdministrador: nome_administrador, usuario, senha }),
      });
      const data = extrairData(json);
      const provedor = normalizarProvedor(data.provedor ?? data);
      if (data.token) localStorage.setItem(DB_KEYS.token, data.token);
      localStorage.setItem(DB_KEYS.provedorCache, JSON.stringify(provedor));
      return provedor;
    }
    // ---- mock ----
    if (this._buscarPorUsuarioMock(usuario)) {
      throw new Error("Este usuário já está em uso. Escolha outro.");
    }
    const lista = this._listarMock();
    const novo = {
      idx: lista.length,
      id: uid(),
      created_at: agoraISO(),
      empresa,
      gerenciador,
      codigo_api_gerenciador: null,
      chave_api_gerenciador: null,
      codigo_provedor: this._proximoCodigoMock(),
      nome_administrador,
      cnpj,
      status: "ATIVO",
      nome_fantasia: null,
      dominio_ixc: null,
      usuario,
      senha, // demo apenas — nunca faça isso em produção
    };
    lista.push(novo);
    gravar(DB_KEYS.provedores, lista);
    localStorage.setItem(DB_KEYS.sessao, novo.id);
    return novo;
  },

  async atualizar(id, patch) {
    if (CONFIG.USE_API) {
      const json = await request("/painel/provedor/atualizar", { method: "PATCH", body: JSON.stringify(patch) });
      const provedor = normalizarProvedor(extrairData(json));
      localStorage.setItem(DB_KEYS.provedorCache, JSON.stringify(provedor));
      return provedor;
    }
    // ---- mock ----
    const lista = this._listarMock();
    const i = lista.findIndex((p) => p.id === id);
    if (i === -1) throw new Error("Provedor não encontrado.");
    lista[i] = { ...lista[i], ...patch };
    gravar(DB_KEYS.provedores, lista);
    return lista[i];
  },

  // usado pela Sessao para recuperar o provedor logado ao reabrir o painel
  async _obterAtual() {
    if (CONFIG.USE_API) {
      const token = localStorage.getItem(DB_KEYS.token);
      if (!token) return null;
      // Enquanto a rota GET /provedores/me não existir, usamos o cache salvo
      // no login. Quando ela existir, troque este bloco por:
      //   const json = await request("/provedores/me");
      //   const provedor = normalizarProvedor(extrairData(json));
      //   localStorage.setItem(DB_KEYS.provedorCache, JSON.stringify(provedor));
      //   return provedor;
      const cache = localStorage.getItem(DB_KEYS.provedorCache);
      return cache ? JSON.parse(cache) : null;
    }
    const id = localStorage.getItem(DB_KEYS.sessao);
    return id ? this._listarMock().find((p) => p.id === id) || null : null;
  },
};

/* ================================ TEMAS ================================
 *   GET /temas/me   (Bearer token)   -> tema | null
 *   PUT /temas/me   { dados }        -> tema atualizado (upsert)
 * ==========================================================================*/
const Temas = {
  async buscarPorProvedor(codigoProvedor) {
    if (CONFIG.USE_API) {
      const json = await request("/painel/provedor/temas"); // backend já sabe o provedor pelo token
      return extrairData(json);
    }
    const lista = ler(DB_KEYS.temas);
    return lista.find((t) => t.codigo_provedor_fk === codigoProvedor) || null;
  },

  async salvar(codigoProvedor, dados) {
    if (CONFIG.USE_API) {
      const json = await request("/painel/provedor/temas", { method: "PUT", body: JSON.stringify(dados) });
      return extrairData(json);
    }
    const lista = ler(DB_KEYS.temas);
    const i = lista.findIndex((t) => t.codigo_provedor_fk === codigoProvedor);
    if (i === -1) {
      const novo = { idx: lista.length, id: lista.length + 1, created_at: agoraISO(), codigo_provedor_fk: codigoProvedor, ...dados };
      lista.push(novo);
      gravar(DB_KEYS.temas, lista);
      return novo;
    }
    lista[i] = { ...lista[i], ...dados };
    gravar(DB_KEYS.temas, lista);
    return lista[i];
  },
};

/* =============================== BANNERS ===============================
 *   GET    /banners           (Bearer token, escopo pelo provedor logado)
 *   POST   /banners           { dados }
 *   PATCH  /banners/:id       { patch }
 *   DELETE /banners/:id
 * ==========================================================================*/
const Banners = {
  async listar(provedorId) {
    if (CONFIG.USE_API) { const json = await request("/painel/provedor/banners"); return extrairData(json) || []; }
    return ler(DB_KEYS.banners).filter((b) => b.provedor_id === provedorId);
  },

  async criar(provedorId, dados) {
    if (CONFIG.USE_API) { const json = await request("/painel/provedor/banners", { method: "POST", body: JSON.stringify(dados) }); return extrairData(json); }
    const lista = ler(DB_KEYS.banners);
    const novo = { id: uid(), provedor_id: provedorId, ...dados };
    lista.push(novo);
    gravar(DB_KEYS.banners, lista);
    return novo;
  },

  async atualizar(id, patch) {
    if (CONFIG.USE_API) { const json = await request(`/painel/provedor/banners/${id}`, { method: "PATCH", body: JSON.stringify(patch) }); return extrairData(json); }
    const lista = ler(DB_KEYS.banners);
    const i = lista.findIndex((b) => b.id === id);
    if (i === -1) throw new Error("Banner não encontrado.");
    lista[i] = { ...lista[i], ...patch };
    gravar(DB_KEYS.banners, lista);
    return lista[i];
  },

  async remover(id) {
    if (CONFIG.USE_API) { await request(`/painel/provedor/banners/${id}`, { method: "DELETE" }); return; }
    gravar(DB_KEYS.banners, ler(DB_KEYS.banners).filter((b) => b.id !== id));
  },
};

/* ============================== PARCERIAS ==============================
 *   GET    /parcerias
 *   POST   /parcerias         { dados }
 *   PATCH  /parcerias/:id     { patch }
 *   DELETE /parcerias/:id
 * ==========================================================================*/
const Anuncios = {
  async listar(provedorId) {
    if (CONFIG.USE_API) { const json = await request("/painel/provedor/anuncios"); return extrairData(json) || []; }
    return ler(DB_KEYS.anuncios).filter((p) => p.provedor_id === provedorId);
  },

  async criar(provedorId, dados) {
    if (CONFIG.USE_API) { const json = await request("/painel/provedor/anuncios", { method: "POST", body: JSON.stringify(dados) }); return extrairData(json); }
    const lista = ler(DB_KEYS.anuncios);
    const novo = { id: uid(), provedor_id: provedorId, ...dados };
    lista.push(novo);
    gravar(DB_KEYS.anuncios, lista);
    return novo;
  },

  async atualizar(id, patch) {
    if (CONFIG.USE_API) { const json = await request(`/painel/provedor/anuncios/${id}`, { method: "PATCH", body: JSON.stringify(patch) }); return extrairData(json); }
    const lista = ler(DB_KEYS.parcerias);
    const i = lista.findIndex((p) => p.id === id);
    if (i === -1) throw new Error("Anuncio não encontrado.");
    lista[i] = { ...lista[i], ...patch };
    gravar(DB_KEYS.parcerias, lista);
    return lista[i];
  },

  async remover(id) {
    if (CONFIG.USE_API) { await request(`/painel/provedor/anuncios/${id}`, { method: "DELETE" }); return; }
    gravar(DB_KEYS.parcerias, ler(DB_KEYS.parcerias).filter((p) => p.id !== id));
  },
};

const Indicacoes = {

  async listar(provedorId) {

    if (CONFIG.USE_API) {
      const json = await request(`/painel/provedor/indicacoes`);
      console.log(json)
      return extrairData(json) || [];
    }

    return ler(DB_KEYS.indicacoes)
      .filter(i => i.provedor_id === provedorId);

  }

};

const Avaliacoes = {

  async listar(provedorId) {

    if (CONFIG.USE_API) {
      const json = await request(`/painel/provedor/avaliacoes`);
      console.log(json)
      return extrairData(json) || [];
    }

    return ler(DB_KEYS.Avaliacoes)
      .filter(i => i.provedor_id === provedorId);

  }

};

/* ================================ SESSÃO ================================
 *   POST /auth/login   { usuario, senha }   -> { token, provedor }
 * ==========================================================================*/
const Sessao = {
  async login(usuario, senha, codigoProvedor) {
    if (CONFIG.USE_API) {
      const json = await request("/painel/login", {
        method: "POST",
        body: JSON.stringify({ usuario, senha, codigoProvedor: Number(codigoProvedor) }),
      });
      const data = extrairData(json); // { token, provedor }
      const provedor = normalizarProvedor(data.provedor);
      localStorage.setItem(DB_KEYS.token, data.token);
      localStorage.setItem(DB_KEYS.provedorCache, JSON.stringify(provedor));
      return provedor;
    }
    // ---- mock ----
    const p = Provedores._buscarPorUsuarioMock(usuario);
    if (!p || p.senha !== senha) throw new Error("Usuário ou senha inválidos.");
    localStorage.setItem(DB_KEYS.sessao, p.id);
    return p;
  },

  // tenta recuperar a sessão ao abrir o painel (token salvo ou sessão mock)
  async atual() {
    try {
      return await Provedores._obterAtual();
    } catch {
      return null; // token inválido/expirado, ou nenhuma sessão
    }
  },

  sair() {
    localStorage.removeItem(DB_KEYS.sessao);
    localStorage.removeItem(DB_KEYS.token);
    localStorage.removeItem(DB_KEYS.provedorCache);
  },
};

window.Store = { Provedores, Temas, Banners, Anuncios, Indicacoes, Avaliacoes, Sessao, GERENCIADORES, CONFIG };
