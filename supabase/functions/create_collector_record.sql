-- Function to create a collector record with proper permissions
CREATE OR REPLACE FUNCTION public.create_collector_record(
  user_id UUID,
  phone_number TEXT,
  email_address TEXT,
  status_value TEXT DEFAULT 'active'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- This runs with the permissions of the function creator
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Check if the user exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id) THEN
    -- Create a temporary user if needed (for development only)
    IF current_setting('app.environment', true) = 'development' THEN
      -- This is just a placeholder, in a real environment you wouldn't do this
      RAISE NOTICE 'Development mode: User does not exist, but proceeding anyway';
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'User does not exist in auth.users');
    END IF;
  END IF;

  -- Check if collector already exists
  IF EXISTS (SELECT 1 FROM public.collectors WHERE id = user_id) THEN
    -- Update existing collector
    UPDATE public.collectors
    SET 
      phone = phone_number,
      email = email_address,
      status = status_value,
      updated_at = now()
    WHERE id = user_id
    RETURNING to_jsonb(collectors.*) INTO result;
  ELSE
    -- Insert new collector
    INSERT INTO public.collectors (
      id,
      phone,
      email,
      status,
      created_at,
      updated_at
    ) VALUES (
      user_id,
      phone_number,
      email_address,
      status_value,
      now(),
      now()
    )
    RETURNING to_jsonb(collectors.*) INTO result;
  END IF;

  -- Return the result
  RETURN jsonb_build_object('success', true, 'data', result);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', SQLERRM, 
      'detail', SQLSTATE
    );
END;
$$;
