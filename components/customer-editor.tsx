import { AdminForm, Field, Notes, Identity } from "./admin-form";
import { saveCustomer } from "@/app/admin/(private)/management-actions";
export function CustomerEditor({
  customer,
}: {
  customer?: {
    id: string;
    revision: number;
    name: string;
    email: string | null;
    phone: string;
    notes: string;
  };
}) {
  return (
    <AdminForm
      action={saveCustomer}
      label={customer ? "Save customer" : "Add customer"}
    >
      {customer && <Identity id={customer.id} revision={customer.revision} />}
      <Field
        name="name"
        label="Customer name"
        value={customer?.name}
        required
      />
      <Field
        name="email"
        label="Email (optional)"
        type="email"
        value={customer?.email}
      />
      <Field
        name="phone"
        label="Phone (optional for walk-ins)"
        type="tel"
        value={customer?.phone}
      />
      <Notes value={customer?.notes} />
      <p>
        Contact edits apply to the customer record. Existing appointments retain
        the contact details supplied at booking.
      </p>
    </AdminForm>
  );
}
