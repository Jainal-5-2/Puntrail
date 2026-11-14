do $$
declare
  new_user_id uuid;
begin
  -- Check if the user already exists
  select id into new_user_id from auth.users where email = 'admin@puntrail.app';

  if new_user_id is null then
    new_user_id := gen_random_uuid();
    
    -- 1. Create the auth user
    insert into auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data, 
      is_super_admin, role, aud
    )
    values (
      new_user_id, 
      '00000000-0000-0000-0000-000000000000', 
      'admin@puntrail.app', 
      crypt('admin123', gen_salt('bf')), 
      now(), 
      now(), 
      now(), 
      '{"provider":"email","providers":["email"]}', 
      '{}', 
      false, 
      'authenticated', 
      'authenticated'
    );

    -- 2. Link to public.profiles and grant admin role
    -- (Using ON CONFLICT in case the handle_new_user trigger already fired)
    insert into public.profiles (id, role, display_name)
    values (new_user_id, 'admin', 'Administrator')
    on conflict (id) do update set role = 'admin';
    
  end if;
end $$;