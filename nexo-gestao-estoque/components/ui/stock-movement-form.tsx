"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export type StockProduct = {
  id: string;
  nome: string;
  estoque_atual: number;
  unidade_medida: string;
  ativo: boolean;
};
export type StockPayload = {
  produto_id: string;
  tipo: "entrada" | "saida";
  quantidade: string;
  motivo: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: StockProduct[];
  onSubmit: (data: StockPayload) => Promise<string | null>;
};

export function StockMovementForm({ open, onOpenChange, products, onSubmit }: Props) {
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"entrada" | "saida">("entrada");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = products.find(product => product.id === productId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setBusy(true);
    try {
      const response = await onSubmit({
        produto_id: String(form.get("produto_id") || ""),
        tipo: String(form.get("tipo")) as "entrada" | "saida",
        quantidade: String(form.get("quantidade") || ""),
        motivo: String(form.get("motivo") || "").trim(),
      });
      if (response) setError(response);
      else {
        onOpenChange(false);
        setProductId("");
        setType("entrada");
      }
    } catch {
      setError("Não foi possível registrar a movimentação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <Dialog open={open} onOpenChange={value => { if (!busy) { setError(""); onOpenChange(value); } }}>
    <DialogContent className="form-dialog">
      <DialogHeader>
        <DialogTitle>Registrar movimentação</DialogTitle>
        <DialogDescription>O saldo e o histórico serão atualizados juntos.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="form-stack modal-form">
        <label>Produto
          <select name="produto_id" value={productId} onChange={event => setProductId(event.target.value)} required>
            <option value="">Selecione um produto</option>
            {products.filter(product => product.ativo).map(product =>
              <option key={product.id} value={product.id}>{product.nome}</option>
            )}
          </select>
        </label>
        {selected && <p className="stock-balance">Saldo atual: <strong>{Number(selected.estoque_atual).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {selected.unidade_medida}</strong></p>}
        <div className="field-grid">
          <label>Operação
            <select name="tipo" value={type} onChange={event => setType(event.target.value as "entrada" | "saida")}>
              <option value="entrada">Entrada (+)</option>
              <option value="saida">Saída (−)</option>
            </select>
          </label>
          <label>Quantidade
            <input name="quantidade" type="number" min="0.001" step="0.001" required placeholder="Ex.: 2" />
          </label>
        </div>
        <label>Motivo <small>(opcional)</small>
          <input name="motivo" maxLength={255} placeholder={type === "entrada" ? "Ex.: Compra de mercadorias" : "Ex.: Venda"} />
        </label>
        {type === "saida" && <p className="form-hint">A saída não pode ser maior que o saldo disponível.</p>}
        {error && <p className="notice" role="alert">{error}</p>}
        <div className="form-footer">
          <button className="secondary" type="button" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</button>
          <button className="primary" type="submit" disabled={busy || !products.length}>
            {busy ? "Registrando…" : "Registrar"}
          </button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
