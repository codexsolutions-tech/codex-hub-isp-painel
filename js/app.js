/* ============================================================================
 * app.js — telas, navegação e ligação dos formulários com o store.js
 * ==========================================================================*/
(function () {
  const { Provedores, Temas, Banners, Anuncios, Indicacoes, Avaliacoes, Sessao } = window.Store;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  let provedorAtual = null; // registro completo do provedor logado 
  let editandoBannerId = null;
  let editandoAnuncioId = null;

  /* ------------------------------ toast ------------------------------ */
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
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
    // carrega tema, banners e parcerias em paralelo
    await Promise.all([preencherTabTema(), renderBanners(), renderAnuncios(), renderIndicacoes(), renderAvaliacoes()]);
    trocarTab("provedor");
  }

  $("#btn-sair").addEventListener("click", () => {
    Sessao.sair();
    provedorAtual = null;
    $("#tela-painel").classList.add("hidden");
    $("#tela-auth").classList.remove("hidden");
    $("#form-login").reset();
    mostrarLogin();
  });

  /* ============================================================
   *  NAVEGAÇÃO ENTRE ABAS
   * ============================================================*/
  const TITULOS_TAB = {
    provedor: ["Dados do provedor", "Informações cadastrais e credenciais do gerenciador"],
    tema: ["Tema do app", "Cores e logomarca exibidas para os assinantes"],
    banners: ["Banners", "Carrossel de ofertas na tela inicial do app"],
    anuncios: ["Anúncios", "Carrossel de anúncios do aplicativo"],
    indicacoes: ["Indicações","Clientes que indicaram novos assinantes pelo aplicativo."],
    avaliacoes: ["Avaliações","Clientes que avaliaram o serviço."],
  };

  function trocarTab(nome) {
    $$(".side-item").forEach((b) => b.classList.toggle("active", b.dataset.tab === nome));
    $$(".tab-panel").forEach((p) => p.classList.add("hidden"));
    $(`#tab-${nome}`).classList.remove("hidden");
    const [titulo, sub] = TITULOS_TAB[nome];
    $("#topbar-titulo").textContent = titulo;
    $("#topbar-sub").textContent = sub;
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

  // sincroniza os dois inputs de cor (texto <-> color picker)
  function ligarParCor(textoSel, pickerSel, onChange) {
    const txt = $(textoSel), pick = $(pickerSel);
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
    if (logo) {
      logoEl.innerHTML = `<img src="${escapeAttr(logo)}" alt="logo" onerror="this.parentElement.innerHTML='${escapeJs(glyph)}'" />`;
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
    if (!titulo) { toast("Informe ao menos o título do banner"); return; }
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
   *  TAB: PARCERIAS
   * ============================================================*/
  async function renderAnuncios() {
    const wrap = $("#lista-anuncios");
    let lista = [];
    try {
      lista = await Anuncios.listar(provedorAtual.id);
    } catch (err) {
      wrap.innerHTML = `<div class="vazio">Não foi possível carregar as parcerias.<br>${esc(err.message || "")}</div>`;
      return;
    }
    if (!lista.length) {
      wrap.innerHTML = `<div class="vazio"><div class="vazio-emoji">🤝</div>Nenhuma parceria cadastrada ainda.<br>Clique em "+ Nova parceria" para criar a primeira.</div>`;
      return;
    }
    wrap.innerHTML = lista.map((p) => `
      <div class="item-card">
        <div class="parceria-visual" style="background:${esc(p.cor || "#2563EB")}22">${esc(p.emoji || "✨")}</div>
        <div class="item-corpo">
          <div class="item-nome">${esc(p.nome || "Sem nome")}</div>
          <div class="item-sub">${esc(p.beneficios || "")}</div>
          ${p.link ? `<div class="item-link">🔗 ${esc(p.link)}</div>` : `<div class="item-link" style="color:var(--sub)">Sem link (apenas informativo)</div>`}
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
        if (!confirm("Excluir este anuncio? Esta ação não pode ser desfeita.")) return;
        try {
          await Anuncios.remover(btn.dataset.excluirParceria);
          await renderAnuncio();
          toast("Anuncio excluído");
        } catch (err) {
          toast(err.message || "Erro ao excluir anuncio");
        }
      })
    );
  }

  $("#novo-anuncio").addEventListener("click", () => abrirModalAnuncio(null, []));
  $("#ma-cancelar").addEventListener("click", () => fecharModal("#modal-anuncio"));

  function abrirModalAnuncio(id, listaAtual) {
    editandoAnuncioId = id;
    const p = id ? listaAtual.find((x) => x.id === id) : null;
    $("#modal-anuncio-titulo").textContent = id ? "Editar anuncio" : "Novo anuncio";
    $("#ma-tipo").value = p?.tipo || "";
    $("#ma-titulo").value = p?.titulo || "";
    $("#ma-subtitulo").value = p?.subtitulo || "";
    $("#ma-descricao").value = p?.descricao || "";
    $("#ma-imagem").value = p?.imagem || "";
    $("#ma-link").value = p?.link || "";
    $("#ma-ativo").value = p?.ativo || "";
   // $("#ma-cor").value = p?.cor || "#2563EB";
    //$("#ma-cor-picker").value = normalizarHex(p?.cor) || "#2563EB";
    //$("#ma-link").value = p?.link || "";
    atualizarPreviewAnuncio();
    abrirModal("#modal-anuncio");
  }

  ligarParCor("#ma-cor", "#ma-cor-picker", atualizarPreviewAnuncio);
  ["#ma-nome", "#ma-beneficio", "#ma-emoji"].forEach((sel) => $(sel).addEventListener("input", atualizarPreviewAnuncio));

  function atualizarPreviewAnuncio() {
    const cor =  "#2563EB";
    $("#ma-preview").style.background = cor;
    $("#ma-preview").innerHTML = `
      <div style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:14.5px;margin-top:4px">${esc($("#ma-tipo").value || "Titulo")}</div>
      <div style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:14.5px;margin-top:4px">${esc($("#ma-subtitulo").value || "Subtitulo")}</div>
      <div style="font-size:11.5px;opacity:.92">${esc($("#ma-descricao").value)}</div>
    `;
  }

  $("#ma-salvar").addEventListener("click", async (e) => {
    const nome = $("#ma-nome").value.trim();
    if (!nome) { toast("Informe ao menos o nome do parceiro"); return; }
    const dados = {
      nome,
      beneficio: $("#ma-beneficio").value.trim(),
      emoji: $("#ma-emoji").value.trim() || "✨",
      cor: $("#ma-cor").value.trim() || "#2563EB",
      link: $("#ma-link").value.trim(),
    };
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      if (editandoAnuncioId) await Anuncios.atualizar(editandoAnuncioId, dados);
      else await Anuncios.criar(provedorAtual.id, dados);
      fecharModal("#modal-anuncio");
      await renderAnuncios();
      toast("Anuncio salvo");
    } catch (err) {
      toast(err.message || "Erro ao salvar anuncio");
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
 * TAB: INDICAÇÕES
 * ============================================================ */

async function renderIndicacoes() {

    const tbody = $("#lista-indicacoes");

    try {

        const itens = await Indicacoes.listar(provedorAtual.id);

        if (!itens.length) {
            tbody.innerHTML = `
                <tr class="tabela-vazia">
                    <td colspan="4">
                        Nenhuma indicação encontrada.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = itens.map(i => `
          <tr class="indicacao-row">

    <td>
        <div class="cliente-info">
            <div class="cliente-avatar">
                ${esc(i.nome_cliente).charAt(0).toUpperCase()}
            </div>

            <div>
                <div class="cliente-nome">
                    ${esc(i.nome_cliente)}
                </div>

                <div class="cliente-label">
                    Cliente
                </div>
            </div>
        </div>
    </td>

    <td>
        <div class="cliente-info">
            <div class="cliente-avatar indicado">
                ${esc(i.indicado).charAt(0).toUpperCase()}
            </div>

            <div>
                <div class="cliente-nome">
                    ${esc(i.indicado)}
                </div>

                <div class="cliente-label">
                    Indicado
                </div>
            </div>
        </div>
    </td>

    <td>
        <span class="badge-contato">
            📞 ${esc(formatarTelefone(i.contato))}
        </span>
    </td>

    <td>
        <div class="mensagem-box">
            ${esc(i.mensagem || "Nenhuma mensagem enviada")}
        </div>
    </td>

</tr>
        `).join("");

    } catch (err) {

        tbody.innerHTML = `
            <tr class="tabela-vazia">
                <td colspan="4">
                    Erro ao carregar indicações.
                </td>
            </tr>
        `;

    }

}

 /* ============================================================
 * TAB: AVALIAÇÃO
 * ============================================================ */

async function renderAvaliacoes() {

    const tbody = $("#lista-avaliacoes");

    try {

        const itens = await Avaliacoes.listar(provedorAtual.id);

        if (!itens.length) {
            tbody.innerHTML = `
                <tr class="tabela-vazia">
                    <td colspan="4">
                        Nenhuma avaliação encontrada.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = itens.map(i => `
           <tr>
            <th scope="row">${i.cliente}</th>
            <td >
              <div class="cliente-avatar ">
                  ${esc(i.nota)}
              </div>
            </td>
            <td>
              <div class="mensagem-box">
                ${esc(i.mensagem || "Nenhuma mensagem enviada")}
              </div>
            </td>
            <td>${formataData(i.created_at)}</td>
          </tr>
         
        `).join("");

    } catch (err) {

        tbody.innerHTML = `
            <tr class="tabela-vazia">
                <td colspan="4">
                    Erro ao carregar indicações.
                </td>
            </tr>
        `;

    }

}

  /* ------------------------------ escape helpers ------------------------------ */
  function esc(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeAttr(str) { return esc(str); }
  function escapeJs(str) { return String(str ?? "").replace(/'/g, "\\'"); }

  /* ============================================================
   *  BOOT — retoma sessão se já estiver logado (token válido ou sessão mock)
   * ============================================================*/
  (async () => {
    const sessaoAtual = await Sessao.atual();
    if (sessaoAtual) abrirPainel(sessaoAtual);
  })();
})();
