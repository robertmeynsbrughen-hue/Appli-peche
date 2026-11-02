-- Rivio 0.69.1 : type de pêche affiché sous le nom des pêcheurs.
-- Rejouable sans erreur.

alter table public.profiles add column if not exists fish_styles text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_fish_styles_check;
alter table public.profiles add constraint profiles_fish_styles_check check (
  coalesce(array_length(fish_styles, 1), 0) <= 3
  and fish_styles <@ array['carpe','carnassier','coup','feeder','mouche','truite','silure','float','mer']::text[]
);

-- profil public : bloqué pendant une sanction, comme la bio et la photo
create or replace function public.set_fish_styles(p_styles text[])
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if public.is_timed_out() then raise exception 'compte suspendu : profil non modifiable pour le moment' using errcode = '42501'; end if;
  update public.profiles
     set fish_styles = (select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(p_styles, '{}')) x)
   where id = auth.uid();
end $$;
revoke all on function public.set_fish_styles(text[]) from public, anon;
grant execute on function public.set_fish_styles(text[]) to authenticated;

insert into public.schema_migrations (version, notes)
values ('0013_v0691_types_peche', 'types de pêche sur le profil')
on conflict (version) do nothing;
