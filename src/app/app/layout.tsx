import { AppNav } from "@/components/AppNav";
import { getRestaurantForUser, requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const restaurant = await getRestaurantForUser(user.id);
  return (
    <div className="lg:flex">
      <AppNav userName={user.name || user.email} restaurantName={restaurant?.name ?? null} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
