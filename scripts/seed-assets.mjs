// Local development only: upload seed files (letterheads) to the local Supabase Storage and link them.
// Run after `supabase db reset`:  npm run db:seed-assets
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)) {
  console.error(`Refusing to run: ${url ?? "NEXT_PUBLIC_SUPABASE_URL"} is not a local Supabase.`);
  process.exit(1);
}
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const LETTERHEADS = [{ projectCode: "SV", file: "supabase/seed-assets/simco-villas-letterhead.pdf" }];

for (const { projectCode, file } of LETTERHEADS) {
  const { data: project, error: pErr } = await supabase.from("projects").select("id").eq("code", projectCode).single();
  if (pErr) throw pErr;
  const path = `letterheads/${project.id}/seed-letterhead.pdf`;
  const { error: upErr } = await supabase.storage
    .from("branding")
    .upload(path, readFileSync(file), { contentType: "application/pdf", upsert: true });
  if (upErr) throw upErr;
  const { error: sErr } = await supabase
    .from("project_document_settings")
    .upsert({ project_id: project.id, letterhead_path: path }, { onConflict: "project_id" });
  if (sErr) throw sErr;
  console.log(`${projectCode}: letterhead uploaded → branding/${path}`);
}
