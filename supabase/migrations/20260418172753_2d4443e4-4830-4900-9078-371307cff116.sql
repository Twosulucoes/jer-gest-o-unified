SELECT cron.schedule(
  'monitoring-collect-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://dfzjrijdcskncrwaiykr.supabase.co/functions/v1/monitoring-collect',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmempyaWpkY3NrbmNyd2FpeWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTUwNjYsImV4cCI6MjA5MDczMTA2Nn0.jYPuKoPcNC5sEBLXtgTyo9e4oqDsc69zOVrzHrf4lUw"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);