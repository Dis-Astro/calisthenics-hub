-- 1. Enum per i ruoli dell'app
CREATE TYPE public.app_role AS ENUM ('admin', 'gym_client', 'coaching_client');

-- 2. Enum per lo stato abbonamento
CREATE TYPE public.subscription_status AS ENUM ('active', 'expired', 'pending', 'cancelled');

-- 3. Tabella profili utenti
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    birth_date DATE,
    fiscal_code TEXT,
    address TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    notes TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Tabella ruoli utenti (separata per sicurezza)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'gym_client',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 5. Tabella abbonamenti
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subscription_type TEXT NOT NULL, -- 'mensile', 'trimestrale', 'annuale', 'coaching'
    status subscription_status NOT NULL DEFAULT 'pending',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price DECIMAL(10,2),
    payment_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Abilita RLS su tutte le tabelle
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 7. Funzione security definer per verificare ruoli (evita ricorsione RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- 8. Funzione per verificare se utente è admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'admin')
$$;

-- 9. RLS Policies per profiles
-- Admin può vedere tutti i profili
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (public.is_admin(auth.uid()));

-- Admin può modificare tutti i profili
CREATE POLICY "Admins can update all profiles" 
ON public.profiles FOR UPDATE 
USING (public.is_admin(auth.uid()));

-- Admin può inserire profili
CREATE POLICY "Admins can insert profiles" 
ON public.profiles FOR INSERT 
WITH CHECK (public.is_admin(auth.uid()));

-- Admin può eliminare profili
CREATE POLICY "Admins can delete profiles" 
ON public.profiles FOR DELETE 
USING (public.is_admin(auth.uid()));

-- Utenti possono vedere il proprio profilo
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

-- Utenti possono aggiornare il proprio profilo (solo campi base)
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

-- 10. RLS Policies per user_roles
-- Admin può vedere tutti i ruoli
CREATE POLICY "Admins can view all roles" 
ON public.user_roles FOR SELECT 
USING (public.is_admin(auth.uid()));

-- Admin può gestire i ruoli
CREATE POLICY "Admins can insert roles" 
ON public.user_roles FOR INSERT 
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles" 
ON public.user_roles FOR UPDATE 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles" 
ON public.user_roles FOR DELETE 
USING (public.is_admin(auth.uid()));

-- Utenti possono vedere i propri ruoli
CREATE POLICY "Users can view own role" 
ON public.user_roles FOR SELECT 
USING (auth.uid() = user_id);

-- 11. RLS Policies per subscriptions
-- Admin può gestire tutti gli abbonamenti
CREATE POLICY "Admins can view all subscriptions" 
ON public.subscriptions FOR SELECT 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert subscriptions" 
ON public.subscriptions FOR INSERT 
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update subscriptions" 
ON public.subscriptions FOR UPDATE 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete subscriptions" 
ON public.subscriptions FOR DELETE 
USING (public.is_admin(auth.uid()));

-- Utenti possono vedere i propri abbonamenti
CREATE POLICY "Users can view own subscriptions" 
ON public.subscriptions FOR SELECT 
USING (auth.uid() = user_id);

-- 12. Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();