-- Execute uma vez no SQL Editor do projeto "Gestão para Comércios".
begin;

alter table public.produtos add column imagem_path text;
alter table public.categorias add column imagem_path text;

alter table public.produtos add constraint produtos_imagem_empresa_check
  check (imagem_path is null or imagem_path like empresa_id::text || '/produtos/%');
alter table public.categorias add constraint categorias_imagem_empresa_check
  check (imagem_path is null or imagem_path like empresa_id::text || '/categorias/%');

-- A tabela produtos tem privilégios por coluna desde o módulo de movimentações.
grant insert (imagem_path), update (imagem_path) on public.produtos to authenticated;

-- Ao excluir uma categoria, mantenha o produto na mesma empresa sem categoria.
alter table public.produtos drop constraint produtos_categoria_empresa_fk;
alter table public.produtos add constraint produtos_categoria_empresa_fk
  foreign key (categoria_id, empresa_id)
  references public.categorias (id, empresa_id)
  on delete set null (categoria_id);

create policy "gestores_excluem_categorias"
on public.categorias for delete to authenticated
using (
  exists (
    select 1 from public.usuarios_empresas ue
    where ue.empresa_id = categorias.empresa_id
      and ue.usuario_id = (select auth.uid())
      and ue.ativo = true
      and ue.cargo in ('admin', 'gerente')
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogo', 'catalogo', false, 3145728, array['image/jpeg', 'image/png', 'image/webp']);

create policy "membros_leem_imagens_catalogo"
on storage.objects for select to authenticated
using (
  bucket_id = 'catalogo'
  and (storage.foldername(name))[2] in ('produtos', 'categorias')
  and exists (
    select 1 from public.usuarios_empresas ue
    join public.empresas e on e.id = ue.empresa_id
    where ue.usuario_id = (select auth.uid())
      and ue.ativo = true and e.ativo = true
      and ue.empresa_id::text = (storage.foldername(name))[1]
  )
);

create policy "membros_enviam_imagens_catalogo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'catalogo'
  and (storage.foldername(name))[2] in ('produtos', 'categorias')
  and exists (
    select 1 from public.usuarios_empresas ue
    join public.empresas e on e.id = ue.empresa_id
    where ue.usuario_id = (select auth.uid())
      and ue.ativo = true and e.ativo = true
      and ue.empresa_id::text = (storage.foldername(name))[1]
  )
);

create policy "membros_removem_imagens_catalogo"
on storage.objects for delete to authenticated
using (
  bucket_id = 'catalogo'
  and (storage.foldername(name))[2] in ('produtos', 'categorias')
  and exists (
    select 1 from public.usuarios_empresas ue
    join public.empresas e on e.id = ue.empresa_id
    where ue.usuario_id = (select auth.uid())
      and ue.ativo = true and e.ativo = true
      and ue.empresa_id::text = (storage.foldername(name))[1]
  )
);

commit;
