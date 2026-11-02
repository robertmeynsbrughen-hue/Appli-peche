-- Rivio 0.73.1 : correctif urgent.
-- La table groups n'accorde la lecture aux membres que colonne par colonne
-- (le code d'invitation reste caché). La colonne is_welcome ajoutée en 0.69
-- n'avait pas ce droit : depuis la 0.70, l'appli la demande et toute la
-- requête des groupes échouait, d'où des groupes invisibles côté membres.
-- Règle : toute nouvelle colonne de groups doit recevoir son « grant select ».
grant select (is_welcome) on public.groups to authenticated;

insert into public.schema_migrations (version, notes)
values ('0017_v0731_groupes_visibles', 'droit de lecture de groups.is_welcome : la liste des groupes était vide côté membres depuis 0.70')
on conflict (version) do nothing;
