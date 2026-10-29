"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";
import { Boxes, LayoutDashboard, Package, Tags, Truck, ArrowLeftRight, Plus, Search, LogOut, Menu, X, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StockMovementForm, type StockPayload } from "@/components/ui/stock-movement-form";
import { CategoryCards, ProductCards } from "@/components/ui/catalog-cards";

const db = createClient("https://keejulfojcjmffgnnjbd.supabase.co", "sb_publishable_Imdd6mJFnoigGs51_XHdkw_Qxb_CNBm");
type View = "dashboard" | "produtos" | "categorias" | "fornecedores" | "movimentacoes";
type RecordData = { id: string; nome: string; [key: string]: unknown };
type Product = RecordData & { sku: string | null; categoria_id: string | null; preco_custo: number; preco_venda: number; estoque_atual: number; estoque_minimo: number; unidade_medida: string; ativo: boolean };
type Movement = { id: string; produto_id: string; tipo: string; quantidade: number; motivo: string | null; criado_em: string };
const nav = [{ id: "dashboard", label: "Visão geral", icon: LayoutDashboard }, { id: "produtos", label: "Produtos", icon: Package }, { id: "categorias", label: "Categorias", icon: Tags }, { id: "fornecedores", label: "Fornecedores", icon: Truck }, { id: "movimentacoes", label: "Movimentações", icon: ArrowLeftRight }] as const;
const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const num = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(n) || 0);

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<{ id: string; nome: string; nome_fantasia: string | null } | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<RecordData[]>([]);
  const [suppliers, setSuppliers] = useState<RecordData[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [modal, setModal] = useState<"produtos" | "categorias" | "fornecedores" | null>(null);
  const [editing, setEditing] = useState<RecordData | null>(null);
  const [movementOpen, setMovementOpen] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [stockFeedback, setStockFeedback] = useState("");

  const loadCompany = useCallback(async (u: User) => {
    const { data, error } = await db.from("usuarios_empresas").select("empresa_id, empresas(id,nome,nome_fantasia)").eq("usuario_id", u.id).eq("ativo", true).limit(1);
    if (error) setMessage(error.message);
    setCompany((data?.[0]?.empresas as unknown as { id: string; nome: string; nome_fantasia: string | null }) || null);
    setLoading(false);
  }, []);
  const refresh = useCallback(async (id: string) => {
    const [p, c, s, m] = await Promise.all([
      db.from("produtos").select("*").eq("empresa_id", id).order("nome"),
      db.from("categorias").select("*").eq("empresa_id", id).order("nome"),
      db.from("fornecedores").select("*").eq("empresa_id", id).order("nome"),
      db.from("movimentacoes_estoque").select("id,produto_id,tipo,quantidade,motivo,criado_em").eq("empresa_id", id).order("criado_em", { ascending: false }).limit(100),
    ]);
    const error = [p.error, c.error, s.error, m.error].find(Boolean); if (error) setMessage(error.message);
    setProducts((p.data || []) as Product[]); setCategories((c.data || []) as RecordData[]); setSuppliers((s.data || []) as RecordData[]); setMovements((m.data || []) as Movement[]);
    const paths = [...(p.data || []), ...(c.data || [])]
      .map(item => item.imagem_path as string | null)
      .filter((path): path is string => Boolean(path));
    if (paths.length) {
      const { data: signed, error: imageError } = await db.storage.from("catalogo").createSignedUrls(paths, 3600);
      if (imageError) setMessage(imageError.message);
      setImageUrls(Object.fromEntries((signed || []).filter(item => item.signedUrl).map(item => [item.path, item.signedUrl])));
    } else setImageUrls({});
  }, []);
  useEffect(() => {
    db.auth.getUser().then(({ data, error }) => { if (error) setMessage(error.message); setUser(data.user); if (data.user) void loadCompany(data.user); else setLoading(false); });
    const { data } = db.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); if (!session?.user) { setCompany(null); setLoading(false); } });
    return () => data.subscription.unsubscribe();
  }, [loadCompany]);
  useEffect(() => { if (company) void refresh(company.id); }, [company, refresh]);
  useEffect(() => {
    if (!company) return;
    const timer = window.setInterval(() => void refresh(company.id), 45 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [company, refresh]);

  async function auth(form: FormData) {
    setBusy(true); setMessage("");
    const email = String(form.get("email") || "").trim(), password = String(form.get("password") || "");
    const { data, error } = mode === "login" ? await db.auth.signInWithPassword({ email, password }) : await db.auth.signUp({ email, password });
    if (error) setMessage(error.message);
    else if (data.user && data.session) { setUser(data.user); await loadCompany(data.user); }
    else setMessage("Confira seu e-mail e confirme o cadastro. Depois, entre na sua conta.");
    setBusy(false);
  }
  async function createCompany(form: FormData) {
    setBusy(true); setMessage("");
    const { data, error } = await db.functions.invoke("create-company", { body: { nome: String(form.get("nome") || "").trim(), nome_fantasia: String(form.get("fantasia") || "").trim() || null } });
    if (error || !data?.success) { let detail = data?.message || error?.message || "Não foi possível criar a empresa."; if (error && "context" in error && error.context instanceof Response) { try { detail = (await error.context.json()).message || detail; } catch {} } setMessage(detail); }
    else if (user) await loadCompany(user);
    setBusy(false);
  }
  async function save(form: FormData) {
    if (!company || !modal) return;
    setBusy(true); setMessage("");
    const val = (key: string) => String(form.get(key) || "").trim();
    const payload: Record<string, unknown> = modal === "categorias" ? { nome: val("nome"), descricao: val("descricao") || null } : modal === "fornecedores" ? { nome: val("nome"), documento: val("documento") || null, telefone: val("telefone") || null, email: val("email") || null } : { nome: val("nome"), sku: val("sku") || null, categoria_id: val("categoria_id") || null, preco_custo: Number(val("preco_custo")), preco_venda: Number(val("preco_venda")), estoque_minimo: Number(val("estoque_minimo")), unidade_medida: val("unidade_medida") || "UN" };
    const oldPath = typeof editing?.imagem_path === "string" ? editing.imagem_path : null;
    let uploadedPath: string | null = null;
    if (modal === "produtos" || modal === "categorias") {
      const selected = form.get("imagem");
      if (selected instanceof File && selected.size > 0) {
        const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
        if (!extensions[selected.type] || selected.size > 3 * 1024 * 1024) {
          setMessage("Envie uma imagem JPG, PNG ou WebP de até 3 MB."); setBusy(false); return;
        }
        uploadedPath = `${company.id}/${modal}/${crypto.randomUUID()}.${extensions[selected.type]}`;
        const { error: uploadError } = await db.storage.from("catalogo").upload(uploadedPath, selected, { contentType: selected.type, upsert: false });
        if (uploadError) { setMessage(uploadError.message); setBusy(false); return; }
        payload.imagem_path = uploadedPath;
      } else if (form.get("remover_imagem") === "on") payload.imagem_path = null;
    }
    const result = editing ? await db.from(modal).update(payload).eq("id", editing.id).eq("empresa_id", company.id) : await db.from(modal).insert({ ...payload, empresa_id: company.id });
    if (result.error) {
      if (uploadedPath) await db.storage.from("catalogo").remove([uploadedPath]);
      setMessage(result.error.message);
    } else {
      if (oldPath && (uploadedPath || payload.imagem_path === null)) {
        await db.storage.from("catalogo").remove([oldPath]);
      }
      setModal(null); setEditing(null); await refresh(company.id);
    }
    setBusy(false);
  }
  async function remove(kind: "produtos" | "categorias" | "fornecedores", item: RecordData) {
    if (!company || !window.confirm(`Excluir ${item.nome}?`)) return;
    const { error } = await db.from(kind).delete().eq("id", item.id).eq("empresa_id", company.id);
    if (error) setMessage(error.message);
    else {
      if (typeof item.imagem_path === "string") await db.storage.from("catalogo").remove([item.imagem_path]);
      await refresh(company.id);
    }
  }
  async function registerMovement(payload: StockPayload): Promise<string | null> {
    if (!company) return "Selecione uma empresa.";
    const { data, error } = await db.functions.invoke("stock-movements", {
      body: { ...payload, empresa_id: company.id },
    });
    if (error || !data?.success) {
      if (error && "context" in error && error.context instanceof Response) {
        try {
          const response = await error.context.json();
          return response.message || "Não foi possível registrar a movimentação.";
        } catch { /* resposta sem JSON */ }
      }
      return data?.message || error?.message || "Não foi possível registrar a movimentação.";
    }
    await refresh(company.id);
    return null;
  }
  async function quickMove(item: { id: string; nome: string; unidade_medida: string }, tipo: "entrada" | "saida") {
    setBusyProductId(item.id); setMessage(""); setStockFeedback("");
    try {
      const error = await registerMovement({
        produto_id: item.id, tipo, quantidade: "1",
        motivo: tipo === "entrada" ? "Adição rápida pelo card" : "Retirada rápida pelo card",
      });
      if (error) setMessage(error);
      else setStockFeedback(`${item.nome}: 1 ${item.unidade_medida} ${tipo === "entrada" ? "adicionada" : "retirada"} com sucesso.`);
    } catch {
      setMessage("Não foi possível atualizar o estoque. Tente novamente.");
    } finally {
      setBusyProductId(null);
    }
  }
  const open = (kind: "produtos" | "categorias" | "fornecedores", item: RecordData | null = null) => { setEditing(item); setModal(kind); setMessage(""); };
  const category = (id: string | null) => categories.find(c => c.id === id)?.nome || "Sem categoria";
  const low = products.filter(p => Number(p.estoque_atual) <= Number(p.estoque_minimo));
  const filtered = products.filter(p => `${p.nome} ${p.sku || ""}`.toLowerCase().includes(query.toLowerCase()));
  const current = nav.find(n => n.id === view)?.label;
  const formMessage = message && <p className="notice" role="status">{message}</p>;

  if (loading) return <main className="loading-screen"><span className="brand-mark"><Boxes /></span><p>Carregando seu espaço…</p></main>;
  if (!user) return <main className="auth-shell"><div className="auth-aside"><Logo /><div className="auth-statement"><span className="overline">GESTÃO PARA COMÉRCIOS</span><h1>Seu estoque, <em>em ordem.</em></h1><p>Produtos, fornecedores e números em um só lugar. Pronto para acompanhar o ritmo do seu negócio.</p></div><small>Uma visão clara para cada decisão.</small></div><div className="auth-main"><div className="auth-card"><span className="overline">BEM-VINDO AO NEXO</span><h2>{mode === "login" ? "Acesse sua conta" : "Crie sua conta"}</h2><p>{mode === "login" ? "Entre para acompanhar seu estoque." : "Comece a organizar sua operação."}</p><form action={auth} className="form-stack"><label>E-mail<input name="email" type="email" autoComplete="email" required placeholder="voce@empresa.com.br" /></label><label>Senha<input name="password" type="password" minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} required placeholder="Mínimo de 6 caracteres" /></label><button className="primary full" disabled={busy}>{busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}</button></form>{formMessage}<div className="auth-switch">{mode === "login" ? "Ainda não tem conta?" : "Já tem uma conta?"} <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>{mode === "login" ? "Cadastre-se" : "Entrar"}</button></div></div></div></main>;
  if (!company) return <main className="setup-shell"><Logo /><div className="setup-card"><span className="overline">PRIMEIRO PASSO</span><h1>Vamos cadastrar seu comércio</h1><p>Você será o administrador. Depois, é só começar a adicionar categorias e produtos.</p><form action={createCompany} className="form-stack"><label>Nome da empresa<input name="nome" minLength={2} required placeholder="Ex.: Loja Arrigoni" /></label><label>Nome fantasia <small>(opcional)</small><input name="fantasia" placeholder="Nome exibido no painel" /></label><button className="primary full" disabled={busy}>{busy ? "Criando…" : "Criar empresa"}</button></form>{formMessage}<button className="text-button" onClick={() => db.auth.signOut()}>Sair da conta</button></div></main>;

  return <div className="app-shell"><aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}><div className="side-logo"><Logo /><button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><X /></button></div><span className="nav-caption">ESPAÇO DE TRABALHO</span><div className="company-card"><span className="company-avatar">{company.nome.charAt(0).toUpperCase()}</span><span><strong>{company.nome_fantasia || company.nome}</strong><small>Meu comércio</small></span></div><span className="nav-caption">GERENCIAR</span><nav aria-label="Menu principal">{nav.map(item => <button key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => { setView(item.id); setQuery(""); setMessage(""); setMobileNav(false); }}><item.icon size={19} />{item.label}{item.id === "produtos" && <small>{products.length}</small>}</button>)}</nav><div className="side-bottom"><div className="side-help"><Boxes size={20} /><strong>Organize seu estoque</strong><p>Cadastre produtos e acompanhe os itens que precisam de atenção.</p></div><div className="side-user"><span className="user-avatar">{user.email?.charAt(0).toUpperCase()}</span><span><strong>{user.email?.split("@")[0]}</strong><small>Administrador</small></span><button onClick={() => db.auth.signOut()} title="Sair" aria-label="Sair"><LogOut size={18} /></button></div></div></aside>
  <main className="main"><header className="topbar"><button className="menu-toggle" aria-label="Abrir menu" onClick={() => setMobileNav(true)}><Menu /></button><div>Workspace <span>/</span> <strong>{current}</strong></div><div className="top-user">{company.nome_fantasia || company.nome}<span className="user-avatar">{user.email?.charAt(0).toUpperCase()}</span></div></header><div className="content">{message && <div className="notice app-notice" role="alert">{message}<button onClick={() => setMessage("")} aria-label="Fechar aviso"><X size={16} /></button></div>}{stockFeedback && <div className="success-notice" role="status">{stockFeedback}<button onClick={() => setStockFeedback("")} aria-label="Fechar aviso"><X size={16} /></button></div>}
  <div className="page-heading"><div><span className="overline">{view === "dashboard" ? "PAINEL DE CONTROLE" : view === "produtos" ? "CATÁLOGO" : view === "categorias" ? "ORGANIZAÇÃO" : view === "fornecedores" ? "PARCEIROS" : "HISTÓRICO"}</span><h1>{current}</h1><p>{view === "dashboard" ? "O que acontece no seu estoque, em um só lugar." : view === "produtos" ? "Organize e acompanhe os itens do seu comércio." : view === "categorias" ? "Agrupe os produtos do seu jeito." : view === "fornecedores" ? "Mantenha os contatos de quem abastece seu negócio." : "Acompanhe entradas, saídas e ajustes do estoque."}</p></div>{view === "movimentacoes" ? <button className="primary" onClick={() => setMovementOpen(true)} disabled={!products.some(p => p.ativo)}><Plus size={18} /> Registrar movimentação</button> : <button className="primary" onClick={() => open(view === "dashboard" ? "produtos" : view)}><Plus size={18} /> {view === "dashboard" ? "Novo produto" : view === "produtos" ? "Novo produto" : view === "categorias" ? "Nova categoria" : "Novo fornecedor"}</button>}</div>
  {view === "dashboard" && <><div className="stat-grid"><Stat icon={<Package />} label="Produtos cadastrados" value={String(products.length)} caption="no catálogo" /><Stat icon={<Boxes />} label="Valor em estoque" value={brl(products.reduce((sum, p) => sum + p.estoque_atual * p.preco_custo, 0))} caption="calculado pelo preço de custo" /><Stat icon={<AlertTriangle />} label="Estoque baixo" value={String(low.length)} caption="itens no mínimo ou abaixo" /><Stat icon={<Truck />} label="Fornecedores" value={String(suppliers.length)} caption="cadastrados" /></div><div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h2>Precisam de atenção</h2><p>Produtos no limite do estoque mínimo</p></div><button onClick={() => setView("produtos")}>Ver produtos →</button></div>{low.length ? low.slice(0, 5).map(p => <div className="compact-row" key={p.id}><span className="item-icon"><Package size={18} /></span><span><strong>{p.nome}</strong><small>{category(p.categoria_id)}</small></span><span className="low-pill">{num(p.estoque_atual)} {p.unidade_medida}</span></div>) : <Empty title="Tudo em dia por aqui" detail="Os produtos abaixo do mínimo aparecerão neste espaço." compact />}</section><section className="panel"><div className="panel-head"><div><h2>Últimas movimentações</h2><p>Histórico recente do estoque</p></div><button onClick={() => setView("movimentacoes")}>Ver histórico →</button></div>{movements.length ? movements.slice(0, 5).map(m => <div className="compact-row" key={m.id}><span className="item-icon"><ArrowLeftRight size={18} /></span><span><strong>{products.find(p => p.id === m.produto_id)?.nome || "Produto removido"}</strong><small>{new Date(m.criado_em).toLocaleString("pt-BR")}</small></span><span className="movement-qty">{m.tipo.replaceAll("_", " ")} · {num(m.quantidade)}</span></div>) : <Empty title="Sem movimentações ainda" detail="As entradas e saídas aparecerão aqui." compact />}</section></div></>}
  {view === "movimentacoes" && !products.some(p => p.ativo) && <div className="info-banner"><AlertTriangle size={20} /> Cadastre um produto ativo antes de registrar entradas e saídas.</div>}
  {view === "produtos" && <>
    <div className="catalog-toolbar"><div className="search-box"><Search size={18} /><input aria-label="Buscar produtos" placeholder="Buscar por nome ou SKU..." value={query} onChange={event => setQuery(event.target.value)} /></div><span>{filtered.length} produto{filtered.length !== 1 ? "s" : ""}</span></div>
    {filtered.length ? <ProductCards items={filtered} urls={imageUrls} categoryName={category} onEdit={item => open("produtos", item)} onDelete={item => remove("produtos", item)} onMove={quickMove} busyId={busyProductId} /> : <div className="panel"><Empty title={query ? "Nenhum produto encontrado" : "Seu catálogo começa aqui"} detail={query ? "Tente outro nome ou SKU." : "Adicione o primeiro produto para começar."} action={query ? undefined : () => open("produtos")} /></div>}
  </>}
  {view === "categorias" && (categories.length ? <CategoryCards items={categories} products={products} urls={imageUrls} onEdit={item => open("categorias", item)} onDelete={item => remove("categorias", item)} /> : <div className="panel"><Empty title="Nenhuma categoria cadastrada" detail="Crie uma categoria para organizar seus produtos." action={() => open("categorias")} /></div>)}
  {(view === "fornecedores" || view === "movimentacoes") && <div className="panel table-panel">
    {(view === "fornecedores" ? suppliers : movements).length ? <div className="table-scroll"><table><thead><tr>
      {(view === "fornecedores" ? ["Fornecedor", "Documento", "Telefone", "E-mail", ""] : ["Produto", "Tipo", "Quantidade", "Motivo", "Data"]).map((title, index) => <th key={index}>{title}</th>)}
    </tr></thead><tbody>
      {view === "fornecedores" ? suppliers.map(item => <tr key={item.id}><td><Name icon={<Truck size={18} />} name={item.nome} /></td><td>{String(item.documento || "—")}</td><td>{String(item.telefone || "—")}</td><td>{String(item.email || "—")}</td><td><Actions item={item} edit={() => open("fornecedores", item)} remove={() => remove("fornecedores", item)} /></td></tr>) : movements.map(item => <tr key={item.id}><td>{products.find(product => product.id === item.produto_id)?.nome || "Produto removido"}</td><td className="capitalize">{item.tipo.replaceAll("_", " ")}</td><td>{num(item.quantidade)}</td><td>{item.motivo || "—"}</td><td>{new Date(item.criado_em).toLocaleString("pt-BR")}</td></tr>)}
    </tbody></table></div> : <Empty title={view === "fornecedores" ? "Nenhum fornecedor cadastrado" : "Nenhuma movimentação registrada"} detail={view === "fornecedores" ? "Adicione o primeiro fornecedor para começar." : "Clique em Registrar movimentação para fazer a primeira entrada ou saída."} action={view === "fornecedores" ? () => open("fornecedores") : undefined} />}
  </div>}

  </div></main><Dialog open={!!modal} onOpenChange={yes => { if (!yes) { setModal(null); setEditing(null); setMessage(""); } }}><DialogContent className="form-dialog"><DialogHeader><DialogTitle>{editing ? "Editar" : "Novo cadastro:"} {modal === "produtos" ? "produto" : modal === "categorias" ? "categoria" : "fornecedor"}</DialogTitle><DialogDescription>Preencha as informações e salve o cadastro.</DialogDescription></DialogHeader><form action={save} className="form-stack modal-form" key={`${modal}-${editing?.id || "new"}`}><label>Nome<input name="nome" required maxLength={150} defaultValue={editing?.nome || ""} placeholder="Nome do registro" /></label>{(modal === "produtos" || modal === "categorias") && <div className="image-form-field"><label>Imagem representativa <small>(opcional, JPG, PNG ou WebP, até 3 MB)</small><input name="imagem" type="file" accept="image/jpeg,image/png,image/webp" /></label>{typeof editing?.imagem_path === "string" && imageUrls[editing.imagem_path] && <div className="image-form-current"><img src={imageUrls[editing.imagem_path]} alt={editing.nome} /><label><input type="checkbox" name="remover_imagem" /> Remover imagem atual</label></div>}</div>}{modal === "categorias" && <label>Descrição <small>(opcional)</small><textarea name="descricao" defaultValue={String(editing?.descricao || "")} placeholder="Descreva a categoria" /></label>}{modal === "fornecedores" && <><div className="field-grid"><label>CPF ou CNPJ<input name="documento" defaultValue={String(editing?.documento || "")} /></label><label>Telefone<input name="telefone" type="tel" defaultValue={String(editing?.telefone || "")} /></label></div><label>E-mail<input name="email" type="email" defaultValue={String(editing?.email || "")} /></label></>}{modal === "produtos" && <><div className="field-grid"><label>SKU<input name="sku" defaultValue={String(editing?.sku || "")} placeholder="Ex.: CAM-001" /></label><label>Categoria<select name="categoria_id" defaultValue={String(editing?.categoria_id || "")}><option value="">Sem categoria</option>{categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label></div><div className="field-grid"><label>Preço de custo (R$)<input name="preco_custo" type="number" min="0" step="0.01" required defaultValue={Number(editing?.preco_custo || 0)} /></label><label>Preço de venda (R$)<input name="preco_venda" type="number" min="0" step="0.01" required defaultValue={Number(editing?.preco_venda || 0)} /></label></div><div className="field-grid"><label>Estoque mínimo<input name="estoque_minimo" type="number" min="0" step="0.001" required defaultValue={Number(editing?.estoque_minimo || 0)} /></label><label>Unidade<select name="unidade_medida" defaultValue={String(editing?.unidade_medida || "UN")}><option value="UN">Unidade (UN)</option><option value="KG">Quilo (KG)</option><option value="L">Litro (L)</option><option value="M">Metro (M)</option><option value="CX">Caixa (CX)</option></select></label></div><p className="form-hint">O saldo começa em zero. Use a página Movimentações para registrar entradas e saídas.</p></>}{formMessage}<div className="form-footer"><button className="secondary" type="button" onClick={() => setModal(null)}>Cancelar</button><button className="primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button></div></form></DialogContent></Dialog><StockMovementForm open={movementOpen} onOpenChange={setMovementOpen} products={products} onSubmit={registerMovement} /></div>;
}

function Logo() { return <div className="brand"><span className="brand-mark"><Boxes size={23} /></span><strong>nexo<span>.</span></strong></div>; }
function Stat({ icon, label, value, caption }: { icon: React.ReactNode; label: string; value: string; caption: string }) { return <div className="stat"><div className="stat-label">{label}<span>{icon}</span></div><strong>{value}</strong><small>{caption}</small></div>; }
function Empty({ title, detail, compact, action }: { title: string; detail: string; compact?: boolean; action?: () => void }) { return <div className={compact ? "empty compact" : "empty"}><span className="empty-icon"><Boxes size={24} /></span><h3>{title}</h3><p>{detail}</p>{action && <button className="primary" onClick={action}><Plus size={17} /> Adicionar</button>}</div>; }
function Name({ icon, name, sub }: { icon: React.ReactNode; name: string; sub?: string }) { return <div className="name-cell"><span className="item-icon">{icon}</span><span><strong>{name}</strong>{sub && <small>{sub}</small>}</span></div>; }
function Actions({ item, edit, remove }: { item: RecordData; edit: () => void; remove: () => void }) { return <div className="row-actions"><button onClick={edit} aria-label={`Editar ${item.nome}`}><Pencil size={16} /></button><button onClick={remove} aria-label={`Excluir ${item.nome}`}><Trash2 size={16} /></button></div>; }
