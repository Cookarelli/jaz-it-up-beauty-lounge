import { adminContext } from "@/lib/admin";
import { CustomerEditor } from "@/components/customer-editor";
export default async function NewCustomer() {
  await adminContext();
  return (
    <>
      <h2>Add customer</h2>
      <div className="card">
        <CustomerEditor />
      </div>
    </>
  );
}
