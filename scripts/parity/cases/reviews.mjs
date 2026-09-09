export const key = (r) => r.review_id;
export async function supabase(sb){const{data,error}=await sb.from("reviews").select("*");if(error)throw error;return data??[];}
export async function dotnet(api){return api.get("/api/reviews");}
