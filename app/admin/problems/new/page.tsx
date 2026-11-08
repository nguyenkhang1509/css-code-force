import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { AdminProblemForm } from "@/components/admin-problem-form";

export const dynamic="force-dynamic";
export default async function NewProblemPage(){const viewer=await getViewer().catch(()=>null);if(!viewer)redirect("/login?next=/admin/problems/new");if(viewer.profile.role!=="admin")redirect("/problems");return <section className="container section"><AdminProblemForm/></section>}
