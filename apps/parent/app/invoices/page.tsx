import { getCurrentParentId } from "@manhaj/lib/queries/auth";
import { getInvoicesForParent } from "@manhaj/lib/queries/invoices";
import InvoicesPageClient from "./InvoicesPageClient";

export const dynamic = "force-dynamic";

export default async function ParentInvoicesPage() {
  const parentId  = await getCurrentParentId();
  const dbInvoices = parentId ? await getInvoicesForParent(parentId) : [];
  return <InvoicesPageClient dbInvoices={dbInvoices} />;
}
