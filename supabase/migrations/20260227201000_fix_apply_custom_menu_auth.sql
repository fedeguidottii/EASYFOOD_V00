CREATE OR REPLACE FUNCTION public.apply_custom_menu(
    p_restaurant_id uuid,
    p_menu_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Tolto il controllo is_restaurant_member perché l'app non usa Supabase Auth (auth.uid() è null)
    IF NOT EXISTS (
        SELECT 1 FROM public.custom_menus cm
        WHERE cm.id = p_menu_id
          AND cm.restaurant_id = p_restaurant_id
    ) THEN
        RAISE EXCEPTION 'Menu % not found for restaurant %', p_menu_id, p_restaurant_id;
    END IF;

    UPDATE public.custom_menus SET is_active = false WHERE restaurant_id = p_restaurant_id;
    UPDATE public.custom_menus SET is_active = true WHERE id = p_menu_id;
    UPDATE public.dishes SET is_active = false WHERE restaurant_id = p_restaurant_id;
    UPDATE public.dishes d SET is_active = true
    FROM public.custom_menu_dishes cmd
    WHERE cmd.custom_menu_id = p_menu_id AND cmd.dish_id = d.id AND d.restaurant_id = p_restaurant_id;
END;
$$;
