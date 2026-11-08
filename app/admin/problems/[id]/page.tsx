import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { AdminProblemForm } from "@/components/admin-problem-form";

export const dynamic="force-dynamic";
export default async function EditProblemPage({params}:{params:Promise<{id:string}>}){const viewer=await getViewer().catch(()=>null);if(!viewer)redirect("/login?next=/admin");if(viewer.profile.role!=="admin")redirect("/problems");const {id}=await params;return <section className="container section"><AdminProblemForm problemId={id}/></section>}
