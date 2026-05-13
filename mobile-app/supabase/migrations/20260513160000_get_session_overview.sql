-- Single-round-trip fetch for everything the tasting detail screen needs.
-- Replaces four serial RPCs (wines + tastings + participants + dishes
-- + tasting_dishes) so the panel can render the full picture in one hop —
-- joining or opening a tasting goes from ~4 trips to 1.
create or replace function get_session_overview(p_session_id uuid)
returns json
language sql
security invoker
set search_path = public
as $$
  select json_build_object(
    'wines', coalesce((
      select json_agg(sw.* order by sw.position)
      from session_wines sw
      where sw.session_id = p_session_id
    ), '[]'::json),
    'tastings', coalesce((
      select json_agg(st.*)
      from session_tastings st
      where st.session_id = p_session_id
    ), '[]'::json),
    'participants', coalesce((
      select json_agg(json_build_object(
        'user_id', p.id,
        'display_name', p.display_name,
        'avatar_color', p.avatar_color
      ))
      from profiles p
      where p.id in (
        select sp.user_id from session_participants sp where sp.session_id = p_session_id
      )
    ), '[]'::json),
    'dishes', coalesce((
      select json_agg(sd.* order by sd.created_at)
      from session_dishes sd
      where sd.session_id = p_session_id
    ), '[]'::json),
    'tasting_dishes', coalesce((
      select json_agg(json_build_object(
        'session_tasting_id', std.session_tasting_id,
        'session_dish_id', std.session_dish_id
      ))
      from session_tasting_dishes std
      join session_tastings st on st.id = std.session_tasting_id
      where st.session_id = p_session_id
    ), '[]'::json)
  );
$$;
