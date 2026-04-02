create or replace function public.get_session_participants(p_session_id uuid)
returns json
language sql security definer
as $$
  select coalesce(json_agg(json_build_object(
    'user_id', p.id,
    'display_name', p.display_name,
    'avatar_color', p.avatar_color
  )), '[]'::json)
  from profiles p
  where p.id in (
    select distinct st.user_id from session_tastings st where st.session_id = p_session_id
  );
$$;
