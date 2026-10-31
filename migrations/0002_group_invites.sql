-- 0002_group_invites — invitations par jeton expirant, en remplacement du code de groupe
--
-- Un seul jeton par invitation. Il encode le lien, le QR affiche ce même lien.
-- Durée : 2 h pour un responsable ou un modérateur, 1 h pour un membre simple.
-- Le jeton est stocké HACHÉ (sha256) : même avec un accès en lecture à la table,
-- on ne peut pas reconstruire un lien valide.
--
-- Usage multiple pendant la fenêtre : trois amis doivent pouvoir entrer d'un coup.

-- Journal des migrations : créé ici aussi, la baseline n'ayant pas encore été
-- appliquée en production (elle n'a été validée qu'en transaction annulée).
create table if not exists public.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now(),
  notes      text
);

create table if not exists public.group_invites (
  id          bigint generated always as identity primary key,
  group_id    bigint not null references public.groups(id) on delete cascade,
  token_hash  text not null unique,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked     boolean not null default false
);

create index if not exists group_invites_group_idx on public.group_invites (group_id);
create index if not exists group_invites_live_idx on public.group_invites (expires_at) where not revoked;

alter table public.group_invites enable row level security;
-- Aucune policy : la table n'est lisible que par les fonctions ci-dessous,
-- qui sont security definer et vérifient les droits avant d'agir.

create or replace function public.create_group_invite(p_group bigint)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_token text;
  v_exp   timestamptz;
  v_mod   boolean;
begin
  if auth.uid() is null then raise exception 'non authentifié'; end if;
  if not public.is_member_of(p_group) then raise exception 'groupe inconnu'; end if;

  v_mod := public.can_moderate(p_group);
  v_exp := now() + case when v_mod then interval '2 hours' else interval '1 hour' end;
  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.group_invites (group_id, token_hash, created_by, expires_at)
  values (p_group, encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid(), v_exp);

  return jsonb_build_object(
    'token', v_token,
    'expires_at', v_exp,
    'manager', v_mod
  );
end $$;

create or replace function public.redeem_invite(p_token text)
returns bigint
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_row public.group_invites;
begin
  if auth.uid() is null then raise exception 'non authentifié'; end if;
  if p_token is null or length(p_token) < 16 then raise exception 'invitation invalide'; end if;

  select * into v_row
    from public.group_invites
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and not revoked
     and expires_at > now();

  if not found then raise exception 'invitation expirée ou invalide'; end if;

  if exists (select 1 from public.memberships m
              where m.group_id = v_row.group_id and m.user_id = auth.uid()) then
    return v_row.group_id;
  end if;

  insert into public.memberships (group_id, user_id, role, status)
  values (v_row.group_id, auth.uid(), 'member', 'active');

  return v_row.group_id;
end $$;

-- Le jeton circule dans un lien : on révoque tout accès direct à la table.
revoke all on public.group_invites from anon, authenticated;
grant execute on function public.create_group_invite(bigint) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;

insert into public.schema_migrations (version, notes)
values ('0002_group_invites', 'invitations par jeton expirant')
on conflict (version) do nothing;
