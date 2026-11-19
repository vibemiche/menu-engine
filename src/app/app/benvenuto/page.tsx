import { redirect } from "next/navigation";
import { RestaurantForm } from "@/components/RestaurantForm";
import { PageHeader } from "@/components/ui";
import { getRestaurantForUser, requireUser } from "@/lib/session";

export default async function WelcomePage() {
  const user = await requireUser();
  if (await getRestaurantForUser(user.id)) redirect("/app");
  return (
    <div className="max-w-3xl">
      <PageHeader title={`Benvenuto${user.name ? `, ${user.name.split(" ")[0]}` : ""}`} subtitle="Partiamo dal tuo locale. Questi dati servono a calcolare i margini e a dare contesto all'agente AI." />
      <RestaurantForm submitLabel="Continua" />
    </div>
  );
}
