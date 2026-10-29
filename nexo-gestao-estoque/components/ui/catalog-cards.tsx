"use client";

import { Boxes, ImageIcon, Minus, Package, Pencil, Plus, Trash2 } from "lucide-react";

export type CatalogItem = { id: string; nome: string; imagem_path?: string | null; [key: string]: unknown };
export type CatalogProduct = CatalogItem & {
  sku: string | null;
  categoria_id: string | null;
  preco_venda: number;
  estoque_atual: number;
  estoque_minimo: number;
  unidade_medida: string;
  ativo: boolean;
};

function Photo({ item, urls, fallback }: { item: CatalogItem; urls: Record<string, string>; fallback: React.ReactNode }) {
  const src = item.imagem_path && urls[item.imagem_path];
  return <div className="catalog-photo">
    {src ? <img src={src} alt={item.nome} loading="lazy" /> : <span aria-hidden="true">{fallback}</span>}
  </div>;
}

function Actions({ item, onEdit, onDelete }: {
  item: CatalogItem;
  onEdit: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
}) {
  return <div className="catalog-actions">
    <button type="button" onClick={() => onEdit(item)} aria-label={`Editar ${item.nome}`} title="Editar"><Pencil size={17} /></button>
    <button type="button" onClick={() => onDelete(item)} aria-label={`Excluir ${item.nome}`} title="Excluir"><Trash2 size={17} /></button>
  </div>;
}

export function ProductCards({ items, urls, categoryName, onEdit, onDelete, onMove, busyId }: {
  items: CatalogProduct[];
  urls: Record<string, string>;
  categoryName: (id: string | null) => string;
  onEdit: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
  onMove: (item: CatalogProduct, type: "entrada" | "saida") => void;
  busyId: string | null;
}) {
  const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
  const number = (value: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(value) || 0);
  return <div className="catalog-grid">
    {items.map(item => {
      const low = Number(item.estoque_atual) <= Number(item.estoque_minimo);
      return <article className="catalog-card" key={item.id}>
        <Photo item={item} urls={urls} fallback={<Package size={32} />} />
        <div className="catalog-card-body">
          <div className="catalog-card-top">
            <span className="catalog-category">{categoryName(item.categoria_id)}</span>
            <Actions item={item} onEdit={onEdit} onDelete={onDelete} />
          </div>
          <h3>{item.nome}</h3>
          <p className="catalog-sku">{item.sku || "Sem SKU"}</p>
          <div className="catalog-card-stats">
            <div><small>Preço de venda</small><strong>{money(item.preco_venda)}</strong></div>
            <div><small>Em estoque</small><strong>{number(item.estoque_atual)} {item.unidade_medida}</strong></div>
          </div>
          <div className="catalog-card-bottom">
            <span className={`status ${low ? "warning" : "good"}`}>{low ? "Estoque baixo" : "Em estoque"}</span>
            <div className="stock-stepper" aria-label={`Movimentar ${item.nome} uma ${item.unidade_medida} por vez`}>
              <button type="button" onClick={() => onMove(item, "saida")} disabled={busyId === item.id || !item.ativo || Number(item.estoque_atual) < 1} aria-label={`Retirar 1 ${item.unidade_medida} de ${item.nome}`} title={`Retirar 1 ${item.unidade_medida}`}><Minus size={17} /></button>
              <span>1 {item.unidade_medida}</span>
              <button type="button" onClick={() => onMove(item, "entrada")} disabled={busyId === item.id || !item.ativo} aria-label={`Adicionar 1 ${item.unidade_medida} a ${item.nome}`} title={`Adicionar 1 ${item.unidade_medida}`}><Plus size={17} /></button>
            </div>
          </div>
        </div>
      </article>;
    })}
  </div>;
}

export function CategoryCards({ items, products, urls, onEdit, onDelete }: {
  items: CatalogItem[];
  products: CatalogProduct[];
  urls: Record<string, string>;
  onEdit: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
}) {
  return <div className="catalog-grid">
    {items.map(item => <article className="catalog-card category-card" key={item.id}>
      <Photo item={item} urls={urls} fallback={<ImageIcon size={32} />} />
      <div className="catalog-card-body">
        <div className="catalog-card-top"><span className="catalog-category">CATEGORIA</span><Actions item={item} onEdit={onEdit} onDelete={onDelete} /></div>
        <h3>{item.nome}</h3>
        <p className="catalog-description">{String(item.descricao || "Sem descrição")}</p>
        <div className="category-count"><Boxes size={16} /> {products.filter(product => product.categoria_id === item.id).length} produto(s)</div>
      </div>
    </article>)}
  </div>;
}
