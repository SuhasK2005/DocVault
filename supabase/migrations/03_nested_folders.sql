-- Adds nested folder support and helpful indexes for folder/document browsing.
ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_folders_user_parent
  ON public.folders(user_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_documents_user_folder
  ON public.documents(user_id, folder_id);
