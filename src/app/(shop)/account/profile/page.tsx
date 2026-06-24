import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customerAuth";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile | EssenceFit" };

export default async function ProfilePage() {
  const me = await getCurrentCustomer();
  if (!me) redirect("/account/login?next=/account/profile");

  return <ProfileForm initial={{ name: me.Name, phone: me.Phone ?? "", address: me.Address ?? "" }} />;
}
