export const key = (r) => r.id;
export async function supabase(sb){const{data,error}=await sb.from("audit_logs").select("*").order("performed_at",{ascending:false}).limit(100);if(error)throw error;return data??[];}
export async function dotnet(api){return api.get("/api/audit-logs?take=100");}
