-- Ensure uuid-ossp extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: folders
CREATE TABLE IF NOT EXISTS public.folders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    is_protected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own folders."
    ON public.folders FOR ALL 
    USING ( auth.uid() = user_id );

-- Table: documents
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    size_bytes BIGINT,
    mime_type TEXT,
    storage_path TEXT NOT NULL,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own documents."
    ON public.documents FOR ALL 
    USING ( auth.uid() = user_id );


-- Storage Bucket for files
-- Note: You might need to create this manually from the Supabase Studio 
-- if the project lacks API keys for raw storage operations via SQL, 
-- but this SQL provides the RLS for the storage.objects table.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vault_documents', 'vault_documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for Storage Bucket
DROP POLICY IF EXISTS "Users can view their own documents." ON storage.objects;
CREATE POLICY "Users can view their own documents."
    ON storage.objects FOR SELECT
    TO authenticated
    USING ( bucket_id = 'vault_documents' AND auth.uid() = owner::uuid );

DROP POLICY IF EXISTS "Users can upload their own documents." ON storage.objects;
CREATE POLICY "Users can upload their own documents."
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK ( bucket_id = 'vault_documents' AND auth.uid() = owner::uuid );

DROP POLICY IF EXISTS "Users can update their own documents." ON storage.objects;
CREATE POLICY "Users can update their own documents."
    ON storage.objects FOR UPDATE 
    TO authenticated
    USING ( bucket_id = 'vault_documents' AND auth.uid() = owner::uuid );

DROP POLICY IF EXISTS "Users can delete their own documents." ON storage.objects;
CREATE POLICY "Users can delete their own documents."
    ON storage.objects FOR DELETE
    TO authenticated
    USING ( bucket_id = 'vault_documents' AND auth.uid() = owner::uuid );
