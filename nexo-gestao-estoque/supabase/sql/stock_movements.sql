-- Execute uma vez no SQL Editor do projeto "Gestão para Comércios".
-- O trigger faz a mudança de saldo na mesma transação do INSERT do histórico.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.aplicar_movimentacao_estoque()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  saldo_anterior numeric(14,3);
  produto_ativo boolean;
  novo_saldo numeric(14,3);
begin
  if (select auth.uid()) is null or new.usuario_id is distinct from (select auth.uid()) then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.usuarios_empresas ue
    join public.empresas e on e.id = ue.empresa_id
    where ue.usuario_id = (select auth.uid())
      and ue.empresa_id = new.empresa_id
      and ue.ativo = true
      and e.ativo = true
  ) then
    raise exception 'Você não tem acesso a esta empresa.' using errcode = '42501';
  end if;

  if new.tipo not in ('entrada', 'saida') then
    raise exception 'Tipo de movimentação inválido.' using errcode = '22023';
  end if;

  if new.quantidade is null or new.quantidade <= 0 then
    raise exception 'A quantidade deve ser maior que zero.' using errcode = '22023';
  end if;

  select p.estoque_atual, p.ativo
    into saldo_anterior, produto_ativo
    from public.produtos p
   where p.id = new.produto_id
     and p.empresa_id = new.empresa_id
   for update;

  if not found or not produto_ativo then
    raise exception 'Produto não encontrado ou inativo nesta empresa.' using errcode = '22023';
  end if;

  novo_saldo := saldo_anterior
    + case when new.tipo = 'entrada' then new.quantidade else -new.quantidade end;

  if novo_saldo < 0 then
    raise exception 'Estoque insuficiente para esta saída.' using errcode = '22023';
  end if;

  update public.produtos
     set estoque_atual = novo_saldo
   where id = new.produto_id and empresa_id = new.empresa_id;

  return new;
end;
$$;

revoke all on function private.aplicar_movimentacao_estoque() from public, anon, authenticated;

create trigger aplicar_movimentacao_estoque
before insert on public.movimentacoes_estoque
for each row execute function private.aplicar_movimentacao_estoque();

-- O cliente só pode cadastrar um produto com o saldo padrão (zero).
-- Depois disso o saldo só muda pelo trigger.
revoke insert, update on public.produtos from authenticated;
grant insert (
  empresa_id, categoria_id, nome, sku, codigo_barras, descricao,
  preco_custo, preco_venda, estoque_minimo, unidade_medida, ativo
) on public.produtos to authenticated;
grant update (
  categoria_id, nome, sku, codigo_barras, descricao,
  preco_custo, preco_venda, estoque_minimo, unidade_medida, ativo
) on public.produtos to authenticated;

-- O histórico continua sem UPDATE e DELETE para usuários comuns.
revoke update, delete on public.movimentacoes_estoque from authenticated;

commit;
