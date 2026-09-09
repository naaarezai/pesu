-- ==============================================================================
-- KOUVOLAN ASUNNOT OY - PESUTUVAN VARAUSJÄRJESTELMÄ (pesu.sido.fi)
-- SUPABASE SQL SETUP
-- ==============================================================================

-- 1. Luodaan varaukset-taulu
CREATE TABLE IF NOT EXISTS public.varaukset (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asunto_numero VARCHAR(20) NOT NULL,
    aloitusaika TIMESTAMP WITH TIME ZONE NOT NULL,
    lopetusaika TIMESTAMP WITH TIME ZONE NOT NULL,
    kuitattu_alkaneeksi BOOLEAN DEFAULT FALSE,
    luotu_pvm TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT tarkista_ajat CHECK (lopetusaika > aloitusaika),
    CONSTRAINT max_3_tuntia CHECK (lopetusaika - aloitusaika <= INTERVAL '3 hours')
);

-- Indeksit suorituskykyä varten
CREATE INDEX IF NOT EXISTS idx_varaukset_aikavali ON public.varaukset(aloitusaika, lopetusaika);
CREATE INDEX IF NOT EXISTS idx_varaukset_asunto ON public.varaukset(asunto_numero);

-- 2. Luodaan trigger-funktio, joka valvoo pesutuvan sääntöjä:
--    a) Päällekkäisyyksien esto (ei kahta varausta samaan aikaan)
--    b) Vain 1 voimassaoleva tai tuleva varaus kerrallaan per asunto
CREATE OR REPLACE FUNCTION public.tarkista_varaus_saannot()
RETURNS TRIGGER AS $$
DECLARE
    viikon_tunnit numeric;
    uuden_varauksen_kesto numeric;
BEGIN
    -- Poistetaan ylimääräiset välilyönnit ja varmistetaan siisti asuntotunnus
    NEW.asunto_numero := UPPER(TRIM(NEW.asunto_numero));

    IF LENGTH(NEW.asunto_numero) = 0 THEN
        RAISE EXCEPTION 'Asuntonumero ei voi olla tyhjä!';
    END IF;

    -- a) Tarkistetaan ettei varaus mene päällekkäin minkään toisen varauksen kanssa
    IF EXISTS (
        SELECT 1 FROM public.varaukset
        WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND NEW.aloitusaika < lopetusaika
          AND NEW.lopetusaika > aloitusaika
    ) THEN
        RAISE EXCEPTION 'Valittu aikaväli on jo varattu!';
    END IF;

    -- b) Tarkistetaan, ettei kyseisellä asunnolla ylity 3 tunnin maksimiraja samalla viikolla
    uuden_varauksen_kesto := EXTRACT(EPOCH FROM (NEW.lopetusaika - NEW.aloitusaika)) / 3600.0;
    
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (lopetusaika - aloitusaika)) / 3600.0), 0)
    INTO viikon_tunnit
    FROM public.varaukset
    WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND UPPER(TRIM(asunto_numero)) = NEW.asunto_numero
      AND date_trunc('week', aloitusaika) = date_trunc('week', NEW.aloitusaika);

    IF viikon_tunnit + uuden_varauksen_kesto > 3 THEN
        RAISE EXCEPTION 'Asunnolla % on jo ennestään varauksia tälle viikolle. Yläraja (3 h/vko) ylittyisi!', NEW.asunto_numero;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Kytketään triggeri
DROP TRIGGER IF EXISTS trg_tarkista_varaus ON public.varaukset;
CREATE TRIGGER trg_tarkista_varaus
BEFORE INSERT OR UPDATE ON public.varaukset
FOR EACH ROW
EXECUTE FUNCTION public.tarkista_varaus_saannot();

-- 3. Row Level Security (RLS) -säännöt
-- Koska järjestelmä toimii avoimesti ilman salasanaa (kuten paperinen lista),
-- sallitaan lukeminen kaikille, varauksen luonti ja poistaminen.
ALTER TABLE public.varaukset ENABLE ROW LEVEL SECURITY;

-- Kaikki voivat lukea varaukset (jotta kalenteri näkyy kaikille)
DROP POLICY IF EXISTS "Salli varausten lukeminen kaikille" ON public.varaukset;
CREATE POLICY "Salli varausten lukeminen kaikille" 
ON public.varaukset FOR SELECT 
USING (true);

-- Kaikki voivat lisätä varauksen (triggeri tarkistaa säännöt)
DROP POLICY IF EXISTS "Salli varausten luominen" ON public.varaukset;
CREATE POLICY "Salli varausten luominen" 
ON public.varaukset FOR INSERT 
WITH CHECK (true);

-- Sallitaan oman varauksen peruuttaminen (poistaminen)
DROP POLICY IF EXISTS "Salli varauksen poisto" ON public.varaukset;
CREATE POLICY "Salli varauksen poisto" 
ON public.varaukset FOR DELETE 
USING (true);

-- Sallitaan varauksen kuittaaminen (päivitys)
DROP POLICY IF EXISTS "Salli varauksen päivitys" ON public.varaukset;
CREATE POLICY "Salli varauksen päivitys" 
ON public.varaukset FOR UPDATE 
USING (true);

-- 4. Ota käyttöön Supabase Realtime (jotta kalenteri päivittyy heti ilman sivun päivitystä)
DO $$ 
BEGIN
  -- Varmista että julkaisu on olemassa
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  
  -- Lisää taulu julkaisuun vain jos se ei vielä ole siellä
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'varaukset'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.varaukset;
  END IF;
END $$;
