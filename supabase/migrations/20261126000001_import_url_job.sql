-- Link import: the worker downloads a public TikTok / YouTube / Facebook video the user confirmed they may use.
alter type public.job_type add value if not exists 'import_url';
