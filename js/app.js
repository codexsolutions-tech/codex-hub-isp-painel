/* ============================================================================
 * app.js — telas, navegação e ligação dos formulários com o store.js
 * ==========================================================================*/
(function () {
  const { Provedores, Temas, Banners, Anuncios, Indicacoes, Avaliacoes, Sessao } = window.Store;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  let provedorAtual = null;
  let editandoBannerId = null;
  let editandoAnuncioId = null;

  /* ------------------------------ toast ------------------------------ */
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    Swal.fire(msg);
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  }

  /* ------------------------------ máscara CNPJ ------------------------------ */
  function maskCnpj(v) {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
  $("#cad-cnpj").addEventListener("input", (e) => { e.target.value = maskCnpj(e.target.value); });

  /* ============================================================
   *  TELA DE AUTENTICAÇÃO
   * ============================================================*/
  function mostrarLogin() {
    $("#form-login").classList.remove("hidden");
    $("#form-cadastro").classList.add("hidden");
    $("#login-erro").classList.remove("show");
  }
  function mostrarCadastro() {
    $("#form-cadastro").classList.remove("hidden");
    $("#form-login").classList.add("hidden");
    $("#cadastro-erro").classList.remove("show");
  }
  $("#ir-cadastro").addEventListener("click", mostrarCadastro);
  $("#ir-login").addEventListener("click", mostrarLogin);

  $("#usar-demo").addEventListener("click", () => {
    $("#login-codigo-provedor").value = "1";
    $("#login-usuario").value = "admin.fortal";
    $("#login-senha").value = "demo123";
  });

  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const codigoProvedor = $("#login-codigo-provedor").value.trim();
    const usuario = $("#login-usuario").value.trim();
    const senha = $("#login-senha").value;
    const el = $("#login-erro");
    el.classList.remove("show");
    if (!codigoProvedor || !usuario || !senha) {
      el.textContent = "Preencha código do provedor, usuário e senha.";
      el.classList.add("show");
      return;
    }
    const btn = e.submitter;
    if (btn) { btn.disabled = true; btn.textContent = "Entrando…"; }
    try {
      const p = await Sessao.login(usuario, senha, codigoProvedor);
      await abrirPainel(p);
    } catch (err) {
      const el = $("#login-erro");
      el.textContent = err.message;
      el.classList.add("show");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Entrar"; }
    }
  });

  $("#form-cadastro").addEventListener("submit", async (e) => {
    e.preventDefault();
    const dados = {
      empresa: $("#cad-empresa").value.trim(),
      gerenciador: $("#cad-gerenciador").value,
      cnpj: $("#cad-cnpj").value.trim(),
      nome_administrador: $("#cad-admin").value.trim(),
      usuario: $("#cad-usuario").value.trim(),
      senha: $("#cad-senha").value,
    };
    const el = $("#cadastro-erro");
    el.classList.remove("show");

    if (Object.values(dados).some((v) => !v)) {
      el.textContent = "Preencha todos os campos obrigatórios.";
      el.classList.add("show");
      return;
    }
    if (dados.senha.length < 6) {
      el.textContent = "A senha deve ter ao menos 6 caracteres.";
      el.classList.add("show");
      return;
    }

    const btn = e.submitter;
    if (btn) { btn.disabled = true; btn.textContent = "Criando…"; }
    try {
      const novo = await Provedores.cadastrar(dados);
      toast(`Provedor cadastrado! Seu código de acesso é ${novo.codigo_provedor}`);
      await abrirPainel(novo);
    } catch (err) {
      el.textContent = err.message;
      el.classList.add("show");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Criar cadastro e acessar o painel"; }
    }
  });

  /* ============================================================
   *  ABRIR / SAIR DO PAINEL
   * ============================================================*/
  async function abrirPainel(provedor) {
    provedorAtual = provedor;
    $("#tela-auth").classList.add("hidden");
    $("#tela-painel").classList.remove("hidden");
    $("#side-provedor-nome").textContent = provedor.nome_fantasia || provedor.empresa;
    preencherTabProvedor();
    await Promise.all([preencherTabTema(), renderBanners(), renderAnuncios(), renderIndicacoes(), renderAvaliacoes()]);
    trocarTab("provedor");
    iniciarAutoRefresh();
  }

  $("#btn-sair").addEventListener("click", () => {
    pararAutoRefresh();
    Sessao.sair();
    provedorAtual = null;
    $("#tela-painel").classList.add("hidden");
    $("#tela-auth").classList.remove("hidden");
    $("#form-login").reset();
    mostrarLogin();
  });

  /* ============================================================
   *  AUTO REFRESH
   * ============================================================*/
  const RENDERERS = {
    banners: renderBanners,
    anuncios: renderAnuncios,
    indicacoes: renderIndicacoes,
    avaliacoes: renderAvaliacoes,
  };
  const ABAS_AUTO_REFRESH = ["banners", "anuncios", "indicacoes", "avaliacoes"];
  const INTERVALO_AUTO_REFRESH_MS = 30000;

  let abaAtiva = "provedor";
  let autoRefreshTimer = null;

  async function atualizarAba(nome, opts) {
    opts = opts || {};
    const manual = !!opts.manual;
    const render = RENDERERS[nome];
    if (!render) return;
    const btn = $("#btn-atualizar");
    if (manual && btn) { btn.disabled = true; btn.classList.add("girando"); }
    try {
      await render();
      if (manual) toast("Atualizado");
    } catch (err) {
      if (manual) toast(err.message || "Erro ao atualizar");
    } finally {
      if (manual && btn) { btn.disabled = false; btn.classList.remove("girando"); }
    }
  }

  function iniciarAutoRefresh() {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => {
      if (document.hidden) return;
      if (!ABAS_AUTO_REFRESH.includes(abaAtiva)) return;
      atualizarAba(abaAtiva);
    }, INTERVALO_AUTO_REFRESH_MS);
  }
  function pararAutoRefresh() {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  const btnAtualizarEl = $("#btn-atualizar");
  if (btnAtualizarEl) btnAtualizarEl.addEventListener("click", () => atualizarAba(abaAtiva, { manual: true }));

  /* ============================================================
   *  NAVEGAÇÃO ENTRE ABAS
   * ============================================================*/
  const TITULOS_TAB = {
    provedor: ["Dados do provedor", "Informações cadastrais e credenciais do gerenciador"],
    tema: ["Tema do app", "Cores e logomarca exibidas para os assinantes"],
    banners: ["Banners", "Carrossel de ofertas na tela inicial do app"],
    anuncios: ["Anúncios", "Carrossel de anúncios do aplicativo"],
    indicacoes: ["Indicações", "Clientes que indicaram novos assinantes pelo aplicativo."],
    avaliacoes: ["Avaliações", "Clientes que avaliaram o serviço."],
  };

  function trocarTab(nome) {
    $$(".side-item").forEach((b) => b.classList.toggle("active", b.dataset.tab === nome));
    $$(".tab-panel").forEach((p) => p.classList.add("hidden"));
    $(`#tab-${nome}`).classList.remove("hidden");
    const [titulo, sub] = TITULOS_TAB[nome];
    $("#topbar-titulo").textContent = titulo;
    $("#topbar-sub").textContent = sub;
    abaAtiva = nome;
    if (ABAS_AUTO_REFRESH.includes(nome)) atualizarAba(nome);
    const btnAtualizar = $("#btn-atualizar");
    if (btnAtualizar) btnAtualizar.classList.toggle("hidden", !ABAS_AUTO_REFRESH.includes(nome));
  }
  $$(".side-item").forEach((b) => b.addEventListener("click", () => trocarTab(b.dataset.tab)));

  /* ============================================================
   *  TAB: PROVEDOR
   * ============================================================*/
  function preencherTabProvedor() {
    const p = provedorAtual;
    $("#p-empresa").value = p.empresa || "";
    $("#p-nome-fantasia").value = p.nome_fantasia || "";
    $("#p-cnpj").value = p.cnpj || "";
    $("#p-admin").value = p.nome_administrador || "";
    $("#p-status").value = p.status || "ATIVO";
    $("#p-codigo-provedor").value = p.codigo_provedor ?? "";
    $("#p-usuario").value = p.usuario ?? "";
    $("#p-senha").value = p.senha ?? "";
    $("#p-gerenciador").value = p.gerenciador || "RECEITANET";
    $("#p-codigo-api").value = p.codigo_api_gerenciador ?? "";
    $("#p-dominio-ixc").value = p.dominio_ixc || "";
    $("#p-chave-api").value = p.chave_api_gerenciador || "";
    atualizarStatusTopbar(p.status);
  }

  function atualizarStatusTopbar(status) {
    const el = $("#topbar-status");
    el.textContent = status || "ATIVO";
    el.className = "topbar-status" + (status && status !== "ATIVO" ? ` status-${status.toLowerCase()}` : "");
  }

  $("#toggle-chave").addEventListener("click", () => {
    const inp = $("#p-chave-api");
    inp.type = inp.type === "password" ? "text" : "password";
  });

  $("#salvar-provedor").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const patch = {
      empresa: $("#p-empresa").value.trim(),
      nome_fantasia: $("#p-nome-fantasia").value.trim() || null,
      cnpj: $("#p-cnpj").value.trim(),
      nome_administrador: $("#p-admin").value.trim(),
      usuario: $("#p-usuario").value,
      senha: $("#p-senha").value,
      status: $("#p-status").value,
      gerenciador: $("#p-gerenciador").value,
      codigo_api_gerenciador: $("#p-codigo-api").value ? Number($("#p-codigo-api").value) : null,
      dominio_ixc: $("#p-dominio-ixc").value.trim() || null,
      chave_api_gerenciador: $("#p-chave-api").value.trim() || null,
    };
    btn.disabled = true;
    try {
      provedorAtual = await Provedores.atualizar(provedorAtual.id, patch);
      $("#side-provedor-nome").textContent = provedorAtual.nome_fantasia || provedorAtual.empresa;
      atualizarStatusTopbar(provedorAtual.status);
      avisarSalvo("#salvo-provedor");
      toast("Dados do provedor salvos");
    } catch (err) {
      toast(err.message || "Erro ao salvar");
    } finally {
      btn.disabled = false;
    }
  });

  function avisarSalvo(sel) {
    const el = $(sel);
    el.textContent = "Salvo agora";
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2500);
  }

  /* ============================================================
   *  TAB: TEMA
   * ============================================================*/
  async function preencherTabTema() {
    let tema = {};
    try {
      tema = (await Temas.buscarPorProvedor(provedorAtual.codigo_provedor)) || {};
    } catch (err) {
      toast(err.message || "Erro ao carregar tema");
    }
    $("#t-tag").value = tema.tag || "";
    $("#t-accent").value = tema.accent || "#2563EB";
    $("#t-accent2").value = tema.accent2 || "#7C3AED";
    $("#t-accent-picker").value = normalizarHex(tema.accent) || "#2563EB";
    $("#t-accent2-picker").value = normalizarHex(tema.accent2) || "#7C3AED";
    $("#t-logo").value = tema.logo_url || "";
    $("#t-glyph").value = tema.glyph || "";
    atualizarPreviewTema();
  }

  function normalizarHex(v) {
    if (!v) return null;
    return /^#[0-9A-Fa-f]{6}$/.test(v) ? v : null;
  }

  function ligarParCor(textoSel, pickerSel, onChange) {
    const txt = $(textoSel), pick = $(pickerSel);
    if (!txt || !pick) return; // ← evita crash se o elemento não existir
    txt.addEventListener("input", () => {
      const hex = normalizarHex(txt.value);
      if (hex) pick.value = hex;
      onChange();
    });
    pick.addEventListener("input", () => { txt.value = pick.value; onChange(); });
  }

  ligarParCor("#t-accent", "#t-accent-picker", atualizarPreviewTema);
  ligarParCor("#t-accent2", "#t-accent2-picker", atualizarPreviewTema);
  $("#t-tag").addEventListener("input", atualizarPreviewTema);
  $("#t-logo").addEventListener("input", atualizarPreviewTema);
  $("#t-glyph").addEventListener("input", atualizarPreviewTema);

  function atualizarPreviewTema() {
    const accent = $("#t-accent").value || "#2563EB";
    const accent2 = $("#t-accent2").value || "#7C3AED";
    const tag = $("#t-tag").value || "Internet Fibra";
    const logo = $("#t-logo").value.trim();
    const glyph = $("#t-glyph").value.trim() || "◈";

    $("#prev-nome").textContent = provedorAtual.nome_fantasia || provedorAtual.empresa || "Sua Empresa";
    $("#prev-tag").textContent = tag;
    $("#prev-plano").style.background = `linear-gradient(135deg, ${accent}, ${accent2})`;

    const logoEl = $("#prev-logo");
    logoEl.style.background = accent;
    
    const logoUrl = resolveImageUrl(logo);

    console.log(logoUrl)

    if (logoUrl && logoUrl.includes("drive.google.com")) {
      logoEl.innerHTML = `
        <img
          src="${escapeAttr(logoUrl)}"
          alt="logo"
          onerror="this.parentElement.textContent='${escapeJs(glyph)}'"
        />
      `;
    } else {
      logoEl.textContent = glyph;
    }
  }

  $("#salvar-tema").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const dados = {
      tag: $("#t-tag").value.trim(),
      accent: $("#t-accent").value.trim() || "#2563EB",
      accent2: $("#t-accent2").value.trim() || "#7C3AED",
      logo_url: $("#t-logo").value.trim() || null,
      glyph: $("#t-glyph").value.trim() || null,
    };
    btn.disabled = true;
    try {
      await Temas.salvar(provedorAtual.codigo_provedor, dados);
      avisarSalvo("#salvo-tema");
      toast("Tema salvo");
    } catch (err) {
      toast(err.message || "Erro ao salvar tema");
    } finally {
      btn.disabled = false;
    }
  });

  /* ============================================================
   *  TAB: BANNERS
   * ============================================================*/
  async function renderBanners() {
    const wrap = $("#lista-banners");
    let lista = [];
    try {
      lista = await Banners.listar(provedorAtual.id);
    } catch (err) {
      wrap.innerHTML = `<div class="vazio">Não foi possível carregar os banners.<br>${esc(err.message || "")}</div>`;
      return;
    }
    if (!lista.length) {
      wrap.innerHTML = `<div class="vazio"><div class="vazio-emoji">🖼️</div>Nenhum banner cadastrado ainda.<br>Clique em "+ Novo banner" para criar o primeiro.</div>`;
      return;
    }
    wrap.innerHTML = lista.map((b) => `
      <div class="item-card">
        <div class="item-visual" style="background:linear-gradient(135deg, ${esc(b.cor1 || "#2563EB")}, ${esc(b.cor2 || "#7C3AED")})">
          <div class="selo">${esc(b.selo || "")}</div>
          <div class="titulo">${esc(b.titulo || "Sem título")}</div>
          <span class="emoji">${esc(b.emoji || "✨")}</span>
        </div>
        <div class="item-corpo">
          <div class="item-sub">${esc(b.subtitulo || "")}</div>
          ${b.link ? `<div class="item-link">🔗 ${esc(b.link)}</div>` : `<div class="item-link" style="color:var(--sub)">Sem link (apenas informativo)</div>`}
        </div>
        <div class="item-acoes">
          <button class="item-btn" data-editar-banner="${b.id}">Editar</button>
          <button class="item-btn danger" data-excluir-banner="${b.id}">Excluir</button>
        </div>
      </div>
    `).join("");

    wrap.querySelectorAll("[data-editar-banner]").forEach((btn) =>
      btn.addEventListener("click", () => abrirModalBanner(btn.dataset.editarBanner, lista))
    );
    wrap.querySelectorAll("[data-excluir-banner]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Excluir este banner? Esta ação não pode ser desfeita.")) return;
        try {
          await Banners.remover(btn.dataset.excluirBanner);
          await renderBanners();
          toast("Banner excluído");
        } catch (err) {
          toast(err.message || "Erro ao excluir banner");
        }
      })
    );
  }

  $("#novo-banner").addEventListener("click", () => abrirModalBanner(null, []));
  $("#mb-cancelar").addEventListener("click", () => fecharModal("#modal-banner"));

  function abrirModalBanner(id, listaAtual) {
    editandoBannerId = id;
    const b = id ? listaAtual.find((x) => x.id === id) : null;
    $("#modal-banner-titulo").textContent = id ? "Editar banner" : "Novo banner";
    $("#mb-selo").value = b?.selo || "";
    $("#mb-titulo").value = b?.titulo || "";
    $("#mb-subtitulo").value = b?.subtitulo || "";
    $("#mb-cta").value = b?.cta || "";
    $("#mb-emoji").value = b?.emoji || "✨";
    $("#mb-cor1").value = b?.cor1 || "#6C4CF1";
    $("#mb-cor2").value = b?.cor2 || "#9B7BFF";
    $("#mb-cor1-picker").value = normalizarHex(b?.cor1) || "#6C4CF1";
    $("#mb-cor2-picker").value = normalizarHex(b?.cor2) || "#9B7BFF";
    $("#mb-link").value = b?.link || "";
    atualizarPreviewBanner();
    abrirModal("#modal-banner");
  }

  ligarParCor("#mb-cor1", "#mb-cor1-picker", atualizarPreviewBanner);
  ligarParCor("#mb-cor2", "#mb-cor2-picker", atualizarPreviewBanner);
  ["#mb-selo", "#mb-titulo", "#mb-subtitulo", "#mb-emoji", "#mb-cta"].forEach((sel) =>
    $(sel).addEventListener("input", atualizarPreviewBanner)
  );

  function atualizarPreviewBanner() {
    const cor1 = $("#mb-cor1").value || "#6C4CF1";
    const cor2 = $("#mb-cor2").value || "#9B7BFF";
    $("#mb-preview").style.background = `linear-gradient(135deg, ${cor1}, ${cor2})`;
    $("#mb-preview").innerHTML = `
      <div style="font-size:10px;font-weight:800;opacity:.9;letter-spacing:.5px">${esc($("#mb-selo").value)}</div>
      <div style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:15px;margin-top:3px">${esc($("#mb-titulo").value || "Título do banner")}</div>
      <div style="font-size:11.5px;opacity:.92;margin-top:2px">${esc($("#mb-subtitulo").value)}</div>
      <span style="position:absolute;right:-4px;bottom:-10px;font-size:52px;opacity:.18">${esc($("#mb-emoji").value || "✨")}</span>
    `;
  }

  $("#mb-salvar").addEventListener("click", async (e) => {
    const titulo = $("#mb-titulo").value.trim();
    if (!titulo){ 
      toast("Informe ao menos o título do banner"); return; 
    }
    const dados = {
      selo: $("#mb-selo").value.trim(),
      titulo,
      subtitulo: $("#mb-subtitulo").value.trim(),
      cta: $("#mb-cta").value.trim(),
      emoji: $("#mb-emoji").value.trim() || "✨",
      cor1: $("#mb-cor1").value.trim() || "#6C4CF1",
      cor2: $("#mb-cor2").value.trim() || "#9B7BFF",
      link: $("#mb-link").value.trim(),
    };
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      if (editandoBannerId) await Banners.atualizar(editandoBannerId, dados);
      else await Banners.criar(provedorAtual.id, dados);
      fecharModal("#modal-banner");
      await renderBanners();
      toast("Banner salvo");
    } catch (err) {
      toast(err.message || "Erro ao salvar banner");
    } finally {
      btn.disabled = false;
    }
  });

  /* ============================================================
   *  TAB: ANÚNCIOS
   * ============================================================*/
  async function renderAnuncios() {
    const wrap = $("#lista-anuncios");
    let lista = [];
    try {
      lista = await Anuncios.listar(provedorAtual.id);
    } catch (err) {
      wrap.innerHTML = `<div class="vazio">Não foi possível carregar os anúncios.<br>${esc(err.message || "")}</div>`;
      return;
    }
    if (!lista.length) {
      wrap.innerHTML = `<div class="vazio"><div class="vazio-emoji">📢</div>Nenhum anúncio cadastrado ainda.<br>Clique em "+ Novo anúncio" para criar o primeiro.</div>`;
      return;
    }
    console.log(lista[0])
    wrap.innerHTML = lista.map((p) => `
      <div class="item-card">
        <div class="item-tipo ${p.tipo === 'texto' ? 'tipo-texto' : 'tipo-imagem'}">
          ${p.tipo === 'texto' ? '📝' : '🖼️'}
        </div>
        <div class="item-corpo">
          <div class="item-image">
            <img src='${resolveImageUrl(p.link_imagem)}'  style="width:100%; height:100%; object-fit:cover; display:block;"/>
          </div>
          <div class="item-nome">${esc(p.titulo || "Sem título")}</div>
          <div class="item-sub">${esc(p.subtitulo || p.descricao || "")}</div>
          <div class="item-badges">
            <span class="badge badge-tipo">${p.tipo === 'texto' ? 'Card de texto' : 'Banner com imagem'}</span>
            <span class="badge ${p.ativo === true || p.ativo === 'true' ? 'badge-ativo' : 'badge-inativo'}">
              ${p.ativo === true || p.ativo === 'true' ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          ${p.link_acao
            ? `<div class="item-link">🔗 ${esc(p.link_acao)}</div>`
            : `<div class="item-link" style="color:var(--sub)">Sem link (apenas informativo)</div>`}
        </div>
        <div class="item-acoes">
          <button class="item-btn" data-editar-anuncio="${p.id}">Editar</button>
          <button class="item-btn danger" data-excluir-anuncio="${p.id}">Excluir</button>
        </div>
      </div>
    `).join("");

    wrap.querySelectorAll("[data-editar-anuncio]").forEach((btn) =>
      btn.addEventListener("click", () => abrirModalAnuncio(btn.dataset.editarAnuncio, lista))
    );
    wrap.querySelectorAll("[data-excluir-anuncio]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Excluir este anúncio? Esta ação não pode ser desfeita.")) return;
        try {
          await Anuncios.remover(btn.dataset.excluirAnuncio);
          await renderAnuncios();
          toast("Anúncio excluído");
        } catch (err) {
          toast(err.message || "Erro ao excluir anúncio");
        }
      })
    );
  }

  $("#novo-anuncio").addEventListener("click", () => abrirModalAnuncio(null, []));
  $("#ma-cancelar").addEventListener("click", () => fecharModal("#modal-anuncio"));

  function abrirModalAnuncio(id, listaAtual) {
    editandoAnuncioId = id;
    const p = id ? listaAtual.find((x) => x.id === id) : null;
    console.log(listaAtual)
    $("#modal-anuncio-titulo").textContent = id ? "Editar anúncio" : "Novo anúncio";
    $("#ma-tipo").value    = p?.tipo      || "imagem";
    $("#ma-titulo").value  = p?.titulo    || "";
    $("#ma-subtitulo").value = p?.subtitulo || "";
    $("#ma-descricao").value = p?.descricao || "";
    $("#ma-imagem").value  = p?.link_imagem    || "";
    $("#ma-link").value    = p?.link_acao      || "";
    $("#ma-ativo").value   = p?.ativo !== undefined ? String(p.ativo) : "true";
    atualizarPreviewAnuncio();
    abrirModal("#modal-anuncio");
  }

  // ← SEM ligarParCor aqui: #ma-cor e #ma-cor-picker não existem no HTML
  ["#ma-tipo", "#ma-titulo", "#ma-subtitulo", "#ma-descricao", "#ma-imagem", "#ma-link", "#ma-ativo"].forEach((sel) => {
    const el = $(sel);
    if (el) el.addEventListener("input", atualizarPreviewAnuncio);
  });

  function atualizarPreviewAnuncio() {
    const tipo      = $("#ma-tipo")?.value || "imagem";
    const titulo    = $("#ma-titulo")?.value    || "Título do anúncio";
    const subtitulo = $("#ma-subtitulo")?.value || "";
    const descricao = $("#ma-descricao")?.value || "";
    const imagem    = $("#ma-imagem")?.value.trim() || "";
    const link    = $("#ma-link")?.value.trim() || "";
    const ativo     = $("#ma-ativo")?.value  || 'true';

    const prev = $("#ma-preview");
    if (!prev) return;

    if (imagem) {
      prev.style.background = "transparent";
      prev.style.padding    = "0";
      prev.style.overflow   = "hidden";
      prev.innerHTML = `
        <img src="${escapeAttr(imagem)}"
             alt="preview"
             style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:block"
             onerror="this.style.display='none';this.parentElement.style.background='#e0ddd5'" />
      `;
      return;
    }

    prev.style.background = "linear-gradient(135deg,#2563EB,#7C3AED)";
    prev.style.padding    = "16px";
    prev.style.overflow   = "";
    prev.innerHTML = `
      <div style="font-size:11px;font-weight:700;opacity:.75;letter-spacing:.5px;text-transform:uppercase;color:#fff">
        ${esc(tipo === "texto" ? "Card de texto" : "Anuncio")}
      </div>
      <div style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:15px;margin-top:4px;color:#fff">
        ${esc(titulo)}
      </div>
      ${subtitulo ? `<div style="font-size:12px;opacity:.85;margin-top:2px;color:#fff">${esc(subtitulo)}</div>` : ""}
      ${descricao ? `<div style="font-size:11.5px;opacity:.75;margin-top:6px;color:#fff">${esc(descricao)}</div>` : ""}
      ${imagem ? `<div style="font-size:11.5px;opacity:.75;margin-top:6px;color:#fff">${esc(imagem)}</div>` : ""}
      ${link ? `<div style="font-size:11.5px;opacity:.75;margin-top:6px;color:#fff">${esc(link)}</div>` : ""}
      ${ativo ? `<div style="font-size:11.5px;opacity:.75;margin-top:6px;color:#fff">${esc(ativo)}</div>` : ""}
    `;
  }

  $("#ma-salvar").addEventListener("click", async (e) => {
    
    const titulo = $("#ma-titulo").value.trim();
   
    if (titulo === "") { toast("Informe ao menos o título do anúncio"); return; }

    const dados = {
      tipo:      $("#ma-tipo").value,
      titulo,
      subtitulo: $("#ma-subtitulo").value.trim(),
      descricao: $("#ma-descricao").value.trim(),
      imagem:    $("#ma-imagem").value.trim() || null,
      link:      $("#ma-link").value.trim()   || null,
      ativo:     $("#ma-ativo").value === 'true',
    };

    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      if (editandoAnuncioId) await Anuncios.atualizar(editandoAnuncioId, dados);
      else                   await Anuncios.criar(provedorAtual.id, dados);
      fecharModal("#modal-anuncio");
      await renderAnuncios();
      toast("Anúncio salvo");
    } catch (err) {
      toast(err.message || "Erro ao salvar anúncio");
    } finally {
      btn.disabled = false;
    }
  });

  /* ------------------------------ modal genérico ------------------------------ */
  function abrirModal(sel) { $(sel).classList.remove("hidden"); }
  function fecharModal(sel) { $(sel).classList.add("hidden"); }
  $$(".modal-overlay").forEach((ov) =>
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.classList.add("hidden"); })
  );

  /* ============================================================
   *  TAB: INDICAÇÕES
   * ============================================================*/
  async function renderIndicacoes() {
    const tbody = $("#lista-indicacoes");
    try {
      const itens = await Indicacoes.listar(provedorAtual.id);
      if (!itens.length) {
        tbody.innerHTML = `<tr class="tabela-vazia"><td colspan="4">Nenhuma indicação encontrada.</td></tr>`;
        return;
      }
      tbody.innerHTML = itens.map(i => `
        <tr class="indicacao-row">
          <td>
            <div class="cliente-info">
              <div class="cliente-avatar">${esc(i.nome_cliente).charAt(0).toUpperCase()}</div>
              <div>
                <div class="cliente-nome">${esc(i.nome_cliente)}</div>
                <div class="cliente-label">Cliente</div>
              </div>
            </div>
          </td>
          <td>
            <div class="cliente-info">
              <div class="cliente-avatar indicado">${esc(i.indicado).charAt(0).toUpperCase()}</div>
              <div>
                <div class="cliente-nome">${esc(i.indicado)}</div>
                <div class="cliente-label">Indicado</div>
              </div>
            </div>
          </td>
          <td><span class="badge-contato">📞 ${esc(formatarTelefone(i.contato))}</span></td>
          <td><div class="mensagem-box">${esc(i.mensagem || "Nenhuma mensagem enviada")}</div></td>
        </tr>
      `).join("");
    } catch (err) {
      tbody.innerHTML = `<tr class="tabela-vazia"><td colspan="4">Erro ao carregar indicações.</td></tr>`;
    }
  }

  /* ============================================================
   *  TAB: AVALIAÇÕES
   * ============================================================*/
  async function renderAvaliacoes() {
    const tbody = $("#lista-avaliacoes");
    try {
      const itens = await Avaliacoes.listar(provedorAtual.id);
      if (!itens.length) {
        tbody.innerHTML = `<tr class="tabela-vazia"><td colspan="4">Nenhuma avaliação encontrada.</td></tr>`;
        return;
      }
      tbody.innerHTML = itens
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(i => `
          <tr>
            <th scope="row">${esc(i.cliente)}</th>
            <td><div class="cliente-avatar">${esc(i.nota)}</div></td>
            <td><div class="mensagem-box">${esc(i.mensagem || "Nenhuma mensagem enviada")}</div></td>
            <td>${formataData(i.created_at)}</td>
          </tr>
        `).join("");
    } catch (err) {
      tbody.innerHTML = `<tr class="tabela-vazia"><td colspan="4">Erro ao carregar avaliações.</td></tr>`;
    }
  }

  /* ------------------------------ escape helpers ------------------------------ */
  function esc(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeAttr(str) { return esc(str); }
  function escapeJs(str) { return String(str ?? "").replace(/'/g, "\\'"); }

  /* ============================================================
   *  BOOT
   * ============================================================*/
  (async () => {
    const sessaoAtual = await Sessao.atual();
    if (sessaoAtual) abrirPainel(sessaoAtual);
  })();
})();